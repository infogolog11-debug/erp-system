"use client";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/preferences";

const TEMPLATE_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    usaid_sf425: "USAID — SF-425 (Federal Financial Report)",
    echo_single_form: "ECHO — Single Form (Financial Annex)",
    unhcr_ipr: "UNHCR — IPR (Implementing Partner Report)",
    generic: "تقرير عام",
  },
  en: {
    usaid_sf425: "USAID — SF-425 (Federal Financial Report)",
    echo_single_form: "ECHO — Single Form (Financial Annex)",
    unhcr_ipr: "UNHCR — IPR (Implementing Partner Report)",
    generic: "Generic report",
  },
};

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function Table({ headers, rows }: { headers: string[]; rows: (string|number)[][] }) {
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[#1F2937]">
          {headers.map(h => <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i} className={`border-b border-[#1F2937] hover:bg-[#161B26] ${i===rows.length-1?"border-none":""}`}>
              {r.map((c,j) => <td key={j} className="px-4 py-3 text-[13px] text-[#D1D5DB] tabular-nums">{typeof c === "number" ? fmt(c) : c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LineItem({ label, value, currency, highlight }: { label:string; value:number; currency:string; highlight?:boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 px-4 border-b border-[#1F2937] last:border-none ${highlight?"bg-[#111827]":""}`}>
      <span className={`text-[13px] ${highlight?"text-white font-medium":"text-[#9CA3AF]"}`}>{label}</span>
      <span className={`text-[13px] tabular-nums ${highlight?"text-white font-semibold":"text-[#D1D5DB]"}`}>{fmt(value)} {currency}</span>
    </div>
  );
}

export default function DonorReportView({ report, template, donorName, grantId, availableTemplates, locale = "ar" }: {
  report: any; template: string; donorName: string; grantId: string; availableTemplates: string[]; locale?: AppLocale;
}) {
  const router = useRouter();
  const isAr = locale === "ar";
  const templateLabel = TEMPLATE_LABEL[locale] ?? TEMPLATE_LABEL.ar;
  const t = isAr ? {
    title: `تقرير المانح — ${donorName}`,
    selectTemplate: "اختر نموذجاً لعرض التقرير",
    sf425Section: "القسم 10 — الملخص المالي الفيدرالي",
    sf425a: "أ. المقبوضات النقدية",
    sf425b: "ب. المصروفات النقدية",
    sf425c: "ج. الرصيد النقدي المتاح",
    sf425d: "د. إجمالي التمويل الفيدرالي المعتمد",
    sf425e: "هـ. حصة النفقات الفيدرالية",
    sf425f: "و. الالتزامات غير المصفّاة",
    sf425g: "ز. إجمالي الحصة الفيدرالية (هـ+و)",
    sf425h: "ح. الرصيد غير المُلتزَم به (د-ز)",
    sf425i: "ط. حصة المستفيد",
    sf425j: "ي. دخل البرنامج",
    thCategory: "الفئة", thPlanned: "المخطط", thSpent: "المنفق", thCommitted: "الملتزم", thRemaining: "المتبقي",
    thBudgetLine: "بند الميزانية", thApprovedBudget: "الموازنة المعتمدة", thActualCost: "التكلفة الفعلية", thBalance: "الرصيد", thImplementationPct: "% التنفيذ",
    totalApprovedBudget: "إجمالي الموازنة المعتمدة",
    totalActualCost: "إجمالي التكلفة الفعلية",
    overallImplementation: "نسبة التنفيذ الكلية",
    achievementSection: "قسم الإنجاز — Achievement Against Targets",
    beneficiariesTargeted: "المستفيدون المستهدفون",
    beneficiariesReached: "المستفيدون الموثّقون فعلياً",
    achievementPct: "نسبة الإنجاز",
    distributionsLine: (count: number, value: string) => `عدد التوزيعات: ${count} — القيمة النقدية الموزَّعة: ${value}`,
    thActual: "الفعلي", thVariance: "الفرق", thUtilizationPct: "% الاستخدام",
  } : {
    title: `Donor report — ${donorName}`,
    selectTemplate: "Select a template to view the report",
    sf425Section: "Section 10 — Federal Financial Summary",
    sf425a: "a. Cash receipts",
    sf425b: "b. Cash disbursements",
    sf425c: "c. Cash on hand",
    sf425d: "d. Total federal funds authorized",
    sf425e: "e. Federal share of expenditures",
    sf425f: "f. Federal share of unliquidated obligations",
    sf425g: "g. Total federal share (e+f)",
    sf425h: "h. Unobligated balance (d-g)",
    sf425i: "i. Total recipient share",
    sf425j: "j. Program income",
    thCategory: "Category", thPlanned: "Planned", thSpent: "Spent", thCommitted: "Committed", thRemaining: "Remaining",
    thBudgetLine: "Budget line", thApprovedBudget: "Approved budget", thActualCost: "Actual cost", thBalance: "Balance", thImplementationPct: "% Spent",
    totalApprovedBudget: "Total approved budget",
    totalActualCost: "Total actual cost",
    overallImplementation: "Overall implementation rate",
    achievementSection: "Achievement section — Achievement Against Targets",
    beneficiariesTargeted: "Beneficiaries targeted",
    beneficiariesReached: "Beneficiaries actually reached",
    achievementPct: "Achievement rate",
    distributionsLine: (count: number, value: string) => `Distributions count: ${count} — Distributed cash value: ${value}`,
    thActual: "Actual", thVariance: "Variance", thUtilizationPct: "% Utilization",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <i className="ti ti-file-report text-[#0F6E56]" />{t.title}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">{report ? templateLabel[report.template] : "—"}</p>
        </div>
        <select
          value={template}
          onChange={e => router.push(`/reports/donor/${grantId}?template=${e.target.value}`)}
          className="bg-[#111827] border border-[#1F2937] text-[13px] text-[#D1D5DB] rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-[#0F6E56]"
        >
          {availableTemplates.map(o => <option key={o} value={o}>{templateLabel[o]}</option>)}
        </select>
      </div>

      {!report && (
        <p className="text-center text-[13px] text-[#6B7280] py-10">{t.selectTemplate}</p>
      )}

      {report?.template === "usaid_sf425" && (
        <>
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1F2937]"><h2 className="text-sm font-semibold text-white">{t.sf425Section}</h2></div>
            <LineItem label={t.sf425a} value={report.line10.a_cashReceipts} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425b} value={report.line10.b_cashDisbursements} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425c} value={report.line10.c_cashOnHand} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425d} value={report.line10.d_totalFederalAuthorized} currency={report.grant.currencyCode} highlight />
            <LineItem label={t.sf425e} value={report.line10.e_federalShareExpenditures} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425f} value={report.line10.f_federalShareUnliquidatedObligations} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425g} value={report.line10.g_totalFederalShare} currency={report.grant.currencyCode} highlight />
            <LineItem label={t.sf425h} value={report.line10.h_unobligatedBalance} currency={report.grant.currencyCode} highlight />
            <LineItem label={t.sf425i} value={report.line10.i_totalRecipientShare} currency={report.grant.currencyCode} />
            <LineItem label={t.sf425j} value={report.line10.j_programIncome} currency={report.grant.currencyCode} />
          </div>
          <Table
            headers={[t.thCategory,t.thPlanned,t.thSpent,t.thCommitted,t.thRemaining]}
            rows={report.byCategory.map((c:any)=>[c.category,c.planned,c.spent,c.committed,c.remaining])}
          />
        </>
      )}

      {report?.template === "echo_single_form" && (
        <>
          <Table
            headers={[t.thBudgetLine,t.thCategory,t.thApprovedBudget,t.thActualCost,t.thBalance,t.thImplementationPct]}
            rows={report.rows.map((r:any)=>[r.budgetLine,r.category,r.budgetApproved,r.actualCostToDate,r.balance,`${r.implementationPct.toFixed(1)}%`])}
          />
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <LineItem label={t.totalApprovedBudget} value={report.totals.budgetApproved} currency={report.grant.currencyCode} highlight />
            <LineItem label={t.totalActualCost} value={report.totals.actualCostToDate} currency={report.grant.currencyCode} highlight />
            <div className="flex items-center justify-between py-2.5 px-4">
              <span className="text-[13px] text-white font-medium">{t.overallImplementation}</span>
              <span className="text-[13px] text-white font-semibold">{report.totals.implementationPct.toFixed(1)}%</span>
            </div>
          </div>
        </>
      )}

      {report?.template === "unhcr_ipr" && (
        <>
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">{t.achievementSection}</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">{t.beneficiariesTargeted}</p>
                <p className="text-lg font-semibold text-white">{report.achievement.beneficiariesTargeted}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">{t.beneficiariesReached}</p>
                <p className="text-lg font-semibold text-white">{report.achievement.beneficiariesReached}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">{t.achievementPct}</p>
                <p className="text-lg font-semibold text-[#1D9E75]">{report.achievement.achievementPct.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-3">
              {t.distributionsLine(report.achievement.distributionsCount, `${fmt(report.achievement.totalDistributionValue)} ${report.grant.currencyCode}`)}
            </p>
          </div>
          <Table
            headers={[t.thBudgetLine,t.thCategory,t.thPlanned,t.thActual,t.thVariance,t.thUtilizationPct]}
            rows={report.financial.map((f:any)=>[f.budgetLine,f.category,f.planned,f.expenditure,f.variance,`${f.utilizationPct.toFixed(1)}%`])}
          />
        </>
      )}
    </div>
  );
}
