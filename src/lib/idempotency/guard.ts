// ════════════════════════════════════════════════════════════════
// حارس Idempotency — يمنع تنفيذ نفس العملية مرتين (retry شبكة، نقرة
// مزدوجة، إعادة إرسال فورم). الاستدعاء الأول يُنفَّذ ويُخزَّن ناتجه؛
// أي استدعاء لاحق بنفس (organizationId + key + action) يعيد نفس
// الناتج المخزَّن فوراً دون إعادة تنفيذ المنطق.
//
// التصميم: نحجز المفتاح أولاً بـ INSERT (يعتمد على unique index بقاعدة
// البيانات كمصدر الحسم الوحيد تحت التزامن) قبل تنفيذ fn() — وليس بعده.
// هذا يمنع سيناريو أن يمر طلبان متزامنان معاً من فحص "غير موجود" وينفذا
// fn() مرتين، وهو الثغرة الشائعة بتطبيقات idempotency المكتوبة بسذاجة
// (check-then-act بدل atomic reserve).
// ════════════════════════════════════════════════════════════════
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export class IdempotencyInProgressError extends Error {
  constructor() { super("طلب مطابق قيد التنفيذ حالياً — أعد المحاولة خلال لحظات"); }
}

export async function withIdempotency<T>(
  organizationId: string,
  key: string | undefined,
  action: string,
  fn: () => Promise<T>,
): Promise<T> {
  // بدون مفتاح: تنفيذ عادي (مسار انتقالي لاستدعاءات لم تُحدَّث بعد لإرسال مفتاح)
  if (!key) return fn();

  const reserved = await db.insert(idempotencyKeys)
    .values({ organizationId, key, action, responseJson: null })
    .onConflictDoNothing({ target: [idempotencyKeys.organizationId, idempotencyKeys.key, idempotencyKeys.action] })
    .returning({ id: idempotencyKeys.id });

  if (reserved.length === 0) {
    // المفتاح محجوز مسبقاً — إما عملية سابقة اكتملت (نعيد ناتجها)
    // أو عملية متزامنة لا تزال قيد التنفيذ الآن (نُبلغ الطالب بإعادة المحاولة)
    const existing = await db.query.idempotencyKeys.findFirst({
      where: and(eq(idempotencyKeys.organizationId, organizationId), eq(idempotencyKeys.key, key), eq(idempotencyKeys.action, action)),
    });
    if (existing?.responseJson) return JSON.parse(existing.responseJson) as T;
    throw new IdempotencyInProgressError();
  }

  let result: T;
  try {
    result = await fn();
  } catch (err) {
    // ─── إصلاح أهم من سابقه: أغلب نقاط النداء الفعلية (createDistribution,
    // createGoodsReceiptNote) لا تُرجع {success:false} من داخل fn نفسها —
    // هي تَرمي (throw) استثناءً من داخل transaction عند فشل تحقق عمل
    // (مخزون غير كافٍ، تجاوز كمية الاستلام...)، ويُلتقط هذا الاستثناء
    // بـ try/catch *خارجي* بالدالة المستدعية، خارج withIdempotency تماماً.
    // بدون هذا الإصلاح: أي رمي كهذا كان يُسقط الحجز بمنتصف الطريق —
    // السطر يبقى بقاعدة البيانات بـ responseJson=null للأبد، فأي إعادة
    // محاولة لاحقة بنفس المفتاح (حتى بعد تصحيح البيانات) تصطدم بخطأ
    // "قيد التنفيذ حالياً" بشكل دائم دون أي طريقة للخروج منه. الإصلاح:
    // نلتقط الاستثناء هنا، نفكّ الحجز، ثم نعيد رميه كما هو للمستدعي —
    // سلوك الخطأ نفسه من الخارج، لكن بدون حجز عالق.
    await db.delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.organizationId, organizationId), eq(idempotencyKeys.key, key), eq(idempotencyKeys.action, action)));
    throw err;
  }

  // كانت هذي الدالة تخزّن أي نتيجة بدون تمييز، حتى لو كانت فشل تحقق
  // (success:false) — يعني لو أرسل العميل مفتاح idempotency مع بيانات
  // خاطئة، صحّحها، وأعاد المحاولة *بنفس المفتاح*، كان بياخذ نفس رسالة
  // الفشل القديمة مخزَّنة إلى الأبد بدون أي فرصة لإعادة المحاولة الفعلية.
  // نفس منطق الفرع أعلاه لكن لمسار "الفشل عبر قيمة إرجاع" بدل "رمي".
  const isExplicitFailure = typeof result === "object" && result !== null && (result as any).success === false;

  if (isExplicitFailure) {
    await db.delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.organizationId, organizationId), eq(idempotencyKeys.key, key), eq(idempotencyKeys.action, action)));
  } else {
    await db.update(idempotencyKeys)
      .set({ responseJson: JSON.stringify(result) })
      .where(and(eq(idempotencyKeys.organizationId, organizationId), eq(idempotencyKeys.key, key), eq(idempotencyKeys.action, action)));
  }

  return result;
}
