import { auth }     from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }       from "@/db";
import { employees, contracts, salaryComponents, attendance, leaveRequests, payrollLines } from "@/db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link         from "next/link";
import { getRequestPreferences } from "@/lib/preferences";
import ChatterBox   from "@/components/shared/ChatterBox";
import ContractAllowanceEditor from "@/modules/hr/components/ContractAllowanceEditor";

export default async function EmployeeDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "hr", session.user.role);
  if (!canView(__perm)) redirect("/");
  const userId  = session.user.id;

  const prefs  = await getRequestPreferences();
  const isAr   = prefs.locale === "ar";

  const emp = await db.query.employees.findFirst({
    where: and(eq(employees.id, params.id), eq(employees.organizationId, orgId)),
    with: {
      department: true,
      position:   true,
      contracts:  { orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 1 },
    },
  });
  if (!emp) notFound();

  const [components, recentAttendance, leaves, recentPayroll] = await Promise.all([
    db.query.salaryComponents.findMany({ where: and(eq(salaryComponents.organizationId, orgId), eq(salaryComponents.isActive, true)) }),
    db.query.attendance.findMany({ where: eq(attendance.employeeId, emp.id), orderBy: [desc(attendance.workDate)], limit: 30 }),
    db.query.leaveRequests.findMany({ where: and(eq(leaveRequests.employeeId, emp.id), eq(leaveRequests.isArchived, false)), orderBy: (t,{desc})=>[desc(t.createdAt)], limit: 5 }),
    db.query.payrollLines.findMany({ where: eq(payrollLines.employeeId, emp.id), orderBy: (t,{desc})=>[desc(t.createdAt)], limit: 3, with:{ payrollRun: { columns:{month:true,year:true,status:true} } } }),
  ]);

  const contract     = emp.contracts?.[0];
  const presentDays  = recentAttendance.filter(a => a.attendanceType === "present" || a.attendanceType === "remote").length;
  const absentDays   = recentAttendance.filter(a => a.attendanceType === "absent").length;
  const totalSalary  = contract ? Number(contract.baseSalary) : 0;
  const fmt = (n:number) => n.toLocaleString("en-US", { maximumFractionDigits:0 });
  const monthNames = isAr
    ? ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
    : ["","January","February","March","April","May","June","July","August","September","October","November","December"];

  const t = isAr
    ? {
        active:      "نشط",
        inactive:    "غير نشط",
        viewPayroll: "عرض كشوف الرواتب",
        personalData:"البيانات الشخصية",
        nameAr:      "الاسم بالعربي",
        nameEn:      "الاسم بالإنجليزي",
        email:       "البريد الإلكتروني",
        phone:       "الهاتف",
        gender:      "الجنس",
        male:        "ذكر",
        female:      "أنثى",
        nationality: "الجنسية",
        hireDate:    "تاريخ التعيين",
        attendance30:"الحضور — آخر 30 يوم",
        presentDays: "أيام حضور",
        absentDays:  "أيام غياب",
        total:       "إجمالي",
        recentPayroll:"آخر كشوف الرواتب",
        colPeriod:   "الفترة",
        colBase:     "الراتب الأساسي",
        colNet:      "الصافي",
        colStatus:   "الحالة",
        paid:        "مدفوع",
        pending:     "معلق",
        contractSalary:"العقد والراتب",
        contractType:"نوع العقد",
        baseSalary:  "الراتب الأساسي",
        startDate:   "تاريخ البداية",
        workHours:   (h:number|null)=>`${h} ساعة/أسبوع`,
        availableAllowances:"أنواع البدلات المتاحة بالمؤسسة:",
        noContract:  "لا يوجد عقد نشط",
        recentLeaves:"آخر الإجازات",
        approved:    "معتمد",
        rejected:    "مرفوض",
      }
    : {
        active:      "Active",
        inactive:    "Inactive",
        viewPayroll: "View payroll runs",
        personalData:"Personal data",
        nameAr:      "Arabic name",
        nameEn:      "English name",
        email:       "Email",
        phone:       "Phone",
        gender:      "Gender",
        male:        "Male",
        female:      "Female",
        nationality: "Nationality",
        hireDate:    "Hire date",
        attendance30:"Attendance — last 30 days",
        presentDays: "Days present",
        absentDays:  "Days absent",
        total:       "Total",
        recentPayroll:"Recent payrolls",
        colPeriod:   "Period",
        colBase:     "Base salary",
        colNet:      "Net",
        colStatus:   "Status",
        paid:        "Paid",
        pending:     "Pending",
        contractSalary:"Contract & salary",
        contractType:"Contract type",
        baseSalary:  "Base salary",
        startDate:   "Start date",
        workHours:   (h:number|null)=>`${h} hrs/week`,
        availableAllowances:"Allowance types available in the organization:",
        noContract:  "No active contract",
        recentLeaves:"Recent leaves",
        approved:    "Approved",
        rejected:    "Rejected",
      };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#0F6E56]/20 border border-[#0F6E56]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-[#1D9E75]">
              {emp.firstNameAr?.[0] ?? emp.firstName?.[0]}{emp.lastNameAr?.[0] ?? emp.lastName?.[0]}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{emp.code}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${emp.isActive ? "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]" : "bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]"}`}>
                {emp.isActive ? t.active : t.inactive}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-white">
              {emp.firstNameAr} {emp.lastNameAr}
            </h1>
            <p className="text-sm text-[#6B7280]">{emp.position?.titleAr ?? emp.position?.title} · {emp.department?.nameAr ?? emp.department?.name}</p>
          </div>
        </div>
        <Link href={`/hr/payroll`}
          className="flex items-center gap-2 text-xs text-[#0F6E56] border border-[#0F3D28] bg-[#001A12] px-3 py-1.5 rounded-lg hover:bg-[#002818] transition-all">
          <i className="ti ti-moneybag" />{t.viewPayroll}
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* العمود الرئيسي */}
        <div className="lg:col-span-2 space-y-5">
          {/* البيانات الشخصية */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <i className="ti ti-user text-[#0F6E56]" />{t.personalData}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label:t.nameAr,      value:`${emp.firstNameAr ?? ""} ${emp.lastNameAr ?? ""}` },
                { label:t.nameEn,      value:`${emp.firstName ?? ""} ${emp.lastName ?? ""}` },
                { label:t.email,       value:emp.email },
                { label:t.phone,       value:emp.phone },
                { label:t.gender,      value:emp.gender === "male" ? t.male : emp.gender === "female" ? t.female : "—" },
                { label:t.nationality, value:emp.nationality },
                { label:t.hireDate,    value:emp.hireDate ? new Date(emp.hireDate).toLocaleDateString(isAr ? "ar" : "en-US") : "—" },
              ].map(({ label, value }) => value ? (
                <div key={label}>
                  <p className="text-[10px] text-[#4B5563]">{label}</p>
                  <p className="text-sm font-medium text-[#D1D5DB] mt-0.5">{value}</p>
                </div>
              ) : null)}
            </div>
          </div>

          {/* الحضور آخر 30 يوم */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <i className="ti ti-calendar text-[#378ADD]" />{t.attendance30}
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label:t.presentDays, value:presentDays, color:"text-[#1D9E75]" },
                { label:t.absentDays,  value:absentDays,  color:"text-[#E24B4A]" },
                { label:t.total,       value:recentAttendance.length, color:"text-[#D1D5DB]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#161B26] rounded-xl p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-[#4B5563] mt-1">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-1 flex-wrap">
              {recentAttendance.slice(0,30).reverse().map((a,i) => (
                <div key={i} title={`${a.workDate} — ${a.attendanceType}`}
                  className={`w-6 h-6 rounded-md ${
                    a.attendanceType==="present"||a.attendanceType==="remote" ? "bg-[#0F6E56]" :
                    a.attendanceType==="absent" ? "bg-[#E24B4A]" :
                    "bg-[#EF9F27]"
                  }`} />
              ))}
            </div>
          </div>

          {/* آخر كشوف الرواتب */}
          {recentPayroll.length > 0 && (
            <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1F2937]">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <i className="ti ti-moneybag text-[#EF9F27]" />{t.recentPayroll}
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[#1F2937] bg-[#161B26]">
                  {[t.colPeriod,t.colBase,t.colNet,t.colStatus].map(h => (
                    <th key={h} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {recentPayroll.map(pl => (
                    <tr key={pl.id} className="border-b border-[#1F2937] last:border-0 hover:bg-[#161B26]">
                      <td className="px-4 py-3 text-[#D1D5DB]">
                        {monthNames[pl.payrollRun?.month]} {pl.payrollRun?.year}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[#9CA3AF]">{fmt(Number(pl.baseSalary))}</td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-[#1D9E75]">{fmt(Number(pl.netSalary))}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${pl.isPaid ? "bg-[#001A12] text-[#1D9E75]" : "bg-[#1A1400] text-[#EF9F27]"}`}>
                          {pl.isPaid ? t.paid : t.pending}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ChatterBox tableName="employees" recordId={emp.id} organizationId={orgId} userId={userId} />
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          {/* بيانات العقد والراتب */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="ti ti-file-certificate text-[#0F6E56]" />{t.contractSalary}
            </h2>
            {contract ? (
              <>
                {[
                  { label:t.contractType, value:contract.contractType },
                  { label:t.baseSalary,   value:`${fmt(Number(contract.baseSalary))} USD` },
                  { label:t.startDate,    value:new Date(contract.startDate).toLocaleDateString(isAr ? "ar" : "en-US") },
                  { label:t.total,        value:t.workHours(contract.workingHours) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1.5 border-b border-[#1F2937] last:border-0">
                    <span className="text-xs text-[#4B5563]">{label}</span>
                    <span className="text-xs font-medium text-[#D1D5DB]">{value}</span>
                  </div>
                ))}
                {components.length > 0 && (
                  <>
                    <p className="text-[10px] text-[#4B5563] pt-2">{t.availableAllowances}</p>
                    {components.map(c => (
                      <div key={c.id} className="flex justify-between">
                        <span className="text-xs text-[#6B7280]">{c.nameAr ?? c.name}</span>
                        <span className="text-xs font-medium text-[#1D9E75]">{c.defaultValue ? `+${fmt(Number(c.defaultValue))}` : "—"}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-[#1F2937]">
                      <span className="text-xs font-semibold text-[#9CA3AF]">{t.baseSalary}</span>
                      <span className="text-sm font-bold text-white">{fmt(totalSalary)} USD</span>
                    </div>
                  </>
                )}
                <ContractAllowanceEditor
                  organizationId={orgId}
                  contractId={contract.id}
                  userId={userId}
                  locale={prefs.locale}
                  housingAllowance={contract.housingAllowance}
                  transportAllowance={contract.transportAllowance}
                  housingDefault={Number(components.find(c => c.componentType === "allowance" && c.code === "HOUSE")?.defaultValue ?? 0)}
                  transportDefault={Number(components.find(c => c.componentType === "allowance" && c.code === "TRANS")?.defaultValue ?? 0)}
                />
              </>
            ) : (
              <p className="text-xs text-[#4B5563]">{t.noContract}</p>
            )}
          </div>

          {/* الإجازات */}
          {leaves.length > 0 && (
            <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-2">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <i className="ti ti-beach text-[#A855F7]" />{t.recentLeaves}
              </h2>
              {leaves.map(l => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-[#1F2937] last:border-0">
                  <div>
                    <p className="text-xs text-[#D1D5DB]">{l.leaveType}</p>
                    <p className="text-[10px] text-[#4B5563]">{new Date(l.startDate).toLocaleDateString(isAr ? "ar" : "en-US")} — {new Date(l.endDate).toLocaleDateString(isAr ? "ar" : "en-US")}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    l.status==="approved" ? "bg-[#001A12] text-[#1D9E75]" :
                    l.status==="rejected" ? "bg-[#2A1215] text-[#E24B4A]" :
                    "bg-[#1A1400] text-[#EF9F27]"
                  }`}>{l.status==="approved"?t.approved:l.status==="rejected"?t.rejected:t.pending}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
