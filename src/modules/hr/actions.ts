"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import {
  employees, contracts, payrollRuns, payrollLines,
  salaryComponents, grantBudgetLines, journalEntries, journalLines,
  attendance, payrollAdjustments,
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";
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
      return { success:false as const, error:"لا يوجد موظفون نشطون" };

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

    // ── بونص/خصم مُدخَل فعلياً لكل موظف بهذه الدورة (بدل قيمة كتالوج موحّدة
    //    لكل الموظفين) — نجمعها حسب الموظف لتطبيقها أثناء الحسبة ──
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
    //    منفصل لكل موظف (كان checkBudgetCeiling يُستدعى داخل الحلقة N مرة).
    //    كمان يسمح بتتبّع مجموع تراكمي إذا موظفين مختلفين يشاركون نفس البند
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
      //    بدل استعلام INSERT منفصل لكل موظف — نفس الشي لتحديثات الميزانية ──
      const payrollLineRows: (typeof payrollLines.$inferInsert)[] = [];
      const budgetSpendDelta = new Map<string, number>();

      for (const contract of activeContracts) {
        // ── تجميع بيانات الحضور للموظف ──
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
        // (سابقاً: كل الموظفين كانوا يأخذون نفس بدل السكن/المواصلات من الكتالوج
        //  بغض النظر عن عقدهم الفعلي — هذا كان يعطي أرقام رواتب غير دقيقة)
        // ── البونص/الخصم: مجموع ما أُدخل فعلياً لهذا الموظف بهذه الدورة
        //    (بدل نفس قيمة الكتالوج الافتراضية لكل الموظفين) ──
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
        //    لهذه الدورة) بدل استعلام قاعدة بيانات منفصل لكل موظف ──
        if (contract.budgetLineId) {
          const line = budgetLinesById.get(contract.budgetLineId);
          if (!line) {
            throw new Error(`بند الميزانية غير موجود للموظف ${contract.employeeId}`);
          }
          const alreadyReserved = reservedThisRun.get(contract.budgetLineId) ?? 0;
          const available = line.planned - line.committed - line.spent - alreadyReserved;
          if (calc.netSalary > available) {
            throw new Error(
              `ميزانية غير كافية للموظف ${contract.employeeId}: الميزانية المتاحة ${available.toFixed(2)} — المطلوب ${calc.netSalary.toFixed(2)}`
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
