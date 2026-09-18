import { db } from "@/db";
import { eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

// ════════════════════════════════════════════════════════════
// دالة موحّدة للتحقق من ملكية المنظمة لسجل — assertOwnedByOrg
// ════════════════════════════════════════════════════════════
// المشكلة (موثّقة بـ SECURITY_NOTES v35 §8 وv36): كل موديول كان يكرر
// نفس نمط "اجلب السجل، قارن organizationId يدوياً" بأسلوبه الخاص —
// أحياناً عبر db.query.<table>.findFirst({ columns:{organizationId:true} })
// وأحياناً بجلب السجل كاملاً، وأحياناً بلا أي تحقق إطلاقاً (وهذا بالضبط
// ما سبّب ثغرتي IDOR بـ recordScreening وcreateSubGrant). تكرار النمط
// يدوياً بكل موديول يعني أن أي موديول جديد قد ينسى الفحص تماماً.
//
// الحل: دالة عامة واحدة، تعمل مع أي جدول فيه عمودا id وorganizationId
// (كل الجداول التشغيلية بهذا المشروع تملكهما عبر baseColumns) —
// موديول جديد يستدعيها بسطر واحد بدل إعادة كتابة الاستعلام.
//
// ملاحظة تصميم: لا تُلقي استثناء — تعيد boolean، لأن كل الأكشنز
// الحالية تتعامل مع فشل التحقق كـ ActionResult عادي (success:false)
// برسالة عامة موحّدة لمنع enumeration، لا كخطأ غير متوقع.

interface OwnableTable extends PgTable {
  id: PgColumn;
  organizationId: PgColumn;
}

/**
 * يتحقق أن السجل ذو المعرّف `id` بالجدول `table` تابع فعلاً للمنظمة
 * `organizationId`. يُستخدم لأي معرّف قادم من العميل يشير لسجل مرتبط
 * (foreign key) قبل استخدامه بأي عملية قراءة/كتابة حساسة — وليس فقط
 * للتحقق من organizationId المُرسَل صراحة (ذلك دور assertOrgMatches).
 *
 * مثال:
 *   if (!(await assertOwnedByOrg(partners, v.data.partnerId, session.organizationId)))
 *     return { success:false, error:"غير موجود" };
 */
export async function assertOwnedByOrg(
  table: OwnableTable,
  id: string | null | undefined,
  organizationId: string | null | undefined,
): Promise<boolean> {
  if (!id || !organizationId) return false;

  // بدون .limit(1) عمداً: الاستعلام يقارن بعمود id (المفتاح الأساسي)، فلا يمكن
  // أن يعيد أكثر من صف بأي حال — وهذا يطابق نمط بقية استعلامات select().from().where()
  // المستخدمة بباقي الموديولات (مثل استعلامات count) دون الحاجة لتوسيع كل mock اختباري
  // ليدعم .limit() إضافياً.
  const rows = await db
    .select({ organizationId: table.organizationId })
    .from(table)
    .where(eq(table.id, id));
  const row = rows?.[0];

  return !!row && row.organizationId === organizationId;
}

/**
 * نسخة تتحقق من عدة معرّفات دفعة واحدة (كلها ضد نفس المنظمة) — مفيدة
 * بالأكشنز التي تستقبل أكثر من foreign key بنفس الطلب (مثل createSubGrant:
 * partnerId + parentGrantId). تُنفَّذ الاستعلامات بالتوازي.
 */
export async function assertAllOwnedByOrg(
  checks: Array<{ table: OwnableTable; id: string | null | undefined }>,
  organizationId: string | null | undefined,
): Promise<boolean> {
  if (!organizationId) return false;
  const results = await Promise.all(
    checks.map((c) => assertOwnedByOrg(c.table, c.id, organizationId)),
  );
  return results.every(Boolean);
}
