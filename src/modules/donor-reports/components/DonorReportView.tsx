"use client";
import { useRouter } from "next/navigation";

const TEMPLATE_LABEL: Record<string,string> = {
  usaid_sf425: "USAID — SF-425 (Federal Financial Report)",
  echo_single_form: "ECHO — Single Form (Financial Annex)",
  unhcr_ipr: "UNHCR — IPR (Implementing Partner Report)",
  generic: "تقرير عام",
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

export default function DonorReportView({ report, template, donorName, grantId, availableTemplates }: {
  report: any; template: string; donorName: string; grantId: string; availableTemplates: string[];
}) {
  const router = useRouter();

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <i className="ti ti-file-report text-[#0F6E56]" />تقرير المانح — {donorName}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">{report ? TEMPLATE_LABEL[report.template] : "—"}</p>
        </div>
        <select
          value={template}
          onChange={e => router.push(`/reports/donor/${grantId}?template=${e.target.value}`)}
          className="bg-[#111827] border border-[#1F2937] text-[13px] text-[#D1D5DB] rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-[#0F6E56]"
        >
          {availableTemplates.map(t => <option key={t} value={t}>{TEMPLATE_LABEL[t]}</option>)}
        </select>
      </div>

      {!report && (
        <p className="text-center text-[13px] text-[#6B7280] py-10">اختر نموذجاً لعرض التقرير</p>
      )}

      {report?.template === "usaid_sf425" && (
        <>
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1F2937]"><h2 className="text-sm font-semibold text-white">القسم 10 — الملخص المالي الفيدرالي</h2></div>
            <LineItem label="أ. المقبوضات النقدية" value={report.line10.a_cashReceipts} currency={report.grant.currencyCode} />
            <LineItem label="ب. المصروفات النقدية" value={report.line10.b_cashDisbursements} currency={report.grant.currencyCode} />
            <LineItem label="ج. الرصيد النقدي المتاح" value={report.line10.c_cashOnHand} currency={report.grant.currencyCode} />
            <LineItem label="د. إجمالي التمويل الفيدرالي المعتمد" value={report.line10.d_totalFederalAuthorized} currency={report.grant.currencyCode} highlight />
            <LineItem label="هـ. حصة النفقات الفيدرالية" value={report.line10.e_federalShareExpenditures} currency={report.grant.currencyCode} />
            <LineItem label="و. الالتزامات غير المصفّاة" value={report.line10.f_federalShareUnliquidatedObligations} currency={report.grant.currencyCode} />
            <LineItem label="ز. إجمالي الحصة الفيدرالية (هـ+و)" value={report.line10.g_totalFederalShare} currency={report.grant.currencyCode} highlight />
            <LineItem label="ح. الرصيد غير المُلتزَم به (د-ز)" value={report.line10.h_unobligatedBalance} currency={report.grant.currencyCode} highlight />
            <LineItem label="ط. حصة المستفيد" value={report.line10.i_totalRecipientShare} currency={report.grant.currencyCode} />
            <LineItem label="ي. دخل البرنامج" value={report.line10.j_programIncome} currency={report.grant.currencyCode} />
          </div>
          <Table
            headers={["الفئة","المخطط","المنفق","الملتزم","المتبقي"]}
            rows={report.byCategory.map((c:any)=>[c.category,c.planned,c.spent,c.committed,c.remaining])}
          />
        </>
      )}

      {report?.template === "echo_single_form" && (
        <>
          <Table
            headers={["بند الميزانية","الفئة","الموازنة المعتمدة","التكلفة الفعلية","الرصيد","% التنفيذ"]}
            rows={report.rows.map((r:any)=>[r.budgetLine,r.category,r.budgetApproved,r.actualCostToDate,r.balance,`${r.implementationPct.toFixed(1)}%`])}
          />
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <LineItem label="إجمالي الموازنة المعتمدة" value={report.totals.budgetApproved} currency={report.grant.currencyCode} highlight />
            <LineItem label="إجمالي التكلفة الفعلية" value={report.totals.actualCostToDate} currency={report.grant.currencyCode} highlight />
            <div className="flex items-center justify-between py-2.5 px-4">
              <span className="text-[13px] text-white font-medium">نسبة التنفيذ الكلية</span>
              <span className="text-[13px] text-white font-semibold">{report.totals.implementationPct.toFixed(1)}%</span>
            </div>
          </div>
        </>
      )}

      {report?.template === "unhcr_ipr" && (
        <>
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3">قسم الإنجاز — Achievement Against Targets</h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">المستفيدون المستهدفون</p>
                <p className="text-lg font-semibold text-white">{report.achievement.beneficiariesTargeted}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">المستفيدون الموثّقون فعلياً</p>
                <p className="text-lg font-semibold text-white">{report.achievement.beneficiariesReached}</p>
              </div>
              <div className="bg-[#111827] rounded-xl p-3">
                <p className="text-[11px] text-[#6B7280]">نسبة الإنجاز</p>
                <p className="text-lg font-semibold text-[#1D9E75]">{report.achievement.achievementPct.toFixed(1)}%</p>
              </div>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-3">
              عدد التوزيعات: {report.achievement.distributionsCount} — القيمة النقدية الموزَّعة: {fmt(report.achievement.totalDistributionValue)} {report.grant.currencyCode}
            </p>
          </div>
          <Table
            headers={["بند الميزانية","الفئة","المخطط","الفعلي","الفرق","% الاستخدام"]}
            rows={report.financial.map((f:any)=>[f.budgetLine,f.category,f.planned,f.expenditure,f.variance,`${f.utilizationPct.toFixed(1)}%`])}
          />
        </>
      )}
    </div>
  );
}
