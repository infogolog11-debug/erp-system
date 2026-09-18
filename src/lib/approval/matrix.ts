// ════════════════════════════════════════════════════════════
// محرك مصفوفة التواقيع — طبقة 1
// ════════════════════════════════════════════════════════════
"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import {
  approvalRules, approvalDecisions, users,
  notifications,
} from "@/db/schema";
import { and, eq, gte, lte, or, isNull, asc } from "drizzle-orm";
import { createAuditLog } from "@/core/audit/audit-trail";
import { notify } from "@/core/notifications/notify";
import { revalidatePath } from "next/cache";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── جلب مراحل الموافقة المطلوبة لطلب بقيمة معينة ───────────────────────
export async function getRequiredApprovers(
  organizationId: string,
  moduleCode:     string,
  amount:         number,
): Promise<ActionResult<{
  levels: Array<{
    level:         number;
    levelName:     string;
    approverUserId: string | null;
    approverRole:   string | null;
    slaHours:      number;
    ruleId:        string;
  }>;
  totalLevels: number;
}>> {
  try {
    const rules = await db.query.approvalRules.findMany({
      where: and(
        eq(approvalRules.organizationId, organizationId),
        eq(approvalRules.moduleCode, moduleCode),
        eq(approvalRules.isActive, true),
        // النطاق المالي يشمل المبلغ
        lte(approvalRules.minAmount, String(amount)),
        or(
          isNull(approvalRules.maxAmount),
          gte(approvalRules.maxAmount, String(amount)),
        ),
      ),
      orderBy: [asc(approvalRules.approvalLevel)],
    });

    if (!rules.length) {
      return { success:false, error:`لا توجد قواعد موافقة لـ ${moduleCode} بمبلغ ${amount}` };
    }

    return {
      success: true,
      data: {
        levels: rules.map(r => ({
          level:          r.approvalLevel,
          levelName:      r.levelNameAr ?? r.levelName,
          approverUserId: r.approverUserId,
          approverRole:   r.approverRole,
          slaHours:       r.slaHours ?? 48,
          ruleId:         r.id,
        })),
        totalLevels: rules.length,
      },
    };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── تسجيل قرار موافقة (approved / rejected / returned) ─────────────────
export async function recordApprovalDecision(params: {
  organizationId: string;
  recordType:     string;
  recordId:       string;
  ruleId:         string;
  approvalLevel:  number;
  approverId:     string;
  decision:       "approved" | "rejected" | "returned";
  comments?:      string;
  amountAtDecision?: number;
  revalidatePath?: string;
}): Promise<ActionResult<{ isFullyApproved: boolean; nextLevel: number | null }>> {
  try {
    const { organizationId, recordType, recordId, ruleId,
            approvalLevel, approverId, decision, comments, amountAtDecision } = params;

    // تسجيل القرار
    await db.insert(approvalDecisions).values({
      organizationId, recordType, recordId, ruleId,
      approvalLevel, approverId,
      decision, comments,
      amountAtDecision: amountAtDecision ? String(amountAtDecision) : null,
      decidedAt: new Date(),
    });

    // جلب كل مراحل هذا الطلب
    const allDecisions = await db.query.approvalDecisions.findMany({
      where: and(
        eq(approvalDecisions.recordType, recordType),
        eq(approvalDecisions.recordId, recordId),
      ),
      orderBy: [asc(approvalDecisions.approvalLevel)],
    });

    // إذا أحد القرارات رفض → الطلب مرفوض
    if (decision === "rejected" || decision === "returned") {
      await createAuditLog({
        organizationId, userId: approverId,
        tableName: recordType, recordId,
        action: "REJECT",
        newValues: { decision, comments, level: approvalLevel },
      });
      if (params.revalidatePath) revalidatePath(params.revalidatePath);
      return { success:true, data:{ isFullyApproved:false, nextLevel:null } };
    }

    // فحص هل هناك مستوى تالٍ
    const approvedLevels = allDecisions
      .filter(d => d.decision === "approved")
      .map(d => d.approvalLevel);

    // جلب قواعد الطلب الكاملة لمعرفة العدد الكلي للمستويات
    const totalRules = await db.query.approvalRules.findMany({
      where: and(
        eq(approvalRules.organizationId, organizationId),
        eq(approvalRules.moduleCode, recordType === "purchase_request" ? "procurement" : recordType),
        eq(approvalRules.isActive, true),
      ),
      orderBy: [asc(approvalRules.approvalLevel)],
    });

    const maxLevel = Math.max(...totalRules.map(r => r.approvalLevel));
    const isFullyApproved = approvedLevels.length >= totalRules.length &&
      approvedLevels.includes(maxLevel);

    const nextLevel = isFullyApproved ? null : approvalLevel + 1;

    // إشعار المرحلة التالية
    if (nextLevel !== null) {
      const nextRule = totalRules.find(r => r.approvalLevel === nextLevel);
      if (nextRule?.approverUserId) {
        await notify({
          organizationId,
          userId:  nextRule.approverUserId,
          title:   "طلب في انتظار موافقتك",
          titleAr: "طلب في انتظار موافقتك",
          body:    `${nextRule.levelNameAr ?? nextRule.levelName} — المرحلة ${nextLevel}`,
          type:    "approval",
          link:    `/${recordType.replace("_","/s/")}/${recordId}`,
        });
      }
    }

    await createAuditLog({
      organizationId, userId: approverId,
      tableName: recordType, recordId,
      action: "APPROVE",
      newValues: { decision, level: approvalLevel, isFullyApproved },
    });

    if (params.revalidatePath) revalidatePath(params.revalidatePath);
    return { success:true, data:{ isFullyApproved, nextLevel } };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── فحص حالة الموافقة الكاملة لأي طلب ────────────────────────────────
export async function getApprovalStatus(
  recordType: string,
  recordId:   string,
  organizationId: string,
  moduleCode: string,
  amount: number,
): Promise<ActionResult<{
  completedLevels: number[];
  pendingLevels:   number[];
  rejectedBy:      { level:number; approverId:string; comments:string|null } | null;
  isFullyApproved: boolean;
  isRejected:      boolean;
  currentLevel:    number;
}>> {
  try {
    const decisions = await db.query.approvalDecisions.findMany({
      where: and(
        eq(approvalDecisions.recordType, recordType),
        eq(approvalDecisions.recordId, recordId),
      ),
    });

    const required = await getRequiredApprovers(organizationId, moduleCode, amount);
    if (!required.success) return { success:false, error:required.error };

    const allLevels = required.data.levels.map(l => l.level);
    const completedLevels = decisions
      .filter(d => d.decision === "approved")
      .map(d => d.approvalLevel);
    const rejection = decisions.find(d => d.decision === "rejected" || d.decision === "returned");
    const pendingLevels = allLevels.filter(l => !completedLevels.includes(l));
    const currentLevel = completedLevels.length > 0
      ? Math.max(...completedLevels) + 1
      : (allLevels[0] ?? 1);

    return {
      success: true,
      data: {
        completedLevels,
        pendingLevels,
        rejectedBy: rejection ? {
          level:      rejection.approvalLevel,
          approverId: rejection.approverId,
          comments:   rejection.comments,
        } : null,
        isFullyApproved: completedLevels.length >= allLevels.length && !rejection,
        isRejected:      !!rejection,
        currentLevel,
      },
    };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
