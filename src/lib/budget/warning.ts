// ════════════════════════════════════════════════════════════
// نظام التحذير المبكر للميزانية — طبقة 1
// تحذير عند 80% (قابل للتخصيص) + حجب عند 100%
// ════════════════════════════════════════════════════════════
"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import { grantBudgetLines, users, grants } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { notify, notifyMany } from "@/core/notifications/notify";
import { createAuditLog } from "@/core/audit/audit-trail";
import { computeBudgetWarning, type BudgetCheckResult } from "./warning-logic";

export type { BudgetCheckResult };

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── الفحص الشامل للميزانية مع التحذيرات ────────────────────────────────
export async function checkBudgetWithWarning(
  budgetLineId:   string,
  requestedAmount: number,
  organizationId:  string,
  requestedBy:     string,
  context?:        string, // "purchase_request:PR-001"
): Promise<ActionResult<BudgetCheckResult>> {
  try {
    const line = await db.query.grantBudgetLines.findFirst({
      where: eq(grantBudgetLines.id, budgetLineId),
    });
    if (!line) return { success:false, error:"خط الميزانية غير موجود" };

    const planned    = Number(line.plannedAmount);
    const spent      = Number(line.spentAmount);
    const committed  = Number(line.committedAmount);

    const { canProceed, utilizationPct, remainingAmount, warningLevel, message } = computeBudgetWarning({
      plannedAmount: planned, spentAmount: spent, committedAmount: committed,
      requestedAmount, warningThreshold: line.warningThreshold, blockThreshold: line.blockThreshold,
      lineName: line.nameAr ?? line.name,
    });

    // إرسال الإشعارات عند الحاجة
    if (warningLevel !== "ok") {
      const lastNotifiedAt = warningLevel === "warning"
        ? line.warning80NotifiedAt
        : line.warning95NotifiedAt;
      const alreadyNotifiedRecently = lastNotifiedAt &&
        (Date.now() - lastNotifiedAt.getTime()) < 24 * 60 * 60 * 1000;

      if (!alreadyNotifiedRecently) {
        // جلب مسؤولي المنحة
        const grant = await db.query.grants.findFirst({
          where: eq(grants.id, line.grantId),
        });

        const notifyUserIds = [requestedBy];
        if (grant?.createdBy && grant.createdBy !== requestedBy) {
          notifyUserIds.push(grant.createdBy);
        }

        const notifType = warningLevel === "blocked" ? "alert" : "warning";
        const icon = warningLevel === "blocked" ? "🔴" : warningLevel === "critical" ? "🟠" : "🟡";

        await notifyMany(notifyUserIds, {
          organizationId,
          title:   `${icon} ${warningLevel === "blocked" ? "تجاوز ميزانية" : "تحذير ميزانية"}`,
          titleAr: `${icon} ${warningLevel === "blocked" ? "تجاوز ميزانية" : "تحذير ميزانية"}`,
          body:    message,
          type:    notifType,
          link:    `/grants/${line.grantId}`,
        });

        // تحديث وقت آخر إشعار
        const notifiedField = warningLevel === "warning"
          ? { warning80NotifiedAt: new Date() }
          : { warning95NotifiedAt: new Date() };
        await db.update(grantBudgetLines)
          .set({ ...notifiedField, updatedAt: new Date() })
          .where(eq(grantBudgetLines.id, budgetLineId));
      }
    }

    return {
      success: true,
      data: {
        canProceed,
        utilizationPct,
        remainingAmount,
        plannedAmount:   planned,
        spentAmount:     spent,
        committedAmount: committed,
        warningLevel,
        message,
      },
    };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── مسح جميع خطوط الميزانية للمنحة وإرسال تقرير الحالة ──────────────────
export async function runBudgetHealthCheck(
  grantId:        string,
  organizationId: string,
  notifyUserId:   string,
): Promise<ActionResult<BudgetCheckResult[]>> {
  try {
    const lines = await db.query.grantBudgetLines.findMany({
      where: and(
        eq(grantBudgetLines.grantId, grantId),
        eq(grantBudgetLines.organizationId, organizationId),
      ),
    });

    const results: BudgetCheckResult[] = [];
    for (const line of lines) {
      const res = await checkBudgetWithWarning(
        line.id, 0, organizationId, notifyUserId
      );
      if (res.success) results.push(res.data);
    }

    const criticals = results.filter(r => r.warningLevel === "critical" || r.warningLevel === "blocked");
    if (criticals.length > 0) {
      await notify({
        organizationId,
        userId:  notifyUserId,
        title:   `تقرير صحة الميزانية: ${criticals.length} خط(وط) تحتاج انتباهاً`,
        titleAr: `تقرير صحة الميزانية: ${criticals.length} خط(وط) تحتاج انتباهاً`,
        body:    criticals.map(r => r.message).join(" | "),
        type:    "alert",
        link:    `/grants/${grantId}`,
      });
    }

    return { success:true, data:results };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
