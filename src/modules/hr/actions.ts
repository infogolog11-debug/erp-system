"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import {
  employees, contracts, payrollRuns, payrollLines,
  salaryComponents, grantBudgetLines, journalEntries, journalLines,
  attendance, payrollAdjustments,
  departments, positions, leaveRequests,
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";
import { textField, optionalTextField } from "@/lib/security/sanitize";
import { withIdempotency, IdempotencyInProgressError } from "@/lib/idempotency/guard";
// ── حاسبة الرواتب (مدمجة من nexus-erp) ──
import {
  calculatePayroll,
  getWorkingDaysInMonth,
  resolveContractAllowance,
  type AttendanceSummary,
  type ContractData,
  type AdditionalComponents,
} from "@/lib/payroll/calculator";
import { getPayrollSettings } from "@/lib/settings/service";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── Process Monthly Payroll ──────────────
export async function processPayroll(
  organizationId: string,
  month: number,
  year: number,
  userId: string,
  // موحَّد الآن مع بقية العمليات المالية (v39 — راجع SECURITY_NOTES.md):
  // مفتاح اختياري من العميل يمنع إنشاء دورتين لو انقطعت الشبكة وأعاد
  // العميل نفس الطلب. اختياري وفي آخر الترتيب حفاظاً على توافق الاستدعاءات
  // الحالية (NewPayrollButton/PayrollRunButton) التي لا ترسله بعد.
  idempotencyKey?: string,
): Promise<ActionResult<{ runId:string; totalNet:number }>> {
  try {
    const session = await requirePermission("hr", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    return await withIdempotency(organizationId, idempotencyKey, "processPayroll", async () => {
    // التحقق من عدم وجود كشف رواتب مكرر
    // ملاحظة: هذا الفحص انتقل الآن *داخل* withIdempotency عمداً — لو تُرك
    // خارجها، إعادة إرسال نفس الطلب (نفس idempotencyKey) بعد نجاحه كانت
    // ستصطدم بهذا الفحص وتُرجع خطأ "موجود بالفعل" بدل إرجاع نفس نتيجة
    // النجاح الأصلية المخزَّنة — عكس الغرض من توحيد النمط مع بقية العمليات
    // المالية (createDistribution ونحوها).
    const existing = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.organizationId, organizationId),
        eq(payrollRuns.month, month),
        eq(payrollRuns.year, year),
      ),
    });
    if (existing) return {
      success:false as const,
      error:`كشف رواتب ${month}/${year} موجود بالفعل`,
    };

    // جلب الموظفين النشطين مع عقودهم
    // إصلاح حرج (اكتُشف أثناء مراجعة IDOR الممتدة بv34 — راجع الشرح الكامل
    // بـSECURITY_NOTES.md): كان هذا الاستعلام يجلب عقود *كل* المنظمات على
    // الإطلاق (بدون أي فلترة بـorganizationId رغم وجود العمود في الجدول)،
    // فتشغيل الرواتب لمنظمة واحدة كان يحسب رواتب موظفي كل المنظمات الأخرى
    // على النظام ويُدرجها ضمن نفس كشف الرواتب — وأيضاً يخصم من بنود ميزانية
    // منظمات أخرى (grantBudgetLines.spentAmount) عبر budgetSpendDelta أدناه.
    const activeContracts = await db.query.contracts.findMany({
      where: and(
        eq(contracts.organizationId, organizationId),
        eq(contracts.isCurrent, true),
        eq(contracts.isArchived, false),
      ),
      with: { employee: true },
    });

    if (!activeContracts.length)
      return { success:false as const, error:"لا يوجد وكلاء نشطون" };

    // ── حساب أيام العمل الفعلية في الشهر ──
    // ── جلب الإعدادات الديناميكية من قاعدة البيانات ──
    const payrollConfig = await getPayrollSettings(organizationId);
    const workingDaysInMonth = getWorkingDaysInMonth(year, month);

    // ── جلب سجلات الحضور للشهر ──
    const periodStart = new Date(year, month - 1, 1).toISOString();
    const periodEnd   = new Date(year, month, 0, 23, 59, 59).toISOString();
    const attendanceRecords = await db.query.attendance.findMany({
      where: and(
        eq(attendance.organizationId, organizationId),
        gte(attendance.workDate, periodStart.split("T")[0]),
        lte(attendance.workDate, periodEnd.split("T")[0]),
      ),
    });

    // ── جلب كتالوج مكونات الراتب (تعريفات على مستوى المؤسسة) ──
    const salaryComponentsCatalog = await db.query.salaryComponents.findMany({
      where: and(
        eq(salaryComponents.organizationId, organizationId),
        eq(salaryComponents.isActive, true),
      ),
    });

    // ── بونص/خصم مُدخَل فعلياً لكل وكيل بهذه الدورة (بدل قيمة كتالوج موحّدة
    //    لكل الوكلاء) — نجمعها حسب الوكيل لتطبيقها أثناء الحسبة ──
    const adjustmentsThisPeriod = await db.query.payrollAdjustments.findMany({
      where: and(
        eq(payrollAdjustments.organizationId, organizationId),
        eq(payrollAdjustments.month, month),
        eq(payrollAdjustments.year, year),
      ),
    });
    const adjustmentsByEmployee = new Map<string, { bonus:number; deduction:number; ids:string[] }>();
    for (const a of adjustmentsThisPeriod) {
      const cur = adjustmentsByEmployee.get(a.employeeId) ?? { bonus:0, deduction:0, ids:[] };
      if (a.adjustmentType === "bonus") cur.bonus += Number(a.amount);
      else cur.deduction += Number(a.amount);
      cur.ids.push(a.id);
      adjustmentsByEmployee.set(a.employeeId, cur);
    }

    // ── تحسين أداء: جلب كل بنود الميزانية المرتبطة دفعة واحدة بدل استعلام
    //    منفصل لكل وكيل (كان checkBudgetCeiling يُستدعى داخل الحلقة N مرة).
    //    كمان يسمح بتتبّع مجموع تراكمي إذا وكلاء مختلفين يشاركون نفس البند
    //    بنفس دورة الرواتب — وهذا كان فحصاً ناقصاً بالنسخة القديمة. ──
    const budgetLineIds = [...new Set(
      activeContracts.map(c => c.budgetLineId).filter((id): id is string => !!id)
    )];
    const budgetLinesById = new Map<string, { planned:number; committed:number; spent:number }>();
    if (budgetLineIds.length > 0) {
      const lines = await db.query.grantBudgetLines.findMany({
        where: inArray(grantBudgetLines.id, budgetLineIds),
      });
      for (const l of lines) {
        budgetLinesById.set(l.id, {
          planned:   Number(l.plannedAmount),
          committed: Number(l.committedAmount),
          spent:     Number(l.spentAmount),
        });
      }
    }
    // مجموع تراكمي لما تم "حجزه" داخل هذه الدورة (قبل commit)، لكل بند
    const reservedThisRun = new Map<string, number>();

    const result = await db.transaction(async (tx) => {
      // إنشاء كشف الرواتب
      const [run] = await tx.insert(payrollRuns).values({
        organizationId,
        periodName:    `${year}-${String(month).padStart(2,"0")}`,
        month, year,
        status:        "draft",
        employeeCount: activeContracts.length,
        createdBy:     userId,
        processedBy:   userId,
        processedAt:   new Date(),
      }).returning();

      let totalGross      = 0;
      let totalNet        = 0;
      let totalDeductions = 0;

      // ── تجميع كل سطور الراتب بالذاكرة أولاً، ثم إدراج دفعة واحدة (batch insert)
      //    بدل استعلام INSERT منفصل لكل وكيل — نفس الشي لتحديثات الميزانية ──
      const payrollLineRows: (typeof payrollLines.$inferInsert)[] = [];
      const budgetSpendDelta = new Map<string, number>();

      for (const contract of activeContracts) {
        // ── تجميع بيانات الحضور للوكيل ──
        const empAtt = attendanceRecords.filter(
          a => a.employeeId === contract.employeeId
        );
        const daysPresent = empAtt.filter(a => a.attendanceType === "present" || a.attendanceType === "remote").length;
        const daysAbsent  = empAtt.filter(a => a.attendanceType === "absent").length;
        const daysLeave   = empAtt.filter(a => a.attendanceType === "half_day").length;
        const overtimeHours = empAtt.reduce(
          (sum, a) => sum + (a.overtimeHours ? Number(a.overtimeHours) : 0), 0
        );

        const attSummary: AttendanceSummary = {
          workingDaysInMonth,
          daysPresent: daysPresent || workingDaysInMonth,
          daysAbsent,
          daysLeave,
          overtimeHours,
        };

        // ── مكونات الراتب: أولوية لقيمة العقد الفردية، وإلا رجوع لكتالوج المنظمة ──
        // (سابقاً: كل الوكلاء كانوا يأخذون نفس بدل السكن/المواصلات من الكتالوج
        //  بغض النظر عن عقدهم الفعلي — هذا كان يعطي أرقام رواتب غير دقيقة)
        // ── البونص/الخصم: مجموع ما أُدخل فعلياً لهذا الوكيل بهذه الدورة
        //    (بدل نفس قيمة الكتالوج الافتراضية لكل الوكلاء) ──
        const empAdjustments = adjustmentsByEmployee.get(contract.employeeId);

        const contractData: ContractData = {
          baseSalary:         Number(contract.baseSalary),
          housingAllowance:   resolveContractAllowance(contract.housingAllowance, salaryComponentsCatalog, "HOUSE"),
          transportAllowance: resolveContractAllowance(contract.transportAllowance, salaryComponentsCatalog, "TRANS"),
          otherAllowances:    0,
          workingDays:        workingDaysInMonth,
        };

        const additionalData: AdditionalComponents = {
          performanceBonus: empAdjustments?.bonus ?? 0,
          loanDeduction:    empAdjustments?.deduction ?? 0,
          otherDeductions:  0,
          otherAllowances:  0,
        };

        // ── الحسبة الكاملة بمنطق nexus ──
        const calc = calculatePayroll(contractData, attSummary, additionalData, {
          incomeTaxRate:      payrollConfig.incomeTaxRate,
          socialSecurityRate: payrollConfig.socialSecurityRate,
          overtimeMultiplier: payrollConfig.overtimeMultiplier,
          taxExemptThreshold: payrollConfig.taxExemptThreshold,
        });

        // ── فحص ميزانية المنحة من الذاكرة (بيانات مُحمَّلة مسبقاً + مجموع تراكمي
        //    لهذه الدورة) بدل استعلام قاعدة بيانات منفصل لكل وكيل ──
        if (contract.budgetLineId) {
          const line = budgetLinesById.get(contract.budgetLineId);
          if (!line) {
            throw new Error(`بند الميزانية غير موجود للوكيل ${contract.employeeId}`);
          }
          const alreadyReserved = reservedThisRun.get(contract.budgetLineId) ?? 0;
          const available = line.planned - line.committed - line.spent - alreadyReserved;
          if (calc.netSalary > available) {
            throw new Error(
              `ميزانية غير كافية للوكيل ${contract.employeeId}: الميزانية المتاحة ${available.toFixed(2)} — المطلوب ${calc.netSalary.toFixed(2)}`
            );
          }
          reservedThisRun.set(contract.budgetLineId, alreadyReserved + calc.netSalary);
          budgetSpendDelta.set(
            contract.budgetLineId,
            (budgetSpendDelta.get(contract.budgetLineId) ?? 0) + calc.netSalary,
          );
        }

        payrollLineRows.push({
          payrollRunId:        run.id,
          employeeId:          contract.employeeId,
          contractId:          contract.id,
          organizationId,
          grantId:             contract.grantId,
          budgetLineId:        contract.budgetLineId,
          // الحضور
          workingDaysInMonth,
          daysPresent:         calc.daysPresent,
          daysAbsent:          calc.daysAbsent,
          daysLeave:           calc.daysLeave,
          overtimeHours:       String(calc.overtimeHours),
          // البدلات
          baseSalary:          String(calc.baseSalary),
          adjustedBaseSalary:  String(calc.adjustedBaseSalary),
          housingAllowance:    String(calc.housingAllowance),
          transportAllowance:  String(calc.transportAllowance),
          performanceBonus:    String(calc.performanceBonus),
          overtimePay:         String(calc.overtimePay),
          otherAllowances:     String(calc.otherAllowances),
          totalAllowances:     String(calc.totalAllowances),
          // الخصومات
          absentDeduction:     String(calc.absentDeduction),
          incomeTax:           String(calc.incomeTax),
          socialSecurity:      String(calc.socialSecurity),
          loanDeduction:       String(calc.loanDeduction),
          otherDeductions:     String(calc.otherDeductions),
          totalDeductions:     String(calc.totalDeductions),
          // الإجماليات
          grossSalary:         String(calc.grossSalary),
          netSalary:           String(calc.netSalary),
          paymentStatus:       "pending",
          breakdown:           calc, // snapshot JSON كامل
          createdBy:           userId,
        });

        totalGross      += calc.grossSalary;
        totalDeductions += calc.totalDeductions;
        totalNet        += calc.netSalary;
      }

      // ── إدراج دفعة واحدة لكل سطور الرواتب (بدل N استعلام) ──
      if (payrollLineRows.length > 0) {
        await tx.insert(payrollLines).values(payrollLineRows);
      }

      // ── تعليم كل البونصات/الخصومات المُستخدَمة بهذه الدورة (يمنع إعادة
      //    استخدامها بالغلط بدورة تانية) — تحديث دفعة واحدة بدل واحد لكل سجل ──
      const consumedIds = adjustmentsThisPeriod.map(a => a.id);
      if (consumedIds.length > 0) {
        await tx.update(payrollAdjustments)
          .set({ consumedInRunId: run.id, updatedAt: new Date() })
          .where(inArray(payrollAdjustments.id, consumedIds));
      }

      // ── تحديث كل بند ميزانية مرة واحدة بمجموع مصروفه (بدل تحديث لكل موظف) ──
      // إصلاح: تقييد التحديث بنفس organizationId أيضاً (دفاع بعمق — العقود
      // نفسها صارت مفلترة بالمنظمة أعلاه فلن يصل هذا الكود لبند تابع لمنظمة
      // أخرى أصلاً بعد إصلاح استعلام activeContracts، لكن لا داعي للاعتماد
      // فقط على ذلك الفلتر البعيد).
      for (const [budgetLineId, delta] of budgetSpendDelta) {
        await tx.update(grantBudgetLines)
          .set({
            spentAmount: sql`spent_amount + ${String(delta)}`,
            updatedAt: new Date(),
          })
          .where(and(eq(grantBudgetLines.id, budgetLineId), eq(grantBudgetLines.organizationId, organizationId)));
      }

      // تحديث إجماليات الكشف
      await tx.update(payrollRuns)
        .set({
          totalGross:      String(+totalGross.toFixed(2)),
          totalDeductions: String(+totalDeductions.toFixed(2)),
          totalNet:        String(+totalNet.toFixed(2)),
          status:          "processing",
          updatedAt:       new Date(),
        })
        .where(eq(payrollRuns.id, run.id));

      return { runId: run.id, totalNet: +totalNet.toFixed(2) };
    });

    await createAuditLog({
      organizationId, userId,
      tableName:"payroll_runs", recordId:result.runId,
      action:"CREATE",
      newValues:{ month, year, totalNet:result.totalNet },
    });

    revalidatePath("/hr/payroll");
    return { success:true as const, data:result };
    }); // ─ نهاية withIdempotency ─
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    // إصلاح (v34-تتمة-2): الفحص التطبيقي (findFirst) أعلاه لمنع كشف رواتب
    // مكرر لنفس الفترة كان check-then-act بلا قفل — قيد قاعدة بيانات حقيقي
    // أُضيف بـmigration 015 (payroll_runs_org_period_uidx). لو مرّ طلبان
    // متزامنان الفحص التطبيقي معاً (سواء بلا مفتاح idempotency، أو بمفتاحين
    // *مختلفين* — withIdempotency لا يحميهما من بعض، هي تحمي فقط تكرار نفس
    // المفتاح)، الإدراج الثاني يفشل هنا بخطأ postgres unique_violation
    // (كود 23505) — نترجمه لنفس رسالة "كشف مكرر" الودّية بدل تسريب خطأ
    // postgres خام للمستخدم.
    const pgCode = (e as { code?: string } | null)?.code;
    if (pgCode === "23505") {
      return { success:false, error:`كشف رواتب ${month}/${year} موجود بالفعل` };
    }
    return { success:false, error:errMsg(e, "حدث خطأ في معالجة الرواتب") };
  }
}

// ─── Approve Payroll Run (مدمج من nexus-erp) ──────────────────────────────
export async function approvePayroll(
  runId: string,
  userId: string,
  organizationId: string,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("hr", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, runId),
    });
    if (!run) return { success:false, error:"دورة الراتب غير موجودة" };
    if (run.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (run.status !== "processing" && run.status !== "draft") {
      return { success:false, error:`الدورة في حالة "${run.status}" ولا يمكن اعتمادها` };
    }

    await db.update(payrollRuns)
      .set({ status:"approved", approvedBy:userId, approvedAt:new Date(), updatedAt:new Date() })
      .where(and(eq(payrollRuns.id, runId), eq(payrollRuns.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId,
      tableName:"payroll_runs", recordId:runId,
      action:"UPDATE",
      newValues:{ status:"approved" },
    });

    revalidatePath("/hr/payroll");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في اعتماد الرواتب") };
  }
}

// ─── Mark Payroll as Paid ─────────────────────────────────────────────────
export async function markPayrollPaid(
  runId: string,
  userId: string,
  organizationId: string,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("hr", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, runId),
    });
    if (!run) return { success:false, error:"دورة الراتب غير موجودة" };
    if (run.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (run.status !== "approved") {
      return { success:false, error:"يجب اعتماد الكشف أولاً قبل تسجيل الدفع" };
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(payrollRuns)
        .set({ status:"paid", paidAt:now, updatedAt:now })
        .where(eq(payrollRuns.id, runId));

      await tx.update(payrollLines)
        .set({ isPaid:true, paidAt:now, paymentStatus:"paid" })
        .where(eq(payrollLines.payrollRunId, runId));
    });

    await createAuditLog({
      organizationId, userId,
      tableName:"payroll_runs", recordId:runId,
      action:"UPDATE",
      newValues:{ status:"paid", paidAt:now },
    });

    revalidatePath("/hr/payroll");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في تسجيل الدفع") };
  }
}

// ─── Update Contract Allowances (بدل السكن/المواصلات لعقد موظف محدد) ──────
// يسمح بتخصيص قيمة لكل عقد بدل الاعتماد فقط على القيمة الافتراضية بالكتالوج.
// إرسال null يعني "رجوع لقيمة الكتالوج الافتراضية" (إلغاء التخصيص).
const updateContractAllowancesSchema = z.object({
  housingAllowance:   z.number().min(0, "القيمة لا يمكن أن تكون سالبة").nullable(),
  transportAllowance: z.number().min(0, "القيمة لا يمكن أن تكون سالبة").nullable(),
});

export async function updateContractAllowances(
  organizationId: string,
  contractId: string,
  userId: string,
  input: { housingAllowance: number | null; transportAllowance: number | null },
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("hr", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const parsed = updateContractAllowancesSchema.safeParse(input);
    if (!parsed.success) {
      return { success:false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
    }

    const contract = await db.query.contracts.findFirst({ where: eq(contracts.id, contractId) });
    if (!contract) return { success:false, error:"العقد غير موجود" };
    if (contract.organizationId !== organizationId) {
      return { success:false, error:"غير مصرَّح بالوصول لهذا العقد" };
    }

    const oldValues = {
      housingAllowance:   contract.housingAllowance,
      transportAllowance: contract.transportAllowance,
    };

    await db.update(contracts)
      .set({
        housingAllowance:   parsed.data.housingAllowance   === null ? null : String(parsed.data.housingAllowance),
        transportAllowance: parsed.data.transportAllowance === null ? null : String(parsed.data.transportAllowance),
        updatedAt: new Date(),
      })
      .where(eq(contracts.id, contractId));

    await createAuditLog({
      organizationId, userId,
      tableName:"contracts", recordId:contractId,
      action:"UPDATE",
      oldValues,
      newValues: parsed.data,
    });

    revalidatePath("/hr/employees");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في تحديث البدلات") };
  }
}

// ─── Payroll Adjustments (بونص/خصم لمرة واحدة لموظف محدد بدورة رواتب محددة) ──
// بديل عن الاعتماد على قيمة الكتالوج الافتراضية لكل الموظفين بكل دورة.
const addAdjustmentSchema = z.object({
  employeeId:      z.string().uuid("معرّف موظف غير صالح"),
  month:           z.number().int().min(1).max(12),
  year:            z.number().int().min(2000).max(2100),
  adjustmentType:  z.enum(["bonus","deduction"]),
  amount:          z.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  description:     z.string().trim().min(3, "لازم توضيح سبب البونص/الخصم (3 أحرف على الأقل)"),
});

export async function addPayrollAdjustment(
  organizationId: string,
  userId: string,
  input: z.infer<typeof addAdjustmentSchema>,
): Promise<ActionResult<{ id:string }>> {
  try {
    const session = await requirePermission("hr", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const parsed = addAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return { success:false, error: parsed.error.issues[0]?.message ?? "بيانات غير صالحة" };
    }

    // منع إضافة بونص/خصم لدورة رواتب سبق ومُعالِجتها (بيانات غير متسقة بعد الحقيقة)
    const existingRun = await db.query.payrollRuns.findFirst({
      where: and(
        eq(payrollRuns.organizationId, organizationId),
        eq(payrollRuns.month, parsed.data.month),
        eq(payrollRuns.year, parsed.data.year),
      ),
    });
    if (existingRun) {
      return { success:false, error:"هذه الدورة تمت معالجتها مسبقاً — لا يمكن إضافة بونص/خصم لها الآن" };
    }

    // إصلاح IDOR (v35 — نفس نمط addCaseNote/addComplaintUpdate): employeeId
    // مُرسَل من العميل ويُدرَج مباشرة دون تحقق ملكية. لا يسبب تلوّثاً مالياً
    // مباشراً (processPayroll يفلتر العقود بالمنظمة أصلاً فلن "يستهلك" بونص
    // بموظف أجنبي)، لكنه يسمح بتلويث جدول payroll_adjustments بسجلات تشير
    // لموظفين لا يخصون المنظمة، ويُمكن استغلاله لاستكشاف وجود UUID موظفين
    // بمنظمات أخرى (enumeration) عبر رسائل الخطأ.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(employees, parsed.data.employeeId, organizationId))) {
      return { success:false, error:"الموظف غير موجود أو لا يتبع هذه المنظمة" };
    }

    const [row] = await db.insert(payrollAdjustments).values({
      organizationId,
      employeeId:     parsed.data.employeeId,
      month:          parsed.data.month,
      year:           parsed.data.year,
      adjustmentType: parsed.data.adjustmentType,
      amount:         String(parsed.data.amount),
      description:    parsed.data.description,
      createdBy:      userId,
    }).returning();

    await createAuditLog({
      organizationId, userId,
      tableName:"payroll_adjustments", recordId:row.id,
      action:"CREATE", newValues: parsed.data,
    });

    revalidatePath("/hr/payroll");
    return { success:true, data:{ id: row.id } };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في إضافة البونص/الخصم") };
  }
}

export async function deletePayrollAdjustment(
  organizationId: string,
  userId: string,
  adjustmentId: string,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("hr", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const adj = await db.query.payrollAdjustments.findFirst({ where: eq(payrollAdjustments.id, adjustmentId) });
    if (!adj) return { success:false, error:"السجل غير موجود" };
    if (adj.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (adj.consumedInRunId) return { success:false, error:"تم استخدام هذا البونص/الخصم فعلياً بدورة رواتب — لا يمكن حذفه" };

    await db.delete(payrollAdjustments).where(eq(payrollAdjustments.id, adjustmentId));

    await createAuditLog({
      organizationId, userId,
      tableName:"payroll_adjustments", recordId:adjustmentId,
      action:"DELETE", oldValues: adj,
    });

    revalidatePath("/hr/payroll");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في حذف البونص/الخصم") };
  }
}

export async function listPayrollAdjustments(
  organizationId: string,
  month: number,
  year: number,
) {
  // إرجاع صفوف خام (بدون with: relations) تفادياً للاعتماد على تعريفات
  // العلاقات بـ relations.ts — الصفحة المستدعية أصلاً عندها قائمة الموظفين
  // وتقدر تربط الاسم بالذاكرة.
  return db.query.payrollAdjustments.findMany({
    where: and(
      eq(payrollAdjustments.organizationId, organizationId),
      eq(payrollAdjustments.month, month),
      eq(payrollAdjustments.year, year),
    ),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
}

// ══════════════════════════════════════════════════════════════════
// إنشاء وكيل — كان زر "وكيل جديد" يوجّه إلى /hr/employees/new
// وهو مسار غير موجود (404)، ولم تكن توجد أي دالة إنشاء وكلاء إطلاقاً
// (الإضافة الوحيدة كانت من ملف الـ seed).
// ══════════════════════════════════════════════════════════════════
const CreateEmployeeSchema = z.object({
  organizationId: z.string().uuid(),
  code:           textField(30, 1),
  firstName:      textField(100, 1),
  lastName:       textField(100, 1),
  firstNameAr:    optionalTextField(100),
  lastNameAr:     optionalTextField(100),
  gender:         z.enum(["male","female"]),
  departmentId:   z.string().uuid(),
  positionId:     z.string().uuid(),
  managerId:      z.string().uuid().optional().or(z.literal("")),
  dateOfBirth:    optionalTextField(30),
  nationality:    optionalTextField(100),
  nationalId:     optionalTextField(50),
  passportNo:     optionalTextField(50),
  phone:          optionalTextField(50),
  email:          z.string().email().optional().or(z.literal("")),
  address:        optionalTextField(300),
  hireDate:       z.string(),
  bankName:       optionalTextField(100),
  bankAccount:    optionalTextField(60),
  bankIban:       optionalTextField(60),
  // ── العقد الابتدائي: بدونه لا يظهر الوكيل في مسير الرواتب لأن
  //    processPayroll يعتمد على contracts.isCurrent ──
  contractType:    z.enum(["full_time","part_time","consultant","volunteer","intern"]).optional(),
  baseSalary:      z.number().min(0).optional(),
  currencyId:      z.string().uuid().optional().or(z.literal("")),
  contractEndDate: z.string().optional(),
});

export async function createEmployee(
  formData: z.infer<typeof CreateEmployeeSchema>, userId: string,
): Promise<ActionResult<{ id:string; code:string }>> {
  try {
    const v = CreateEmployeeSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("hr", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // القسم لازم يكون تابع لنفس المنظمة، والوظيفة تابع لنفس القسم
    const dept = await db.select({ id: departments.id }).from(departments)
      .where(and(
        eq(departments.id, v.data.departmentId),
        eq(departments.organizationId, v.data.organizationId),
      )).limit(1);
    if (!dept.length) return { success:false, error:"القسم غير موجود في هذه المنظمة" };

    const pos = await db.select({ id: positions.id }).from(positions)
      .where(and(
        eq(positions.id, v.data.positionId),
        eq(positions.departmentId, v.data.departmentId),
      )).limit(1);
    if (!pos.length) return { success:false, error:"الوظيفة غير تابعة للقسم المحدد" };

    const duplicate = await db.select({ id: employees.id }).from(employees)
      .where(eq(employees.code, v.data.code)).limit(1);
    if (duplicate.length) return { success:false, error:"كود الوكيل مستخدم مسبقاً" };

    const hireDate = new Date(v.data.hireDate);
    if (Number.isNaN(hireDate.getTime())) return { success:false, error:"تاريخ التعيين غير صالح" };

    const [emp] = await db.insert(employees).values({
      organizationId: v.data.organizationId,
      code:           v.data.code,
      firstName:      v.data.firstName,
      lastName:       v.data.lastName,
      firstNameAr:    v.data.firstNameAr || undefined,
      lastNameAr:     v.data.lastNameAr || undefined,
      gender:         v.data.gender,
      departmentId:   v.data.departmentId,
      positionId:     v.data.positionId,
      managerId:      v.data.managerId || undefined,
      dateOfBirth:    v.data.dateOfBirth || undefined,
      nationality:    v.data.nationality || undefined,
      nationalId:     v.data.nationalId || undefined,
      passportNo:     v.data.passportNo || undefined,
      phone:          v.data.phone || undefined,
      email:          v.data.email || undefined,
      address:        v.data.address || undefined,
      hireDate,
      bankName:       v.data.bankName || undefined,
      bankAccount:    v.data.bankAccount || undefined,
      bankIban:       v.data.bankIban || undefined,
      createdBy:      userId,
    }).returning();

    if (v.data.baseSalary != null && v.data.currencyId) {
      const endDate = v.data.contractEndDate ? new Date(v.data.contractEndDate) : undefined;
      if (endDate && Number.isNaN(endDate.getTime())) return { success:false, error:"تاريخ انتهاء العقد غير صالح" };

      await db.insert(contracts).values({
        employeeId:     emp.id,
        organizationId: v.data.organizationId,
        contractType:   v.data.contractType ?? "full_time",
        startDate:      hireDate,
        endDate,
        baseSalary:     String(v.data.baseSalary),
        currencyId:     v.data.currencyId,
        isCurrent:      true,
        createdBy:      userId,
      });
    }

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"employees", recordId:emp.id, action:"CREATE",
      newValues:{ code: emp.code, firstName: emp.firstName, lastName: emp.lastName, departmentId: emp.departmentId },
    });

    revalidatePath("/hr");
    return { success:true, data:{ id:emp.id, code:emp.code } };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في إضافة الوكيل") };
  }
}

// ══════════════════════════════════════════════════════════════════
// تسجيل الحضور — كان جدول attendance يُقرأ ويُعرض فقط، بلا أي واجهة
// إدخال، رغم أن مسير الرواتب يحسب الغياب والوقت الإضافي منه.
// ══════════════════════════════════════════════════════════════════
const AttendanceSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId:     z.string().uuid(),
  workDate:       z.string().min(10),                        // YYYY-MM-DD
  attendanceType: z.enum(["present","absent","half_day","remote"]),
  checkIn:        optionalTextField(30),
  checkOut:       optionalTextField(30),
  overtimeHours:  z.number().min(0).max(24).optional(),
});

export async function recordAttendance(
  formData: z.infer<typeof AttendanceSchema>, userId: string,
): Promise<ActionResult<{ id:string }>> {
  try {
    const v = AttendanceSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("hr", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };
    if (!(await assertOwnedByOrg(employees, v.data.employeeId, v.data.organizationId)))
      return { success:false, error:"الوكيل غير موجود أو لا يتبع هذه المنظمة" };

    const checkIn  = v.data.checkIn  ? new Date(v.data.checkIn)  : undefined;
    const checkOut = v.data.checkOut ? new Date(v.data.checkOut) : undefined;
    if (checkIn && Number.isNaN(checkIn.getTime())) return { success:false, error:"وقت الحضور غير صالح" };
    if (checkOut && Number.isNaN(checkOut.getTime())) return { success:false, error:"وقت الانصراف غير صالح" };

    const workedHours = checkIn && checkOut
      ? Math.max(0, +((checkOut.getTime() - checkIn.getTime()) / 3_600_000).toFixed(2))
      : undefined;

    const values = {
      organizationId: v.data.organizationId,
      employeeId:     v.data.employeeId,
      workDate:       v.data.workDate,
      attendanceType: v.data.attendanceType,
      checkIn,
      checkOut,
      workedHours:    workedHours != null ? String(workedHours) : undefined,
      overtimeHours:  String(v.data.overtimeHours ?? 0),
    };

    // سجل واحد لكل وكيل/يوم — إعادة التسجيل تُحدّث السجل بدل تكديس صفوف
    const existing = await db.select({ id: attendance.id }).from(attendance)
      .where(and(
        eq(attendance.employeeId, v.data.employeeId),
        eq(attendance.workDate, v.data.workDate),
      )).limit(1);

    let recordId: string;
    if (existing.length) {
      recordId = existing[0].id;
      await db.update(attendance)
        .set({ ...values, updatedBy: userId, updatedAt: new Date() })
        .where(eq(attendance.id, recordId));
    } else {
      const [row] = await db.insert(attendance).values({ ...values, createdBy: userId }).returning();
      recordId = row.id;
    }

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"attendance", recordId, action: existing.length ? "UPDATE" : "CREATE",
      newValues:{ workDate: v.data.workDate, attendanceType: v.data.attendanceType, overtimeHours: v.data.overtimeHours ?? 0 },
    });

    revalidatePath(`/hr/employees/${v.data.employeeId}`);
    return { success:true, data:{ id:recordId } };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في تسجيل الحضور") };
  }
}

// ══════════════════════════════════════════════════════════════════
// طلبات الإجازة — كانت تُعرض فقط بدون إمكانية تقديم أو اعتماد.
// الحالة مُخزَّنة في baseColumns.status (submitted → approved/rejected).
// ══════════════════════════════════════════════════════════════════
const LeaveRequestSchema = z.object({
  organizationId: z.string().uuid(),
  employeeId:     z.string().uuid(),
  leaveType:      z.enum(["annual","sick","maternity","paternity","unpaid","emergency"]),
  startDate:      z.string(),
  endDate:        z.string(),
  reason:         optionalTextField(500),
});

export async function createLeaveRequest(
  formData: z.infer<typeof LeaveRequestSchema>, userId: string,
): Promise<ActionResult<{ id:string }>> {
  try {
    const v = LeaveRequestSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("hr", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };
    if (!(await assertOwnedByOrg(employees, v.data.employeeId, v.data.organizationId)))
      return { success:false, error:"الوكيل غير موجود أو لا يتبع هذه المنظمة" };

    const startDate = new Date(v.data.startDate);
    const endDate   = new Date(v.data.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
      return { success:false, error:"تواريخ الإجازة غير صالحة" };
    if (endDate < startDate) return { success:false, error:"تاريخ النهاية قبل تاريخ البداية" };

    const totalDays = (endDate.getTime() - startDate.getTime()) / 86_400_000 + 1;

    const [leave] = await db.insert(leaveRequests).values({
      organizationId: v.data.organizationId,
      employeeId:     v.data.employeeId,
      leaveType:      v.data.leaveType,
      startDate,
      endDate,
      totalDays:      String(totalDays),
      reason:         v.data.reason || undefined,
      status:         "submitted",
      createdBy:      userId,
    }).returning();

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"leave_requests", recordId:leave.id, action:"CREATE",
      newValues:{ leaveType: v.data.leaveType, startDate: v.data.startDate, endDate: v.data.endDate, totalDays },
    });

    revalidatePath(`/hr/employees/${v.data.employeeId}`);
    return { success:true, data:{ id:leave.id } };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في تقديم طلب الإجازة") };
  }
}

export async function setLeaveRequestDecision(
  leaveRequestId: string,
  organizationId: string,
  userId: string,
  decision: "approved" | "rejected",
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("hr", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const leave = await db.query.leaveRequests.findFirst({
      where: and(eq(leaveRequests.id, leaveRequestId), eq(leaveRequests.organizationId, organizationId)),
      columns: { id:true, employeeId:true, status:true },
    });
    if (!leave) return { success:false, error:"طلب الإجازة غير موجود أو لا يتبع هذه المنظمة" };
    if (leave.status !== "submitted") return { success:false, error:"تمت معالجة هذا الطلب مسبقاً" };

    await db.update(leaveRequests)
      .set({
        status: decision,
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy:  userId,
        updatedAt:  new Date(),
      })
      .where(eq(leaveRequests.id, leaveRequestId));

    await createAuditLog({
      organizationId, userId,
      tableName:"leave_requests", recordId: leaveRequestId,
      action: decision === "approved" ? "APPROVE" : "REJECT",
      newValues:{ status: decision },
    });

    revalidatePath(`/hr/employees/${leave.employeeId}`);
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error:errMsg(e, "حدث خطأ في معالجة طلب الإجازة") };
  }
}
