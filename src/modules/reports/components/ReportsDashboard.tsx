"use client";
import ExportButton from "@/components/shared/ExportButton";
import type { AppLocale } from "@/lib/preferences";

type MonthlyData  = { label:string; total:number; count:number };
type GrantStatus  = { status:string; count:number; total:number };
type VendorTop    = { name:string; poCount:number; totalValue:number };
type PayrollData  = { label:string; totalNet:number; empCount:number };
type AssetHealth  = { condition:string; count:number; totalValue:number };
type BudgetSum    = { planned:number; spent:number; committed:number };

const fmt = (n:number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : n.toLocaleString();
const COND_AR: Record<string,string> = { new:"جديد", good:"جيد", fair:"مقبول", poor:"سيئ", disposed:"مستهلك" };
const COND_COLOR: Record<string,string> = { new:"#1D9E75", good:"#378ADD", fair:"#EF9F27", poor:"#E07020", disposed:"#E24B4A" };
const STATUS_AR: Record<string,string> = { draft:"مسودة", submitted:"مقدم", approved:"معتمد", active:"نشط", completed:"مكتمل", rejected:"مرفوض" };
const STATUS_COLOR: Record<string,string> = { approved:"#1D9E75", active:"#1D9E75", submitted:"#EF9F27", draft:"#4B5563", completed:"#378ADD", rejected:"#E24B4A" };

function BarChart({ data, maxVal, colorFn, labelKey, valueKey, locale }: { data:any[]; maxVal:number; colorFn:(d:any)=>string; labelKey:string; valueKey:string; locale: AppLocale }) {
  return (
    <div className="space-y-2">
      {data.map((d,i) => (
        <div key={i} className="flex items-center gap-3">
          <span className={`text-[11px] text-[#6B7280] w-24 truncate shrink-0 ${locale === "ar" ? "text-right" : "text-left"}`}>{d[labelKey]}</span>
          <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width:`${(d[valueKey]/maxVal*100).toFixed(1)}%`, background:colorFn(d) }} />
          </div>
          <span className={`text-[11px] font-semibold tabular-nums text-[#9CA3AF] w-16 ${locale === "ar" ? "text-right" : "text-left"}`}>{n_fmt(d[valueKey], locale)}</span>
        </div>
      ))}
    </div>
  );
}

const n_fmt = (n:number, locale: AppLocale) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : n.toLocaleString(locale === "ar" ? "ar-SA" : "en-US");

export default function ReportsDashboard({ monthlyPR, grantsByStatus, topVendors, monthlyPayroll, assetHealth, budgetSummary, locale = "ar" }: {
  monthlyPR:MonthlyData[]; grantsByStatus:GrantStatus[]; topVendors:VendorTop[];
  monthlyPayroll:PayrollData[]; assetHealth:AssetHealth[]; budgetSummary:BudgetSum;
  locale?: AppLocale;
}) {
  const maxPR      = Math.max(...monthlyPR.map(d=>d.total), 1);
  const maxPayroll = Math.max(...monthlyPayroll.map(d=>d.totalNet), 1);
  const maxVendor  = Math.max(...topVendors.map(d=>d.totalValue), 1);
  const totalAssets = assetHealth.reduce((s,a)=>s+a.count,0);
  const spendPct   = budgetSummary.planned > 0 ? (budgetSummary.spent/budgetSummary.planned*100) : 0;
  const remaining  = budgetSummary.planned - budgetSummary.spent - budgetSummary.committed;

  const condLabel = locale === "ar"
    ? { new:"جديد", good:"جيد", fair:"مقبول", poor:"سيئ", disposed:"مستهلك" }
    : { new:"New", good:"Good", fair:"Fair", poor:"Poor", disposed:"Disposed" };
  const statusLabel = locale === "ar"
    ? { draft:"مسودة", submitted:"مقدم", approved:"معتمد", active:"نشط", completed:"مكتمل", rejected:"مرفوض" }
    : { draft:"Draft", submitted:"Submitted", approved:"Approved", active:"Active", completed:"Completed", rejected:"Rejected" };
  const t = locale === "ar"
    ? { orders: "أمر", assetsTotal: "أصل إجمالاً" }
    : { orders: "orders", assetsTotal: "assets total" };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-chart-bar text-[#0F6E56]" />{locale === "ar" ? "التقارير والإحصائيات" : "Reports and analytics"}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{locale === "ar" ? "BI Dashboard — آخر 6 أشهر" : "BI dashboard — last 6 months"}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/reports/budget-vs-actual"
            className="inline-flex items-center gap-1.5 text-[13px] text-[#D1D5DB] bg-[#111827] border border-[#1F2937] hover:border-[#0F6E56] rounded-lg px-3 py-2 transition-colors"
          >
            <i className="ti ti-report-money text-[#0F6E56]" />{locale === "ar" ? "الميزانية مقابل الفعلي حسب المانح" : "Budget vs actual by donor"}
          </a>
          <ExportButton apiPath="/api/export/grants" filename="grants-report" formats={["excel"]} />
        </div>
      </div>

      {/* ملخص الميزانية */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <i className="ti ti-coins text-[#0F6E56]" />{locale === "ar" ? "ملخص الميزانية الكلي" : "Overall budget summary"}
        </h2>
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label:locale === "ar" ? "المبلغ المخطط" : "Planned",  value:budgetSummary.planned,   color:"text-[#D1D5DB]" },
            { label:locale === "ar" ? "المنفق" : "Spent",         value:budgetSummary.spent,     color:"text-[#1D9E75]" },
            { label:locale === "ar" ? "الملتزم" : "Committed",        value:budgetSummary.committed, color:"text-[#EF9F27]" },
            { label:locale === "ar" ? "المتبقي" : "Remaining",        value:remaining,               color:remaining<0?"text-[#E24B4A]":"text-[#D1D5DB]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#161B26] rounded-xl p-3 text-center">
              <p className={`text-xl font-bold tabular-nums ${color}`}>{n_fmt(value, locale)}</p>
              <p className="text-[10px] text-[#4B5563] mt-1">{label} — USD</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#6B7280]">{locale === "ar" ? "نسبة الإنفاق" : "Spend ratio"}</span>
            <span className={`font-semibold ${spendPct>=95?"text-[#E24B4A]":spendPct>=80?"text-[#EF9F27]":"text-[#1D9E75]"}`}>{spendPct.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-[#1F2937] rounded-full overflow-hidden flex">
            <div className="h-full bg-[#0F6E56] rounded-r-full" style={{ width:`${Math.min(budgetSummary.spent/budgetSummary.planned*100,100)}%` }} />
            <div className="h-full bg-[#EF9F27]/60" style={{ width:`${Math.min(budgetSummary.committed/budgetSummary.planned*100,100)}%` }} />
          </div>
          <div className="flex gap-4 text-[10px] text-[#4B5563]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#0F6E56] rounded-full" />{locale === "ar" ? "منفق" : "Spent"}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#EF9F27]/60 rounded-full" />{locale === "ar" ? "ملتزم" : "Committed"}</span>
          </div>
        </div>
      </div>

      {/* الصف الثاني */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* مشتريات شهرية */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ti ti-shopping-cart text-[#EF9F27]" />{locale === "ar" ? "المشتريات الشهرية" : "Monthly procurement"}
          </h2>
          {monthlyPR.length === 0
            ? <p className="text-sm text-[#4B5563] text-center py-8">{locale === "ar" ? "لا توجد بيانات" : "No data"}</p>
            : <BarChart data={monthlyPR} maxVal={maxPR} labelKey="label" valueKey="total" colorFn={()=>"#EF9F27"} locale={locale} />
          }
        </div>

        {/* رواتب شهرية */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ti ti-moneybag text-[#378ADD]" />{locale === "ar" ? "صافي الرواتب الشهري" : "Monthly payroll net"}
          </h2>
          {monthlyPayroll.length === 0
            ? <p className="text-sm text-[#4B5563] text-center py-8">{locale === "ar" ? "لا توجد بيانات" : "No data"}</p>
            : <BarChart data={monthlyPayroll} maxVal={maxPayroll} labelKey="label" valueKey="totalNet" colorFn={()=>"#378ADD"} locale={locale} />
          }
        </div>
      </div>

      {/* الصف الثالث */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* المنح حسب الحالة */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ti ti-heart-handshake text-[#1D9E75]" />{locale === "ar" ? "المنح حسب الحالة" : "Grants by status"}
          </h2>
          <div className="space-y-2.5">
            {grantsByStatus.map(g => {
              const color = STATUS_COLOR[g.status] ?? "#4B5563";
              return (
                <div key={g.status} className="flex items-center justify-between p-2.5 bg-[#161B26] rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background:color }} />
                    <span className="text-xs text-[#9CA3AF]">{statusLabel[g.status as keyof typeof statusLabel] ?? g.status}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-semibold tabular-nums text-white">{g.count}</span>
                    <span className="text-[10px] text-[#4B5563] mr-1.5">{n_fmt(g.total, locale)} USD</span>
                  </div>
                </div>
              );
            })}
            {grantsByStatus.length === 0 && <p className="text-sm text-[#4B5563] text-center py-6">{locale === "ar" ? "لا توجد بيانات" : "No data"}</p>}
          </div>
        </div>

        {/* أفضل الموردين */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ti ti-truck text-[#A855F7]" />{locale === "ar" ? "أفضل الموردين" : "Top vendors"}
          </h2>
          {topVendors.length === 0
            ? <p className="text-sm text-[#4B5563] text-center py-6">{locale === "ar" ? "لا توجد بيانات" : "No data"}</p>
            : <div className="space-y-2">
                {topVendors.map((v,i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-[#161B26] rounded-xl">
                    <span className={`text-sm font-bold w-5 ${i===0?"text-[#EF9F27]":i===1?"text-[#9CA3AF]":i===2?"text-[#E07020]":"text-[#4B5563]"}`}>
                      {i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
                    </span>
                    <span className="text-xs text-[#D1D5DB] flex-1 truncate">{v.name}</span>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-[#A855F7]">{n_fmt(v.totalValue, locale)}</p>
                      <p className="text-[10px] text-[#4B5563]">{v.poCount} {t.orders}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* صحة الأصول */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <i className="ti ti-building text-[#EF9F27]" />{locale === "ar" ? "صحة الأصول الثابتة" : "Fixed asset health"}
          </h2>
          {assetHealth.length === 0
            ? <p className="text-sm text-[#4B5563] text-center py-6">{locale === "ar" ? "لا توجد بيانات" : "No data"}</p>
            : <div className="space-y-3">
                {assetHealth.map(a => {
                  const color = COND_COLOR[a.condition] ?? "#4B5563";
                  const pct   = totalAssets > 0 ? (a.count/totalAssets*100) : 0;
                  return (
                    <div key={a.condition}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[#9CA3AF]">{condLabel[a.condition as keyof typeof condLabel] ?? a.condition}</span>
                        <span className="text-xs font-semibold" style={{ color }}>{a.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-[#1F2937] text-center">
                  <p className="text-xs text-[#4B5563]">{totalAssets} {t.assetsTotal}</p>
                </div>
              </div>
          }
        </div>
      </div>
    </div>
  );
}
