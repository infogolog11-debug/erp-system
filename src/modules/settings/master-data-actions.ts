"use server";
import { errMsg } from "@/types/db";

import { db }           from "@/db";
import {
  departments, positions, costCenters, currencies,
  itemCategories, warehouses, donors,
} from "@/db/schema";
import { and, eq }      from "drizzle-orm";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// خريطة الجداول
const TABLE_MAP: Record<string, any> = {
  departments, positions, costCenters, currencies,
  itemCategories, warehouses, donors,
};

// ─── تحديث سجل ─────────────────────────────────────────────────────────
export async function updateMasterDataRecord(
  tableKey:  string,
  id:        string,
  changes:   Record<string, string>,
  orgId:     string,
): Promise<ActionResult<void>> {
  try {
    const table = TABLE_MAP[tableKey];
    if (!table) return { success:false, error:"جدول غير معروف" };

    // تحويل القيم الرقمية
    const processed: Record<string,any> = { ...changes, updatedAt: new Date() };
    for (const key of ["gradeLevel","minSalary","maxSalary","exchangeRate"]) {
      if (processed[key] !== undefined) processed[key] = Number(processed[key]);
    }

    await db.update(table)
      .set(processed)
      .where(and(eq(table.id, id), eq(table.organizationId, orgId)));

    revalidatePath("/settings/master-data");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── تفعيل/تعطيل سجل ───────────────────────────────────────────────────
export async function toggleMasterDataRecord(
  tableKey: string,
  id:       string,
  isActive: boolean,
  orgId:    string,
): Promise<ActionResult<void>> {
  try {
    const table = TABLE_MAP[tableKey];
    if (!table) return { success:false, error:"جدول غير معروف" };

    await db.update(table)
      .set({ isActive, updatedAt: new Date() })
      .where(and(eq(table.id, id), eq(table.organizationId, orgId)));

    revalidatePath("/settings/master-data");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── إنشاء سجل جديد ────────────────────────────────────────────────────
export async function createMasterDataRecord(
  tableKey: string,
  values:   Record<string, string>,
  orgId:    string,
): Promise<ActionResult<any>> {
  try {
    const table = TABLE_MAP[tableKey];
    if (!table) return { success:false, error:"جدول غير معروف" };

    // التحقق من الحقول الإلزامية
    if (!values.code?.trim()) return { success:false, error:"الكود مطلوب" };
    if (!values.name?.trim() && !values.nameAr?.trim() && !values.title?.trim() && !values.titleAr?.trim())
      return { success:false, error:"الاسم مطلوب" };

    // تحويل القيم الرقمية
    const processed: Record<string,any> = { ...values, organizationId: orgId };
    for (const key of ["gradeLevel","minSalary","maxSalary","exchangeRate"]) {
      if (processed[key] !== undefined && processed[key] !== "")
        processed[key] = Number(processed[key]);
    }
    if (processed.isActive !== undefined) processed.isActive = processed.isActive !== "false";

    // حذف الحقول الفارغة
    Object.keys(processed).forEach(k => {
      if (processed[k] === "" || processed[k] === undefined) delete processed[k];
    });

    const inserted = await db.insert(table).values({
      ...processed,
      createdBy: "system",
    }).returning() as Array<Record<string, unknown>>;
    const [record] = inserted;

    revalidatePath("/settings/master-data");
    return { success:true, data:record };
  } catch (e) {
    if (errMsg(e)?.includes("unique")) return { success:false, error:"الكود مستخدم مسبقاً" };
    return { success:false, error: errMsg(e) };
  }
}
