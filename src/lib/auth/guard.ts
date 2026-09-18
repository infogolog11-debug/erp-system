import { auth } from "@/auth";
import { getUserPermission, can, type ModuleCode, type PermissionLevel } from "@/lib/permissions/service";

// ════════════════════════════════════════════════════════════
// حارس صلاحيات الـServer Actions
// ════════════════════════════════════════════════════════════
// المشكلة: كانت الـ server actions تثق بـ userId/organizationId
// كبارامترات يرسلها العميل، بدون أي إعادة تحقق من الجلسة الفعلية
// داخل الأكشن نفسها. هذا يعني نظرياً أن استدعاء الأكشن مباشرة
// (متجاوزاً الواجهة) بأي organizationId يفلت من كل الحماية.
//
// الحل: كل أكشن حسّاس (إنشاء/تعديل/موافقة) يستدعي requireSession()
// أو requirePermission() في أول سطر، ويستخدم القيم المُتحقَّق منها
// من الجلسة الفعلية بدل الوثوق بأي قيمة قادمة من العميل.

export type GuardResult =
  | { ok: true; userId: string; organizationId: string; role: string }
  | { ok: false; error: string };

// تحقّق أساسي: هل يوجد مستخدم مسجَّل دخول فعلياً؟
export async function requireSession(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "الجلسة غير صالحة — الرجاء تسجيل الدخول مجدداً" };
  }
  return {
    ok: true,
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role,
  };
}

// تحقّق من الجلسة + صلاحية كافية على وحدة معينة
export async function requirePermission(
  moduleCode: ModuleCode,
  minLevel: PermissionLevel,
): Promise<GuardResult> {
  const session = await requireSession();
  if (!session.ok) return session;

  const perm = await getUserPermission(session.userId, session.organizationId, moduleCode, session.role);
  if (!can(perm, minLevel)) {
    return { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" };
  }
  return session;
}

// تحقّق إضافي: هل organizationId القادم من العميل (إن وُجد) يطابق فعلاً
// منظمة المستخدم بجلسته الحقيقية؟ يُستخدم عند الانتقال التدريجي
// للأكشنز القديمة التي ما زالت تستقبل organizationId كبارامتر،
// لمنع انتحال منظمة أخرى دون الحاجة لإعادة كتابة توقيع كل دالة فوراً.
export function assertOrgMatches(claimedOrgId: string, session: Extract<GuardResult, { ok: true }>): boolean {
  return claimedOrgId === session.organizationId;
}
