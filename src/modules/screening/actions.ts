"use server";

import { db } from "@/db";
import { screeningRecords, partners, vendors, beneficiaries, employees } from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { computeNextScreeningDue } from "@/lib/screening/due-date";
import { textField, optionalTextField } from "@/lib/security/sanitize";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

const RecordScreeningSchema = z.object({
  organizationId: z.string().uuid(),
  entityType: z.enum(["partner","vendor","beneficiary","employee"]),
  entityId: z.string().uuid(),
  entityNameSnapshot: textField(200, 1),
  screenedAgainst: z.enum(["un_consolidated_list","ofac_sdn","eu_sanctions_list","uk_hmt_list","national_list","other"]),
  result: z.enum(["clear","potential_match","confirmed_match","pending_review"]),
  referenceNumber: optionalTextField(200),
  screeningNotes: optionalTextField(1000),
});

export async function recordScreening(formData: z.infer<typeof RecordScreeningSchema>, userId: string): Promise<ActionResult<{id:string}>> {
  try {
    const v = RecordScreeningSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("screening", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // IDOR: entityId يصل من العميل بلا تحقق سابقاً — تحقق صريح أن الكيان المُشار إليه
    // (شريك/مورد/مستفيد/موظف) فعلاً تابع لنفس المنظمة قبل أي إدراج (نفس نمط v35 الموثّق).
    // مُوحَّد الآن عبر assertOwnedByOrg بدل تكرار نفس استعلام findFirst أربع مرات
    // (راجع src/lib/auth/ownership.ts — أُضيفت v37 لمنع تكرار هذا النمط بموديولات جديدة).
    const ENTITY_TABLE = { partner: partners, vendor: vendors, beneficiary: beneficiaries, employee: employees } as const;
    if (!(await assertOwnedByOrg(ENTITY_TABLE[v.data.entityType], v.data.entityId, v.data.organizationId)))
      return { success:false, error:"غير موجود" }; // نفس رسالة الفشل العامة لمنع enumeration

    const screeningDate = new Date();
    const nextDue = computeNextScreeningDue(screeningDate, v.data.result);

    const [record] = await db.insert(screeningRecords).values({
      organizationId: v.data.organizationId, entityType: v.data.entityType, entityId: v.data.entityId,
      entityNameSnapshot: v.data.entityNameSnapshot, screenedAgainst: v.data.screenedAgainst,
      screeningDate, screenedBy: userId, result: v.data.result,
      referenceNumber: v.data.referenceNumber, screeningNotes: v.data.screeningNotes,
      nextScreeningDue: nextDue ?? undefined, createdBy: userId,
    }).returning();

    // ربط نتيجة الفحص المؤكد بحالة الفحص المسبق للشريك تلقائياً (إن كان الكيان شريكاً)
    if (v.data.entityType === "partner") {
      if (v.data.result === "confirmed_match") {
        await db.update(partners).set({ dueDiligenceStatus:"rejected", updatedBy:userId, updatedAt:new Date() }).where(and(eq(partners.id, v.data.entityId), eq(partners.organizationId, v.data.organizationId)));
      } else if (v.data.result === "clear") {
        await db.update(partners).set({ dueDiligenceStatus:"cleared", updatedBy:userId, updatedAt:new Date() }).where(and(eq(partners.id, v.data.entityId), eq(partners.organizationId, v.data.organizationId)));
      } else if (v.data.result === "potential_match") {
        await db.update(partners).set({ dueDiligenceStatus:"flagged", updatedBy:userId, updatedAt:new Date() }).where(and(eq(partners.id, v.data.entityId), eq(partners.organizationId, v.data.organizationId)));
      }
    }

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"screening_records", recordId:record.id, action:"CREATE",
      newValues:{ entityType: v.data.entityType, result: v.data.result, screenedAgainst: v.data.screenedAgainst },
    });

    revalidatePath("/screening");
    return { success:true, data:{ id:record.id } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function getScreeningHistory(organizationId: string, entityType: string, entityId: string) {
  const session = await requirePermission("screening", "view");
  if (!session.ok || !assertOrgMatches(organizationId, session)) return [];

  return db.query.screeningRecords.findMany({
    where: and(eq(screeningRecords.organizationId, organizationId), eq(screeningRecords.entityType, entityType as any), eq(screeningRecords.entityId, entityId)),
    orderBy: [desc(screeningRecords.screeningDate)],
    with: { screenedByUser: { columns: { firstName:true, lastName:true, firstNameAr:true, lastNameAr:true } } },
  });
}
