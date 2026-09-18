"use server";
import { errMsg } from "@/types/db";

import { db }           from "@/db";
import { systemSettings } from "@/db/schema";
import { and, eq }      from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/core/audit/audit-trail";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

export async function updateSetting(
  organizationId: string,
  category:       string,
  settingKey:     string,
  value:          string,
  updatedBy:      string,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("settings", "admin");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // التحقق من القيمة حسب الحدود
    const existing = await db.query.systemSettings.findFirst({
      where: and(
        eq(systemSettings.organizationId, organizationId),
        eq(systemSettings.category,       category),
        eq(systemSettings.settingKey,     settingKey),
      ),
    });

    if (!existing) return { success:false, error:"الإعداد غير موجود" };

    // التحقق من الحدود
    if (existing.valueType === "number") {
      const num = parseFloat(value);
      if (isNaN(num)) return { success:false, error:"القيمة يجب أن تكون رقماً" };
      if (existing.minValue && num < parseFloat(existing.minValue))
        return { success:false, error:`الحد الأدنى المسموح: ${existing.minValue}` };
      if (existing.maxValue && num > parseFloat(existing.maxValue))
        return { success:false, error:`الحد الأعلى المسموح: ${existing.maxValue}` };
    }

    const oldValue = existing.value;

    await db.update(systemSettings)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(and(
        eq(systemSettings.organizationId, organizationId),
        eq(systemSettings.settingKey,     settingKey),
      ));

    await createAuditLog({
      organizationId, userId: updatedBy,
      tableName: "system_settings", recordId: existing.id,
      action: "UPDATE",
      oldValues: { [settingKey]: oldValue },
      newValues: { [settingKey]: value },
    });

    revalidatePath("/settings");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// حفظ مجموعة إعدادات دفعةً واحدة (للنماذج الكبيرة)
export async function updateSettingsBatch(
  organizationId: string,
  updates: Array<{ category:string; key:string; value:string }>,
  updatedBy: string,
): Promise<ActionResult<{ saved:number }>> {
  try {
    // ── كل إعداد مستقل (settingKey مختلف)، فما فيه تعارض بينهم — نشغّلهم
    //    كلهم بالتوازي بدل استعلام تسلسلي واحد تلو الآخر ──
    const results = await Promise.all(
      updates.map(u => updateSetting(organizationId, u.category, u.key, u.value, updatedBy))
    );
    const saved = results.filter(r => r.success).length;
    revalidatePath("/settings");
    return { success:true, data:{ saved } };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
