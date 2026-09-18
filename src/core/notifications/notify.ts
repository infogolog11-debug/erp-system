// ════════════════════════════════════════════════════════════
// نظام الإشعارات المتكامل — DB + Email
// يُخزن في قاعدة البيانات + يرسل إيميل إذا كان Email متاحاً
// ════════════════════════════════════════════════════════════
import { db }         from "@/db";
import { notifications, users } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { sendEmail }  from "@/lib/email/sender";

interface NotifyParams {
  organizationId: string;
  userId:         string;
  title:          string;
  titleAr?:       string;
  body:           string;
  type:           "approval"|"alert"|"info"|"warning"|"success";
  link?:          string;
  // إذا صحيح: يرسل إيميل أيضاً
  sendEmail?:     boolean;
  emailSubject?:  string;
  emailHtml?:     string;
}

export async function notify(p: NotifyParams) {
  try {
    // 1. تخزين في DB
    await db.insert(notifications).values({
      organizationId: p.organizationId,
      userId:         p.userId,
      title:          p.title,
      titleAr:        p.titleAr,
      body:           p.body,
      type:           p.type,
      link:           p.link,
    });

    // 2. إرسال إيميل إذا طُلب
    if (p.sendEmail && p.emailHtml) {
      const user = await db.query.users.findFirst({ where: eq(users.id, p.userId) });
      if (user?.email) {
        await sendEmail({
          to:      user.email,
          subject: p.emailSubject ?? p.title,
          html:    p.emailHtml,
        });
      }
    }
  } catch (e) { console.error("Notification failed:", e); }
}

export async function notifyMany(
  userIds: string[],
  params:  Omit<NotifyParams,"userId">,
) {
  if (!userIds.length) return;
  try {
    // تخزين جميع الإشعارات دفعةً
    await db.insert(notifications).values(
      userIds.map(userId => ({
        organizationId: params.organizationId,
        userId,
        title:          params.title,
        titleAr:        params.titleAr,
        body:           params.body,
        type:           params.type,
        link:           params.link,
      }))
    );

    // إرسال إيميل لكل مستخدم إذا طُلب
    if (params.sendEmail && params.emailHtml) {
      // إصلاح (بند "51 findMany غير مُراجَع" بSECURITY_NOTES): كان هذا يجلب
      // *كل* مستخدمي النظام بلا أي where (عبر كل المنظمات) في كل استدعاء
      // إشعار جماعي واحد، ثم يُصفّي بـJS — استعلام غير محدود فعلياً ينمو
      // مع كل مستخدم جديد بأي منظمة على النظام. الإصلاح: تحديد الاستعلام
      // بـuserIds المطلوبين فقط عبر inArray.
      const targetUsers = await db.query.users.findMany({ where: inArray(users.id, userIds) });
      for (const u of targetUsers) {
        if (!u.email) continue;
        await sendEmail({
          to:      u.email,
          subject: params.emailSubject ?? params.title,
          html:    params.emailHtml,
        }).catch(e => console.error(`Email failed for ${u.email}:`, e));
      }
    }
  } catch (e) { console.error("Bulk notification failed:", e); }
}

// ── إشعار موافقة مع إيميل ────────────────────────────────────────────────
export async function notifyApprovalRequired(data: {
  organizationId: string; approverId: string; approverName: string;
  requesterName:string; recordType:string; recordTitle:string;
  amount:number; level:number; levelName:string; slaHours:number;
  link:string; orgName?:string;
}) {
  const { approvalRequestEmail } = await import("@/lib/email/templates");
  const { subject, html } = approvalRequestEmail(data);
  await notify({
    organizationId: data.organizationId,
    userId:         data.approverId,
    title:          `موافقة مطلوبة: ${data.recordTitle}`,
    titleAr:        `موافقة مطلوبة — المرحلة ${data.level}`,
    body:           `${data.levelName} · ${data.amount.toLocaleString()} USD`,
    type:           "approval",
    link:           data.link,
    sendEmail:      true,
    emailSubject:   subject,
    emailHtml:      html,
  });
}

// ── إشعار قرار الموافقة ───────────────────────────────────────────────────
export async function notifyApprovalDecision(data: {
  organizationId:string; requesterId:string;
  requesterName:string; recordTitle:string;
  decision:"approved"|"rejected"|"returned";
  decidedBy:string; comments?:string;
  link:string; orgName?:string;
}) {
  const { approvalDecisionEmail } = await import("@/lib/email/templates");
  const { subject, html } = approvalDecisionEmail(data);
  const label = data.decision==="approved" ? "تم اعتماد طلبك" : data.decision==="rejected" ? "تم رفض طلبك" : "أُعيد طلبك للمراجعة";
  await notify({
    organizationId: data.organizationId,
    userId:         data.requesterId,
    title:          label,
    body:           data.recordTitle,
    type:           data.decision==="approved" ? "success" : data.decision==="rejected" ? "alert" : "warning",
    link:           data.link,
    sendEmail:      true,
    emailSubject:   subject,
    emailHtml:      html,
  });
}

// ── إشعار تحذير الميزانية مع إيميل ──────────────────────────────────────
export async function notifyBudgetWarning(data: {
  organizationId:string; recipientIds:string[];
  recipientName:string; lineName:string;
  utilizationPct:number; remainingAmount:number;
  grantName:string; warningLevel:string;
  link:string; orgName?:string;
}) {
  const { budgetWarningEmail } = await import("@/lib/email/templates");
  const { subject, html } = budgetWarningEmail({ ...data });
  const icon  = data.warningLevel==="blocked"?"🔴":data.warningLevel==="critical"?"🟠":"🟡";
  await notifyMany(data.recipientIds, {
    organizationId: data.organizationId,
    title:          `${icon} تحذير ميزانية: ${data.lineName}`,
    body:           `${data.utilizationPct.toFixed(1)}% مستخدم`,
    type:           data.warningLevel==="blocked" ? "alert" : "warning",
    link:           data.link,
    sendEmail:      true,
    emailSubject:   subject,
    emailHtml:      html,
  });
}
