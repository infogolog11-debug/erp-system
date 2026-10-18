import { auth }    from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db }      from "@/db";
import { payrollRuns, payrollLines, employees } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link        from "next/link";
import type { AppLocale } from "@/lib/preferences";
import { getRequestPreferences } from "@/lib/preferences";
import NewPayrollButton from "@/modules/hr/components/NewPayrollButton";
import PayrollAdjustmentsPanel from "@/modules/hr/components/PayrollAdjustmentsPanel";
import { listPayrollAdjustments } from "@/modules/hr/actions";

export default async function PayrollPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  const role    = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "hr", role);
  if (!canView(__perm)) redirect("/");

  const prefs = await getRequestPreferences();
  const isAr  = prefs.locale === "ar";

  const runs = await db.query.payrollRuns.findMany({
    where: eq(payrollRuns.organizationId, orgId),
    orderBy: [desc(payrollRuns.year), desc(payrollRuns.month)],
    limit: 12,
  });

  // ── الدورة القادمة (اللي لسه ما تعالجت) — هنا تُدار البونصات/الخصومات ──
  const now = new Date();
  const nextMonth = now.getMonth() + 1;
  const nextYear  = now.getFullYear();
  const [activeEmployees, upcomingAdjustments] = await Promise.all([
    db.query.employees.findMany({
      where: and(eq(employees.organizationId, orgId), eq(employees.isActive, true)),
      columns: { id:true, firstName:true, lastName:true },
    }),
    listPayrollAdjustments(orgId, nextMonth, nextYear),
  ]);

  const STATUS_STYLE: Record<string,{ color:string; bg:string; border:string }> = {
    draft:      { color:"text-[#4B5563]",  bg:"bg-[#161B26]",  border:"border-[#2D3748]" },
    processing: { color:"text-[#EF9F27]",  bg:"bg-[#1A1400]",  border:"border-[#3D2E00]" },
    approved:   { color:"text-[#378ADD]",  bg:"bg-[#0A1628]",  border:"border-[#1A3060]" },
    paid:       { color:"text-[#1D9E75]",  bg:"bg-[#001A12]",  border:"border-[#0F3D28]" },
  };

  const STATUS_LABELS: Record<AppLocale, Record<string,string>> = {
    ar: { draft:"مسودة", processing:"قيد المعالجة", approved:"معتمد", paid:"مدفوع" },
    en: { draft:"Draft",  processing:"Processing",      approved:"Approved", paid:"Paid" },
  };

  const t = isAr
    ? {
        title:    "كشوف الرواتب",
        subtitle: "معالجة واعتماد الرواتب الشهرية",
        empty:    "لا توجد كشوف رواتب بعد",
        emptyHint:'اضغط "معالجة كشف جديد" للبدء',
        total:    "الإجمالي",
        deductions:"الخصومات",
        net:      "الصافي",
        employees:(n:number)=>`${n} موظف`,
        viewDetails:"عرض التفاصيل",
      }
    : {
        title:    "Payroll Runs",
        subtitle: "Process and approve monthly payroll",
        empty:    "No payroll runs yet",
        emptyHint:'Click "Process new run" to start',
        total:    "Gross",
        deductions:"Deductions",
        net:      "Net",
        employees:(n:number)=>`${n} employee${n === 1 ? "" : "s"}`,
        viewDetails:"View details",
      };

  const statusLabels = STATUS_LABELS[prefs.locale] ?? STATUS_LABELS.ar;
  const fmt = (n:number) => n.toLocaleString("en-US", { maximumFractionDigits:0 });
  const monthNames = isAr
    ? ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
    : ["","January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-moneybag text-[#0F6E56]" />{t.title}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{t.subtitle}</p>
        </div>
        {(role === "admin" || role === "hr_manager" || role === "finance_manager") && (
          <NewPayrollButton orgId={orgId} userId={userId} locale={prefs.locale} />
        )}
      </div>

      {runs.length === 0 ? (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-14 text-center">
          <i className="ti ti-moneybag text-[40px] text-[#2D3748]" />
          <p className="text-sm text-[#4B5563] mt-3">{t.empty}</p>
          <p className="text-xs text-[#2D3748] mt-1">{t.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {runs.map(run => {
            const s = STATUS_STYLE[run.status ?? "draft"];
            return (
              <Link key={run.id} href={`/hr/payroll/${run.id}`}
                className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 hover:border-[#2D3748] hover:bg-[#141920] transition-all group block">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-base font-semibold text-white">
                      {monthNames[run.month]} {run.year}
                    </p>
                    <p className="text-xs text-[#4B5563] mt-0.5 font-mono">{run.periodName}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.bg} ${s.color} ${s.border}`}>
                    {statusLabels[run.status ?? "draft"]}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label:t.total,      value:`${fmt(Number(run.totalGross ?? 0))} USD`, color:"text-[#D1D5DB]" },
                    { label:t.deductions, value:`${fmt(Number(run.totalDeductions ?? 0))} USD`, color:"text-[#E24B4A]" },
                    { label:t.net,        value:`${fmt(Number(run.totalNet ?? 0))} USD`, color:"text-[#1D9E75]" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-[#161B26] rounded-xl p-2.5 text-center">
                      <p className="text-[10px] text-[#4B5563]">{label}</p>
                      <p className={`text-xs font-semibold tabular-nums mt-0.5 ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#4B5563]">
                  <span className="flex items-center gap-1">
                    <i className="ti ti-users text-[12px]" />
                    {t.employees(run.employeeCount ?? 0)}
                  </span>
                  <span className="flex items-center gap-1 group-hover:text-[#1D9E75] transition-colors">
                    {t.viewDetails} <i className="ti ti-arrow-left text-[11px]" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <PayrollAdjustmentsPanel
        orgId={orgId} userId={userId} month={nextMonth} year={nextYear}
        locale={prefs.locale}
        employees={activeEmployees.map(e => ({ id: e.id, fullName: `${e.firstName} ${e.lastName}` }))}
        adjustments={upcomingAdjustments.map(a => ({
          id: a.id, employeeId: a.employeeId, adjustmentType: a.adjustmentType,
          amount: a.amount, description: a.description, consumedInRunId: a.consumedInRunId,
        }))}
      />
    </div>
  );
}
