"use server";
import { errMsg } from "@/types/db";
import { db }    from "@/db";
import { users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt    from "bcryptjs";

type UserRole = "super_admin"|"admin"|"finance_manager"|"program_manager"|"hr_manager"|"procurement_officer"|"warehouse_manager"|"viewer";
type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

export async function updateUser(
  id:string, values:{ name?:string; nameAr?:string; role?:UserRole }, orgId:string
): Promise<ActionResult<void>> {
  try {
    const patch: Record<string, unknown> = { updatedAt:new Date() };
    if (values.role) patch.role = values.role;
    if (values.name !== undefined) {
      const [firstName, ...rest] = values.name.trim().split(/\s+/);
      patch.firstName = firstName || "";
      patch.lastName  = rest.join(" ");
    }
    if (values.nameAr !== undefined) {
      const [firstNameAr, ...restAr] = values.nameAr.trim().split(/\s+/);
      patch.firstNameAr = firstNameAr || "";
      patch.lastNameAr  = restAr.join(" ");
    }
    await db.update(users).set(patch)
      .where(and(eq(users.id,id), eq(users.organizationId,orgId)));
    revalidatePath("/settings/users");
    return { success:true, data:undefined };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}

export async function toggleUser(id:string, isActive:boolean, orgId:string): Promise<ActionResult<void>> {
  try {
    await db.update(users).set({ isActive, updatedAt:new Date() })
      .where(and(eq(users.id,id), eq(users.organizationId,orgId)));
    revalidatePath("/settings/users");
    return { success:true, data:undefined };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}

export async function resetPassword(id:string, orgId:string): Promise<ActionResult<{ tempPassword:string }>> {
  try {
    // كلمة مرور مؤقتة: 8 أحرف عشوائية
    const chars   = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const tempPwd = Array.from({length:8}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
    const hashed  = await bcrypt.hash(tempPwd, 12);
    await db.update(users)
      .set({ passwordHash:hashed, updatedAt:new Date() })
      .where(and(eq(users.id,id), eq(users.organizationId,orgId)));
    return { success:true, data:{ tempPassword:tempPwd } };
  } catch (e) { return { success:false, error: errMsg(e) }; }
}
