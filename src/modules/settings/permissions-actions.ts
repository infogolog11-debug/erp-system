"use server";
import { errMsg } from "@/types/db";
import { db }                   from "@/db";
import { userModulePermissions } from "@/db/schema";
import { and, eq }              from "drizzle-orm";
import { revalidatePath }       from "next/cache";
import type { PermissionLevel, ModuleCode } from "@/lib/permissions/service";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

// تعيين / تحديث صلاحية مستخدم لوحدة
export async function setUserPermission(
  userId:         string,
  moduleCode:     ModuleCode,
  permission:     PermissionLevel,
  grantedBy:      string,
  organizationId: string,
  constraints?:   Record<string,any>,
): Promise<ActionResult<void>> {
  try {
    // تحقق: لا يمكن منح صلاحية أعلى مما يملكه المانح
    const existing = await db.query.userModulePermissions.findFirst({
      where: and(
        eq(userModulePermissions.userId,         userId),
        eq(userModulePermissions.organizationId, organizationId),
        eq(userModulePermissions.moduleCode,     moduleCode),
      ),
    });

    if (existing) {
      await db.update(userModulePermissions)
        .set({ permission, constraints, grantedBy, updatedAt:new Date() })
        .where(eq(userModulePermissions.id, existing.id));
    } else {
      await db.insert(userModulePermissions).values({
        userId, organizationId, moduleCode, permission,
        constraints, grantedBy,
      });
    }

    revalidatePath("/settings/permissions");
    return { success:true, data:undefined };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}

// حذف صلاحية مخصصة (يعود للـ role default)
export async function resetUserPermission(
  userId:         string,
  moduleCode:     string,
  organizationId: string,
): Promise<ActionResult<void>> {
  try {
    await db.delete(userModulePermissions)
      .where(and(
        eq(userModulePermissions.userId,         userId),
        eq(userModulePermissions.organizationId, organizationId),
        eq(userModulePermissions.moduleCode,     moduleCode),
      ));
    revalidatePath("/settings/permissions");
    return { success:true, data:undefined };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}

// جلب صلاحيات جميع المستخدمين
export async function getAllPermissions(
  organizationId: string,
): Promise<ActionResult<any[]>> {
  try {
    const perms = await db.query.userModulePermissions.findMany({
      where: eq(userModulePermissions.organizationId, organizationId),
      with:  { user: { columns:{ id:true, email:true, role:true } } },
    });
    return { success:true, data:perms };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}
