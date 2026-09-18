// ════════════════════════════════════════════════════════════
// مولّد PDF — يُستخدم في API routes لتوليد وتحميل المستندات
// يعتمد على @react-pdf/renderer أو HTML→PDF عبر chromium
// ملاحظة: النظام يستخدم HTML template → blob → تحميل مباشر
// ════════════════════════════════════════════════════════════

export type PayrollPDFData = {
  orgName:        string;
  periodName:     string;
  month:          string;
  year:           number;
  generatedAt:    string;
  lines: Array<{
    empCode:          string;
    employeeName:     string;
    baseSalary:       number;
    totalAllowances:  number;
    totalDeductions:  number;
    grossSalary:      number;
    netSalary:        number;
    daysPresent:      number;
    daysAbsent:       number;
    isPaid:           boolean;
  }>;
  totals: { gross:number; deductions:number; net:number };
};

export type PRPDFData = {
  orgName:      string;
  prCode:       string;
  title:        string;
  status:       string;
  grantName?:   string;
  requestDate:  string;
  requiredDate?: string;
  requestedBy:  string;
  items: Array<{ description:string; unit:string; quantity:number; unitPrice:number; total:number }>;
  totalAmount:  number;
  justification?: string;
  approvalLevels?: Array<{ level:number; levelName:string; status:string }>;
};

export function generatePayrollHTML(data: PayrollPDFData): string {
  const fmt = (n:number) => n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const rows = data.lines.map((l,i) => `
    <tr style="background:${i%2===0?"#f9fafb":"#fff"}">
      <td>${i+1}</td>
      <td style="text-align:right">${l.employeeName}</td>
      <td>${l.empCode}</td>
      <td>${fmt(l.baseSalary)}</td>
      <td style="color:#059669">+${fmt(l.totalAllowances)}</td>
      <td style="color:#dc2626">-${fmt(l.totalDeductions)}</td>
      <td style="font-weight:700">${fmt(l.netSalary)}</td>
      <td>${l.daysPresent}</td>
      <td>${l.daysAbsent}</td>
      <td><span style="padding:2px 8px;border-radius:4px;font-size:11px;background:${l.isPaid?"#d1fae5":"#fef3c7"};color:${l.isPaid?"#065f46":"#92400e"}">${l.isPaid?"مدفوع":"معلق"}</span></td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Cairo',Arial,sans-serif; font-size:12px; color:#111827; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f6e56; padding-bottom:16px; margin-bottom:20px; }
    .org-name { font-size:18px; font-weight:700; color:#0f6e56; }
    .doc-title { font-size:14px; font-weight:600; color:#374151; margin-top:4px; }
    .meta-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; background:#f3f4f6; border-radius:8px; padding:12px; margin-bottom:20px; }
    .meta-item { text-align:center; }
    .meta-label { font-size:10px; color:#6b7280; }
    .meta-value { font-size:13px; font-weight:700; color:#111827; margin-top:2px; }
    table { width:100%; border-collapse:collapse; font-size:11px; }
    th { background:#0f6e56; color:#fff; padding:8px 6px; text-align:center; font-weight:600; }
    td { padding:7px 6px; text-align:center; border-bottom:1px solid #e5e7eb; }
    .totals-row { background:#f0fdf4; font-weight:700; border-top:2px solid #0f6e56; }
    .footer { margin-top:32px; display:grid; grid-template-columns:repeat(3,1fr); gap:20px; text-align:center; }
    .sig-box { border-top:1px solid #9ca3af; padding-top:8px; font-size:11px; color:#6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="org-name">${data.orgName}</div>
      <div class="doc-title">كشف رواتب شهر ${data.month} ${data.year}</div>
    </div>
    <div style="text-align:left;color:#6b7280;font-size:11px">
      <div>${data.periodName}</div>
      <div>${data.generatedAt}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item"><div class="meta-label">عدد الموظفين</div><div class="meta-value">${data.lines.length}</div></div>
    <div class="meta-item"><div class="meta-label">إجمالي الرواتب</div><div class="meta-value" style="color:#0f6e56">${fmt(data.totals.gross)} USD</div></div>
    <div class="meta-item"><div class="meta-label">إجمالي الصافي</div><div class="meta-value" style="color:#0f6e56">${fmt(data.totals.net)} USD</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>الموظف</th><th>الكود</th><th>الأساسي</th>
        <th>البدلات</th><th>الخصومات</th><th>الصافي</th>
        <th>حاضر</th><th>غائب</th><th>الدفع</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr class="totals-row">
        <td colspan="3">المجموع</td>
        <td>—</td>
        <td style="color:#059669">+${fmt(data.totals.gross - data.lines.reduce((s,l)=>s+l.baseSalary,0))}</td>
        <td style="color:#dc2626">-${fmt(data.totals.deductions)}</td>
        <td>${fmt(data.totals.net)}</td>
        <td colspan="3"></td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="sig-box">توقيع مدير الموارد البشرية</div>
    <div class="sig-box">توقيع المدير المالي</div>
    <div class="sig-box">ختم المنظمة</div>
  </div>
</body>
</html>`;
}

export function generatePRHTML(data: PRPDFData): string {
  const fmt = (n:number) => n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
  const STATUS_AR: Record<string,string> = { draft:"مسودة", submitted:"مقدم", approved:"معتمد", done:"منجز", rejected:"مرفوض" };

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Cairo',Arial,sans-serif; font-size:12px; color:#111827; background:#fff; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0f6e56; padding-bottom:16px; margin-bottom:20px; }
    .org-name { font-size:18px; font-weight:700; color:#0f6e56; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; background:#d1fae5; color:#065f46; }
    .info-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:20px; }
    .info-box { background:#f9fafb; border-radius:8px; padding:10px 14px; }
    .info-label { font-size:10px; color:#6b7280; }
    .info-value { font-size:12px; font-weight:600; color:#111827; margin-top:2px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:16px; }
    th { background:#0f6e56; color:#fff; padding:8px; text-align:center; }
    td { padding:7px 8px; border-bottom:1px solid #e5e7eb; text-align:center; }
    .total-row { background:#f0fdf4; font-weight:700; border-top:2px solid #0f6e56; font-size:13px; }
    .section-title { font-size:12px; font-weight:700; color:#0f6e56; margin:16px 0 8px; border-bottom:1px solid #e5e7eb; padding-bottom:4px; }
    .approval-step { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid #f3f4f6; }
    .step-num { width:22px; height:22px; background:#0f6e56; color:#fff; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0; }
    .footer { margin-top:32px; display:grid; grid-template-columns:repeat(3,1fr); gap:20px; text-align:center; }
    .sig-box { border-top:1px solid #9ca3af; padding-top:8px; font-size:11px; color:#6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="org-name">${data.orgName}</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px">طلب شراء — ${data.prCode}</div>
    </div>
    <div style="text-align:left">
      <span class="badge">${STATUS_AR[data.status] ?? data.status}</span>
      <div style="font-size:10px;color:#6b7280;margin-top:6px">${data.requestDate}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box"><div class="info-label">عنوان الطلب</div><div class="info-value">${data.title}</div></div>
    ${data.grantName ? `<div class="info-box"><div class="info-label">المنحة الممولة</div><div class="info-value">${data.grantName}</div></div>` : ""}
    <div class="info-box"><div class="info-label">مقدم الطلب</div><div class="info-value">${data.requestedBy}</div></div>
    ${data.requiredDate ? `<div class="info-box"><div class="info-label">تاريخ الحاجة</div><div class="info-value">${data.requiredDate}</div></div>` : ""}
  </div>

  <div class="section-title">الأصناف المطلوبة</div>
  <table>
    <thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th>الكمية</th><th>السعر التقديري</th><th>الإجمالي</th></tr></thead>
    <tbody>
      ${data.items.map((it,i) => `
        <tr style="background:${i%2===0?"#f9fafb":"#fff"}">
          <td>${i+1}</td>
          <td style="text-align:right">${it.description}</td>
          <td>${it.unit}</td>
          <td>${it.quantity}</td>
          <td>${fmt(it.unitPrice)}</td>
          <td style="font-weight:600">${fmt(it.total)}</td>
        </tr>`).join("")}
    </tbody>
    <tfoot><tr class="total-row"><td colspan="5" style="text-align:right;padding-left:12px">الإجمالي التقديري</td><td>${fmt(data.totalAmount)} USD</td></tr></tfoot>
  </table>

  ${data.justification ? `<div class="section-title">المبرر</div><p style="color:#4b5563;line-height:1.7;background:#f9fafb;padding:10px;border-radius:8px">${data.justification}</p>` : ""}

  ${data.approvalLevels?.length ? `
  <div class="section-title">مراحل الموافقة</div>
  ${data.approvalLevels.map(l => `
    <div class="approval-step">
      <div class="step-num">${l.level}</div>
      <div style="flex:1;font-size:12px">${l.levelName}</div>
      <span style="font-size:11px;padding:2px 8px;border-radius:12px;background:${l.status==="completed"?"#d1fae5":l.status==="current"?"#fef3c7":"#f3f4f6"};color:${l.status==="completed"?"#065f46":l.status==="current"?"#92400e":"#6b7280"}">
        ${l.status==="completed"?"✓ معتمد":l.status==="current"?"⏳ جارٍ":l.status==="rejected"?"✗ مرفوض":"⏸ في الانتظار"}
      </span>
    </div>`).join("")}` : ""}

  <div class="footer">
    <div class="sig-box">توقيع مقدم الطلب</div>
    <div class="sig-box">توقيع مدير المشتريات</div>
    <div class="sig-box">توقيع المدير المالي</div>
  </div>
</body>
</html>`;
}
