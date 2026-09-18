import { db } from "@/db";
import { organizations, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAuditChain } from "@/core/audit/audit-trail";
import { notifyMany } from "@/core/notifications/notify";
import { sendEmail } from "@/lib/email/sender";

// ════════════════════════════════════════════════════════════════
// مهمة دورية: التحقق من سلامة سلسلة سجل التدقيق لكل منظمة
// ════════════════════════════════════════════════════════════════
// verifyAuditChain(organizationId) موجودة أصلاً (audit-trail.ts) وتفحص
// منظمة واحدة عند استدعائها. هذا الملف يضيف الطبقة الناقصة: من يستدعيها،
// لكل المنظمات، وماذا يحصل لو اكتشفت انكساراً — بدل أن تبقى دالة جاهزة
// بلا أي مسار تشغيلي فعلي يستدعيها تلقائياً.
//
// التنبيه عند الانكسار يذهب لمسارين مستقلين عمداً (ليس مساراً واحداً):
//   1) إشعار داخل النظام + إيميل لكل مستخدمي المنظمة بدور admin/super_admin
//      (نفس آلية notify() الموجودة، بدور جديد لا يُنشئ شيئاً جديداً).
//   2) إيميل مباشر لعنوان تنبيه أمني ثابت خارج نظام المستخدمين
//      (SECURITY_ALERT_EMAIL بيئياً) — لأن تلاعباً حقيقياً بسجل التدقيق
//      يعني بالتعريف أن مهاجماً وصل لصلاحية DB owner (موثّق بـ
//      audit-trail.ts)، وهو نفسه يقدر نظرياً يتلاعب بجدول notifications/users
//      لإخفاء التنبيه الداخلي. القناة الثانية لا تعتمد على أي جدول بقاعدة
//      البيانات نفسها.
//
// هذا الفحص O(n) على كامل سجل كل منظمة (موثّق بـ audit-trail.ts) — لذا
// دوري (أسبوعي مثلاً) لا على كل قراءة، تماماً كما طُلب.

export interface AuditIntegrityResult {
  organizationId: string;
  organizationName: string;
  valid: boolean;
  brokenAtRecordId?: string;
  reason?: string;
}

export interface AuditIntegritySummary {
  checkedAt: Date;
  totalOrganizations: number;
  results: AuditIntegrityResult[];
  brokenCount: number;
}

/**
 * يفحص سلسلة التدقيق لكل المنظمات النشطة، ويُرسل تنبيهات فورية لأي منظمة
 * وُجد بها انكسار. يُستدعى من scripts/verify-audit-integrity.ts (cron/يدوي).
 */
export async function runScheduledAuditIntegrityCheck(): Promise<AuditIntegritySummary> {
  const orgs = await db.query.organizations.findMany({
    where: eq(organizations.isActive, true),
    columns: { id: true, name: true, nameAr: true },
  });

  const results: AuditIntegrityResult[] = [];

  for (const org of orgs) {
    const check = await verifyAuditChain(org.id);
    if (check.valid) {
      results.push({ organizationId: org.id, organizationName: org.name, valid: true });
      continue;
    }

    results.push({
      organizationId: org.id,
      organizationName: org.name,
      valid: false,
      brokenAtRecordId: check.brokenAtRecordId,
      reason: check.reason,
    });

    await alertAuditChainBroken(org.id, org.name, check.brokenAtRecordId, check.reason);
  }

  const brokenCount = results.filter((r) => !r.valid).length;

  return {
    checkedAt: new Date(),
    totalOrganizations: orgs.length,
    results,
    brokenCount,
  };
}

async function alertAuditChainBroken(
  organizationId: string,
  organizationName: string,
  brokenAtRecordId: string,
  reason: string,
): Promise<void> {
  const title = "🔴 كسر في سلسلة سجل التدقيق";
  const body = `اكتُشف كسر بسلسلة تجزئة سجل التدقيق للمنظمة "${organizationName}" عند السجل ${brokenAtRecordId}. السبب: ${reason}. هذا مؤشر تلاعب محتمل أو خلل تشغيلي خطير — يتطلب مراجعة فورية.`;

  // 1) تنبيه داخلي + إيميل لكل مسؤولي هذه المنظمة تحديداً
  try {
    const admins = await db.query.users.findMany({
      where: and(
        eq(users.organizationId, organizationId),
        eq(users.isActive, true),
      ),
      columns: { id: true, role: true },
    });
    const adminIds = admins
      .filter((u) => u.role === "super_admin" || u.role === "admin")
      .map((u) => u.id);

    if (adminIds.length > 0) {
      await notifyMany(adminIds, {
        organizationId,
        title,
        titleAr: title,
        body,
        type: "alert",
        sendEmail: true,
        emailSubject: title,
        emailHtml: `<p>${body}</p>`,
      });
    } else {
      console.error(`⚠️  لا يوجد مسؤولون (admin/super_admin) نشطون بالمنظمة ${organizationName} لتنبيههم داخلياً.`);
    }
  } catch (e) {
    console.error("فشل إرسال التنبيه الداخلي لكسر سلسلة التدقيق:", e);
  }

  // 2) إيميل مباشر خارج نظام المستخدمين — لا يعتمد على أي جدول قد يكون
  // نفس المهاجم قادراً على التلاعب به (راجع التعليق أعلى الملف)
  const alertEmail = process.env.SECURITY_ALERT_EMAIL;
  if (alertEmail) {
    try {
      await sendEmail({
        to: alertEmail,
        subject: `[أمن] ${title} — ${organizationName}`,
        html: `<p>${body}</p><p>organizationId: ${organizationId}</p>`,
      });
    } catch (e) {
      console.error("فشل إرسال إيميل التنبيه الأمني المباشر:", e);
    }
  } else {
    console.error("⚠️  SECURITY_ALERT_EMAIL غير مُعرَّف بالبيئة — لن يصل تنبيه خارج نظام المستخدمين. راجع دليل النشر.");
  }
}
