// ════════════════════════════════════════════════════════════
// قوالب البريد الإلكتروني — HTML جاهز لكل نوع إشعار
// ════════════════════════════════════════════════════════════

const BASE = (content:string, orgName:string="منظمتي") => `
<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;background:#f3f4f6;color:#111827;direction:rtl}
  .wrap{max-width:580px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .header{background:#0f6e56;padding:24px 32px;color:#fff}
  .header h1{font-size:18px;font-weight:700}
  .header p{font-size:12px;opacity:.8;margin-top:4px}
  .body{padding:28px 32px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;margin-bottom:16px}
  .info-box{background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border-right:4px solid #0f6e56}
  .btn{display:inline-block;background:#0f6e56;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:20px}
  .footer{background:#f9fafb;padding:16px 32px;text-align:center;font-size:11px;color:#9ca3af}
</style></head>
<body><div class="wrap">
  <div class="header"><h1>${orgName}</h1><p>نظام إدارة الموارد المؤسسية</p></div>
  <div class="body">${content}</div>
  <div class="footer">هذا بريد تلقائي من نظام ERP — لا ترد على هذا البريد<br/>© ${new Date().getFullYear()} ${orgName}</div>
</div></body></html>`;

// ── قالب: طلب موافقة ──────────────────────────────────────────────────────
export function approvalRequestEmail(data: {
  approverName: string; requesterName: string; recordType:string;
  recordTitle:string; amount:number; level:number; levelName:string;
  slaHours:number; link:string; orgName?:string;
}) {
  const fmt = (n:number) => n.toLocaleString("en-US", { maximumFractionDigits:0 });
  const content = `
    <div class="badge" style="background:#fef3c7;color:#92400e">⏳ طلب موافقة — المرحلة ${data.level}</div>
    <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">مرحباً ${data.approverName}</h2>
    <p style="color:#4b5563;line-height:1.7">يحتاج الطلب التالي موافقتك في إطار المرحلة <strong>${data.levelName}</strong>:</p>
    <div class="info-box">
      <p style="font-size:13px;font-weight:700;margin-bottom:8px">${data.recordTitle}</p>
      <table style="width:100%;font-size:12px;color:#6b7280">
        <tr><td>مقدم الطلب</td><td style="font-weight:600;color:#111827">${data.requesterName}</td></tr>
        <tr><td>نوع الطلب</td><td style="font-weight:600;color:#111827">${data.recordType}</td></tr>
        <tr><td>القيمة</td><td style="font-weight:600;color:#0f6e56">${fmt(data.amount)} USD</td></tr>
        <tr><td>مهلة الرد</td><td style="font-weight:600;color:#ef9f27">${data.slaHours} ساعة</td></tr>
      </table>
    </div>
    <a href="${data.link}" class="btn">🔍 مراجعة الطلب والرد</a>`;
  return { subject:`[موافقة مطلوبة] ${data.recordTitle} — المرحلة ${data.level}`, html:BASE(content, data.orgName) };
}

// ── قالب: تحذير ميزانية ───────────────────────────────────────────────────
export function budgetWarningEmail(data: {
  recipientName:string; lineName:string; utilizationPct:number;
  remainingAmount:number; grantName:string; warningLevel:string;
  link:string; orgName?:string;
}) {
  const isBlocked = data.warningLevel === "blocked";
  const icon   = isBlocked ? "🔴" : data.warningLevel === "critical" ? "🟠" : "🟡";
  const color  = isBlocked ? "#dc2626" : data.warningLevel === "critical" ? "#ea580c" : "#d97706";
  const label  = isBlocked ? "ميزانية مستنفدة" : data.warningLevel === "critical" ? "تحذير حرج" : "تنبيه ميزانية";
  const content = `
    <div class="badge" style="background:${isBlocked?"#fee2e2":"#fef3c7"};color:${color}">${icon} ${label}</div>
    <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">مرحباً ${data.recipientName}</h2>
    <div class="info-box" style="border-right-color:${color}">
      <p style="font-size:13px;font-weight:700;color:${color};margin-bottom:8px">${data.lineName}</p>
      <p style="font-size:24px;font-weight:700;color:${color}">${data.utilizationPct.toFixed(1)}%</p>
      <p style="font-size:12px;color:#6b7280;margin-top:4px">نسبة الاستخدام في ${data.grantName}</p>
      ${!isBlocked ? `<p style="margin-top:8px;font-size:12px">المتبقي: <strong>${data.remainingAmount.toLocaleString()} USD</strong></p>` : ""}
      ${isBlocked ? `<p style="margin-top:8px;font-size:12px;color:${color}"><strong>⛔ الطلبات الجديدة على هذا البند محجوبة تلقائياً</strong></p>` : ""}
    </div>
    <a href="${data.link}" class="btn">📊 مراجعة الميزانية</a>`;
  return { subject:`${icon} ${label}: ${data.lineName} — ${data.utilizationPct.toFixed(0)}%`, html:BASE(content, data.orgName) };
}

// ── قالب: اعتماد / رفض طلب ───────────────────────────────────────────────
export function approvalDecisionEmail(data: {
  requesterName:string; recordTitle:string; decision:"approved"|"rejected"|"returned";
  decidedBy:string; comments?:string; link:string; orgName?:string;
}) {
  const isApproved = data.decision === "approved";
  const isRejected = data.decision === "rejected";
  const icon  = isApproved ? "✅" : isRejected ? "❌" : "↩️";
  const label = isApproved ? "تم اعتماد طلبك" : isRejected ? "تم رفض طلبك" : "أُعيد طلبك للمراجعة";
  const color = isApproved ? "#059669" : isRejected ? "#dc2626" : "#d97706";
  const content = `
    <div class="badge" style="background:${isApproved?"#d1fae5":isRejected?"#fee2e2":"#fef3c7"};color:${color}">${icon} ${label}</div>
    <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">مرحباً ${data.requesterName}</h2>
    <div class="info-box" style="border-right-color:${color}">
      <p style="font-size:13px;font-weight:700;margin-bottom:8px">${data.recordTitle}</p>
      <p style="font-size:12px;color:#6b7280">القرار من: <strong>${data.decidedBy}</strong></p>
      ${data.comments ? `<p style="margin-top:8px;font-size:12px;background:#fff;padding:8px;border-radius:6px;border:1px solid #e5e7eb">"${data.comments}"</p>` : ""}
    </div>
    <a href="${data.link}" class="btn">📋 عرض الطلب</a>`;
  return { subject:`${icon} ${label}: ${data.recordTitle}`, html:BASE(content, data.orgName) };
}

// ── قالب: تذكير الرواتب ──────────────────────────────────────────────────
export function payrollReminderEmail(data: {
  recipientName:string; month:string; year:number;
  employeeCount:number; link:string; orgName?:string;
}) {
  const content = `
    <div class="badge" style="background:#ede9fe;color:#7c3aed">📅 تذكير معالجة الرواتب</div>
    <h2 style="font-size:16px;font-weight:700;margin-bottom:8px">مرحباً ${data.recipientName}</h2>
    <p style="color:#4b5563;line-height:1.7">حان موعد معالجة رواتب شهر <strong>${data.month} ${data.year}</strong></p>
    <div class="info-box">
      <p style="font-size:13px">عدد الموظفين: <strong>${data.employeeCount}</strong></p>
      <p style="font-size:12px;color:#6b7280;margin-top:4px">يرجى معالجة الكشف واعتماده قبل نهاية الشهر</p>
    </div>
    <a href="${data.link}" class="btn">💰 معالجة كشف الرواتب</a>`;
  return { subject:`📅 تذكير: رواتب ${data.month} ${data.year} بانتظار المعالجة`, html:BASE(content, data.orgName) };
}
