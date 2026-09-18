// صفحة تفاصيل كشف الراتب مع الحسبة بند بند
import { auth }    from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }      from "@/db";
import { payrollRuns, payrollLines, employees, contracts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import PayrollDetailClient from "@/modules/hr/components/PayrollDetailClient";

export default async function PayrollDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  const role    = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "hr", role);
  if (!canView(__perm)) redirect("/");

  const run = await db.query.payrollRuns.findFirst({
    where: and(eq(payrollRuns.id, params.id), eq(payrollRuns.organizationId, orgId)),
  });
  if (!run) notFound();

  const lines = await db.query.payrollLines.findMany({
    where: eq(payrollLines.payrollRunId, run.id),
    with: { employee: { columns:{firstNameAr:true,lastNameAr:true,code:true,email:true} } },
  });

  const monthNames = ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  return (
    <PayrollDetailClient
      run={{
        id:          run.id,
        month:       run.month,
        year:        run.year,
        periodName:  run.periodName,
        status:      run.status ?? "draft",
        monthName:   monthNames[run.month],
        totalGross:  Number(run.totalGross ?? 0),
        totalDeductions: Number(run.totalDeductions ?? 0),
        totalNet:    Number(run.totalNet ?? 0),
        employeeCount: run.employeeCount ?? 0,
      }}
      lines={lines.map(l => ({
        id:               l.id,
        employeeName:     `${l.employee?.firstNameAr ?? ""} ${l.employee?.lastNameAr ?? ""}`.trim(),
        empCode:          l.employee?.code ?? "",
        baseSalary:       Number(l.baseSalary),
        adjustedBase:     Number(l.adjustedBaseSalary ?? l.baseSalary),
        housingAllowance: Number(l.housingAllowance ?? 0),
        transportAllowance: Number(l.transportAllowance ?? 0),
        performanceBonus: Number(l.performanceBonus ?? 0),
        overtimePay:      Number(l.overtimePay ?? 0),
        otherAllowances:  Number(l.otherAllowances ?? 0),
        totalAllowances:  Number(l.totalAllowances ?? 0),
        absentDeduction:  Number(l.absentDeduction ?? 0),
        incomeTax:        Number(l.incomeTax ?? 0),
        socialSecurity:   Number(l.socialSecurity ?? 0),
        loanDeduction:    Number(l.loanDeduction ?? 0),
        otherDeductions:  Number(l.otherDeductions ?? 0),
        totalDeductions:  Number(l.totalDeductions ?? 0),
        grossSalary:      Number(l.grossSalary),
        netSalary:        Number(l.netSalary),
        daysPresent:      l.daysPresent ?? 0,
        daysAbsent:       l.daysAbsent  ?? 0,
        overtimeHours:    Number(l.overtimeHours ?? 0),
        paymentStatus:    l.paymentStatus ?? "pending",
        isPaid:           l.isPaid,
      }))}
      orgId={orgId}
      userId={userId}
      role={role}
    />
  );
}
