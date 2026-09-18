"use server";
import { errMsg } from "@/types/db";
import { db }          from "@/db";
import { approvalRules } from "@/db/schema";
import { and, eq }     from "drizzle-orm";
import { revalidatePath } from "next/cache";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

type UserRole = "super_admin"|"admin"|"finance_manager"|"program_manager"|"hr_manager"|"procurement_officer"|"warehouse_manager"|"viewer";

export async function saveApprovalRule(
  orgId:   string,
  id:      string | null,
  values:  {
    moduleCode:string; minAmount:number; maxAmount:number|null;
    approvalLevel:number; levelName:string;
    approverUserId:string|null; approverRole:UserRole|null;
    slaHours:number; isActive:boolean;
  },
): Promise<ActionResult<{ id:string }>> {
  try {
    const payload = {
      organizationId: orgId,
      moduleCode:     values.moduleCode,
      minAmount:      String(values.minAmount),
      maxAmount:      values.maxAmount !== null ? String(values.maxAmount) : null,
      approvalLevel:  values.approvalLevel,
      levelName:      values.levelName,
      levelNameAr:    values.levelName,
      approverUserId: values.approverUserId,
      approverRole:   values.approverRole,
      slaHours:       values.slaHours,
      isActive:       values.isActive,
      updatedAt:      new Date(),
    };

    if (id) {
      await db.update(approvalRules).set(payload).where(
        and(eq(approvalRules.id, id), eq(approvalRules.organizationId, orgId))
      );
      revalidatePath("/settings/approval-matrix");
      return { success:true, data:{ id } };
    } else {
      const [row] = await db.insert(approvalRules).values({
        ...payload, createdBy:"system",
      }).returning();
      revalidatePath("/settings/approval-matrix");
      return { success:true, data:{ id:row.id } };
    }
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

export async function deleteApprovalRule(id:string, orgId:string): Promise<ActionResult<void>> {
  try {
    await db.delete(approvalRules).where(
      and(eq(approvalRules.id, id), eq(approvalRules.organizationId, orgId))
    );
    revalidatePath("/settings/approval-matrix");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
