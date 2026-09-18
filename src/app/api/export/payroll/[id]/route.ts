// API Route: GET /api/export/payroll/[id]?format=pdf|excel
import { NextRequest, NextResponse } from "next/server";
import { auth }           from "@/auth";
import { db }             from "@/db";
import { payrollRuns, payrollLines } from "@/db/schema";
import { eq, and }        from "drizzle-orm";
import { generatePayrollHTML } from "@/lib/export/pdf-generator";
import { buildPayrollSheetData } from "@/lib/export/excel-generator";

const MONTH_AR = ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });
  const orgId   = session.user.organizationId;
  const format  = req.nextUrl.searchParams.get("format") ?? "pdf";

  const run = await db.query.payrollRuns.findFirst({
    where: and(eq(payrollRuns.id, params.id), eq(payrollRuns.organizationId, orgId)),
  });
  if (!run) return NextResponse.json({ error:"غير موجود" }, { status:404 });

  const lines = await db.query.payrollLines.findMany({
    where: eq(payrollLines.payrollRunId, run.id),
    with: { employee: { columns:{ firstNameAr:true, lastNameAr:true, code:true } } },
  });

  const mapped = lines.map(l => ({
    empCode:           l.employee?.code ?? "",
    employeeName:      `${l.employee?.firstNameAr ?? ""} ${l.employee?.lastNameAr ?? ""}`.trim(),
    baseSalary:        Number(l.baseSalary),
    housingAllowance:  Number(l.housingAllowance ?? 0),
    transportAllowance:Number(l.transportAllowance ?? 0),
    performanceBonus:  Number(l.performanceBonus ?? 0),
    overtimePay:       Number(l.overtimePay ?? 0),
    otherAllowances:   Number(l.otherAllowances ?? 0),
    totalAllowances:   Number(l.totalAllowances ?? 0),
    absentDeduction:   Number(l.absentDeduction ?? 0),
    incomeTax:         Number(l.incomeTax ?? 0),
    socialSecurity:    Number(l.socialSecurity ?? 0),
    loanDeduction:     Number(l.loanDeduction ?? 0),
    otherDeductions:   Number(l.otherDeductions ?? 0),
    totalDeductions:   Number(l.totalDeductions ?? 0),
    grossSalary:       Number(l.grossSalary),
    netSalary:         Number(l.netSalary),
    daysPresent:       l.daysPresent ?? 0,
    daysAbsent:        l.daysAbsent  ?? 0,
    overtimeHours:     Number(l.overtimeHours ?? 0),
    paymentStatus:     l.paymentStatus ?? "pending",
    isPaid:            l.isPaid,
  }));

  const totals = {
    gross:      Number(run.totalGross ?? 0),
    deductions: Number(run.totalDeductions ?? 0),
    net:        Number(run.totalNet ?? 0),
  };

  if (format === "excel") {
    const sheetData = buildPayrollSheetData({
      periodName: run.periodName,
      month:      MONTH_AR[run.month],
      year:       run.year,
      lines:      mapped,
    });
    // نُعيد JSON ليحوّله الـ client إلى XLSX عبر SheetJS
    return NextResponse.json(sheetData, {
      headers: { "Content-Type":"application/json", "X-Export-Type":"excel", "X-Filename":`payroll-${run.periodName}.xlsx` }
    });
  }

  // PDF — نُعيد HTML ليُطبع/يُحفَظ كـ PDF
  const html = generatePayrollHTML({
    orgName:     "منظمتي",
    periodName:  run.periodName,
    month:       MONTH_AR[run.month],
    year:        run.year,
    generatedAt: new Date().toLocaleDateString("ar"),
    lines:       mapped,
    totals,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="payroll-${run.periodName}.html"`,
    },
  });
}
