// src/modules/hr/components/PayrollRunList.tsx
import Link from "next/link";
import type { AppLocale } from "@/lib/preferences";

const STATUS_STYLE: Record<string,{bg:string;text:string}> = {
  draft:    { bg:"bg-[#161B26]",  text:"text-[#6B7280]" },
  approved: { bg:"bg-[#001A12]",  text:"text-[#1D9E75]" },
  done:     { bg:"bg-[#0A1628]",  text:"text-[#378ADD]" },
};

const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { draft:"مسودة", approved:"معتمد", done:"مدفوع" },
  en: { draft:"Draft", approved:"Approved", done:"Paid" },
};

const MONTHS: Record<AppLocale, string[]> = {
  ar: ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
  en: ["","January","February","March","April","May","June","July","August","September","October","November","December"],
};

type RunDisplay = { id:string; periodName:string; month:number; year:number; status:string; totalNet?:string|number|null; totalGross?:string|number|null; totalDeductions?:string|number|null; employeeCount?:number|null };

export default function PayrollRunList({ runs, locale = "ar" }: { runs: RunDisplay[]; locale?: AppLocale }) {
  const monthNames = MONTHS[locale];
  const localeTag  = locale === "ar" ? "ar-SA" : "en-US";
  const headers    = locale === "ar"
    ? ["الفترة","إجمالي المرتبات","الخصومات","الصافي","الحالة",""]
    : ["Period","Gross total","Deductions","Net","Status",""];

  if (runs.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-calculator text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">{locale === "ar" ? "لا توجد كشوف رواتب بعد" : "No payroll runs yet"}</p>
    </div>
  );
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {headers.map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const st = STATUS_STYLE[run.status] ?? STATUS_STYLE.draft;
            const statusLabel = STATUS_LABEL[locale][run.status] ?? STATUS_LABEL[locale].draft;
            return (
              <tr key={run.id} className={`hover:bg-[#161B26] transition-colors ${i < runs.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3 font-medium text-[#D1D5DB]">
                  {monthNames[run.month]} {run.year}
                </td>
                <td className="px-4 py-3 text-[#6B7280] tabular-nums text-xs">
                  {run.totalGross ? Number(run.totalGross).toLocaleString(localeTag) : "—"}
                </td>
                <td className="px-4 py-3 text-[#E24B4A] tabular-nums text-xs">
                  {run.totalDeductions ? `(${Number(run.totalDeductions).toLocaleString(localeTag)})` : "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-[#1D9E75] tabular-nums">
                  {run.totalNet ? Number(run.totalNet).toLocaleString(localeTag) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>{statusLabel}</span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/hr/payroll/${run.id}`} className="text-[#4B5563] hover:text-[#0F6E56] transition-colors">
                    <i className={`ti ti-chevron-${locale === "ar" ? "left" : "right"} text-[16px]`} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
