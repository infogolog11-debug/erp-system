import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { createHash } from "crypto";

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

interface AuditParams {
  organizationId: string;
  userId: string;
  tableName: string;
  recordId: string;
  action: "CREATE"|"UPDATE"|"DELETE"|"APPROVE"|"REJECT"|"ARCHIVE"|"RESTORE";
  oldValues?: Record<string,unknown>;
  newValues?: Record<string,unknown>;
  ipAddress?: string;
}

// ════════════════════════════════════════════════════════════════
// سلسلة تجزئة (Hash Chain) لجعل سجل التدقيق tamper-evident:
// كل سطر يحمل hash محسوبة من محتواه + prevHash (تجزئة آخر سطر بنفس
// المنظمة قبله). أي تعديل لاحق على سطر قديم (سواء بـ UPDATE مباشر على
// الجدول أو بالتلاعب بأي عمود) يُغيّر ناتج hash المحسوبة له، فيتعارض
// مع prevHash المخزّنة بالسطر التالي — والتحقق (verifyChain أدناه)
// يكتشف نقطة الانكسار بالضبط.
//
// حدود هذا الإصلاح (موثّقة بصراحة، بلا تجميل):
// - هذا tamper-evident (يكتشف التلاعب) وليس immutable بشكل مطلق. من
//   يملك صلاحية DB owner/superuser يقدر يعدّل أي عمود *بما فيها* hash
//   و prevHash معاً ويعيد حساب السلسلة كاملة بنفسه فيُخفي الأثر —
//   لأن التطبيق نفسه (Node.js) هو من يحسب الـ hash، مو قاعدة البيانات
//   بصلاحية منفصلة عن التطبيق.
// - الحماية المطلقة تتطلب: (أ) دور DB منفصل بصلاحية INSERT فقط على
//   audit_logs بدون UPDATE/DELETE حتى لدور التطبيق نفسه (REVOKE)،
//   و/أو (ب) HMAC بمفتاح خارج قاعدة البيانات (KMS/HSM) بدل hash عادي،
//   و/أو (ج) إرسال دوري لـ hash السلسلة الحالية لنظام خارجي (WORM
//   storage, blockchain anchor) كمرجع مستقل لا يقدر مالك القاعدة تعديله.
//   هذا خارج نطاق كود التطبيق وحده — يحتاج قرار بنية تحتية. مذكور
//   بالتفصيل في SECURITY_NOTES.md.
// ════════════════════════════════════════════════════════════════

function computeHash(prevHash: string | null, row: Omit<AuditParams,"ipAddress"> & { createdAt: string }): string {
  const payload = JSON.stringify({
    prevHash,
    organizationId: row.organizationId,
    userId: row.userId,
    tableName: row.tableName,
    recordId: row.recordId,
    action: row.action,
    oldValues: row.oldValues ?? null,
    newValues: row.newValues ?? null,
    createdAt: row.createdAt,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export async function createAuditLog(p: AuditParams, tx?: Tx) {
  // ─── إصلاح v32: كانت هذه الدالة تُستدعى دائماً بعد commit العملية
  // الأساسية، ومغلّفة بـ try/catch يبتلع الخطأ (console.error فقط) —
  // يعني لو فشل تسجيل التدقيق، العملية المالية/التشغيلية تصير بنجاح
  // ويبقى سجل التدقيق فيه فجوة صامتة، بدون أي تنبيه.
  //
  // الإصلاح: لو مُرِّر tx (اتصال معاملة قائمة من الكود المستدعي)، نستخدمه
  // بدل db العامة، وما نبتلع الخطأ — لو فشل الإدراج، يفشل كل شي معه
  // (rollback تلقائي لأنه بنفس الـ transaction). هذا يجعل التسجيل ذرّياً
  // فعلاً مع العملية، بدل خطوة منفصلة بعدها.
  // الاستدعاء بدون tx يبقى مدعوماً (مسار انتقالي لاستدعاءات لم تُحدَّث
  // بعد لتمرير tx) ويحتفظ بالسلوك القديم (فشل صامت) لأنه أصلاً مستقل عن
  // أي عملية أخرى، فلا يوجد شيء "يُلغى" لو فشل.
  const client = tx ?? db;
  const runInsert = async () => {
    const last = await client.query.auditLogs.findFirst({
      where: eq(auditLogs.organizationId, p.organizationId),
      orderBy: desc(auditLogs.createdAt),
    });
    const prevHash = last?.hash ?? null;
    const createdAt = new Date().toISOString();

    const hash = computeHash(prevHash, {
      organizationId: p.organizationId, userId: p.userId, tableName: p.tableName,
      recordId: p.recordId, action: p.action, oldValues: p.oldValues, newValues: p.newValues,
      createdAt,
    });

    await client.insert(auditLogs).values({
      organizationId: p.organizationId,
      userId: p.userId,
      tableName: p.tableName,
      recordId: p.recordId,
      action: p.action,
      oldValues: p.oldValues ? JSON.stringify(p.oldValues) : null,
      newValues: p.newValues ? JSON.stringify(p.newValues) : null,
      ipAddress: p.ipAddress,
      prevHash,
      hash,
      createdAt: new Date(createdAt),
    });
  };

  if (tx) {
    // بمعاملة قائمة: لا نبتلع الخطأ — فشل التدقيق يُسقط العملية كلها
    await runInsert();
  } else {
    try {
      await runInsert();
    } catch (e) {
      console.error("Audit log failed:", e);
    }
  }
}

/**
 * يتحقق من سلامة سلسلة سجل التدقيق لمنظمة معينة، ويعيد أول نقطة انكسار
 * إن وُجدت (دليل تلاعب أو خلل). يُستخدم كأداة مراجعة دورية (cron/يدوي)،
 * وليس على كل قراءة — التحقق يمر على كامل السلسلة فهو O(n).
 */
export async function verifyAuditChain(organizationId: string): Promise<
  { valid: true } | { valid: false; brokenAtRecordId: string; reason: string }
> {
  const rows = await db.query.auditLogs.findMany({
    where: eq(auditLogs.organizationId, organizationId),
    orderBy: (t, { asc }) => asc(t.createdAt),
  });

  let expectedPrevHash: string | null = null;
  for (const row of rows) {
    if (row.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtRecordId: row.id, reason: "prevHash لا يطابق تجزئة السطر السابق" };
    }
    const recomputed = computeHash(row.prevHash, {
      organizationId: row.organizationId, userId: row.userId, tableName: row.tableName,
      recordId: row.recordId, action: row.action as AuditParams["action"],
      oldValues: row.oldValues ? JSON.parse(row.oldValues) : undefined,
      newValues: row.newValues ? JSON.parse(row.newValues) : undefined,
      createdAt: row.createdAt.toISOString(),
    });
    if (recomputed !== row.hash) {
      return { valid: false, brokenAtRecordId: row.id, reason: "محتوى السطر لا يطابق تجزئته المخزَّنة — تعديل بعد التسجيل" };
    }
    expectedPrevHash = row.hash;
  }
  return { valid: true };
}
