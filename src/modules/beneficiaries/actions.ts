"use server";

import { db } from "@/db";
import {
  beneficiaries, householdMembers, caseRecords, caseNotes, distributions, items, grants,
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, count, sql } from "drizzle-orm";
import { z } from "zod";
import { textField, optionalTextField, sanitizeText } from "@/lib/security/sanitize";
import { buildDuplicateCheckHash, similarityScore } from "@/lib/beneficiaries/duplicate-detection";
import { requireSession, requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";
import { issueStock } from "@/lib/inventory/stock-movement";
import { withIdempotency, IdempotencyInProgressError } from "@/lib/idempotency/guard";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── Validation Schemas ───────────────────
const HouseholdMemberSchema = z.object({
  fullName: textField(150, 1),
  relationship: textField(100, 1),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.enum(["male","female"]).optional(),
  isVulnerable: z.boolean().optional(),
  vulnerabilityNote: optionalTextField(500),
});

const CreateBeneficiarySchema = z.object({
  organizationId: z.string().uuid(),
  grantId:        z.string().uuid().optional(),
  firstName:      textField(100, 1),
  lastName:       textField(100, 1),
  fullNameAr:     optionalTextField(200),
  dateOfBirth:    z.string().optional(),
  gender:         z.enum(["male","female"]),
  nationalId:     z.string().optional(),
  phone:          z.string().optional(),
  governorate:    optionalTextField(100),
  district:       optionalTextField(100),
  community:      optionalTextField(100),
  addressDetail:  optionalTextField(500),
  latitude:  z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  householdSize:  z.number().int().min(1).default(1),
  vulnerabilityCategory: z.enum([
    "none","elderly","disability","chronic_illness","female_headed_household",
    "child_headed_household","unaccompanied_minor","pregnant_lactating","other",
  ]).default("none"),
  vulnerabilityScore: z.number().int().min(0).max(100).default(0),
  householdMembers: z.array(HouseholdMemberSchema).default([]),
  // إذا صحيح: تجاوز تحذير الازدواجية عمداً بعد مراجعة يدوية
  overrideDuplicateWarning: z.boolean().optional(),
});

// ─── فحص الازدواجية قبل التسجيل ───────────────────
export async function checkDuplicates(
  organizationId: string,
  firstName: string,
  lastName: string,
  dateOfBirth?: string,
  nationalId?: string,
) {
  const session = await requireSession();
  if (!session.ok || !assertOrgMatches(organizationId, session)) return [];

  const hash = buildDuplicateCheckHash({ firstName, lastName, dateOfBirth, nationalId });

  const exactMatches = await db.query.beneficiaries.findMany({
    where: and(
      eq(beneficiaries.organizationId, organizationId),
      eq(beneficiaries.duplicateCheckHash, hash),
    ),
    limit: 5,
  });

  // مطابقات محتملة إضافية: نفس رقم الهوية إن وُجد
  let nationalIdMatches: typeof exactMatches = [];
  if (nationalId) {
    nationalIdMatches = await db.query.beneficiaries.findMany({
      where: and(
        eq(beneficiaries.organizationId, organizationId),
        eq(beneficiaries.nationalId, nationalId),
      ),
      limit: 5,
    });
  }

  const merged = [...exactMatches, ...nationalIdMatches.filter(n => !exactMatches.some(e => e.id === n.id))];

  return merged.map(m => ({
    id: m.id,
    code: m.code,
    fullName: `${m.firstName} ${m.lastName}`,
    similarity: similarityScore(`${firstName} ${lastName}`, `${m.firstName} ${m.lastName}`),
    verificationStatus: m.verificationStatus,
  }));
}

// ─── تسجيل مستفيد جديد ─────────────────────
export async function createBeneficiary(
  formData: z.infer<typeof CreateBeneficiarySchema>,
  userId: string,
): Promise<ActionResult<{id:string; code:string; duplicatesFound:number}>> {
  try {
    const v = CreateBeneficiarySchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("beneficiaries", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const hash = buildDuplicateCheckHash({
      firstName: v.data.firstName, lastName: v.data.lastName,
      dateOfBirth: v.data.dateOfBirth, nationalId: v.data.nationalId,
    });

    const duplicates = await checkDuplicates(
      v.data.organizationId, v.data.firstName, v.data.lastName,
      v.data.dateOfBirth, v.data.nationalId,
    );

    // إن وُجدت مطابقة قوية (>=80%) ولم يتم تجاوزها صراحةً، أوقف التسجيل واطلب مراجعة يدوية
    const strongMatch = duplicates.find(d => d.similarity >= 80);
    if (strongMatch && !v.data.overrideDuplicateWarning) {
      return {
        success:false,
        error:`مستفيد محتمل مطابق موجود مسبقاً: ${strongMatch.fullName} (${strongMatch.code}) — راجع قبل المتابعة`,
      };
    }

    // توليد كود تسلسلي: BEN-YYYY-000001
    const year = new Date().getFullYear();
    const [{ cnt }] = await db.select({ cnt: count() }).from(beneficiaries)
      .where(eq(beneficiaries.organizationId, v.data.organizationId));
    const code = `BEN-${year}-${String(Number(cnt)+1).padStart(6,"0")}`;

    const [beneficiary] = await db.insert(beneficiaries).values({
      organizationId: v.data.organizationId,
      grantId: v.data.grantId,
      code,
      firstName: v.data.firstName,
      lastName: v.data.lastName,
      fullNameAr: v.data.fullNameAr,
      dateOfBirth: v.data.dateOfBirth,
      gender: v.data.gender,
      nationalId: v.data.nationalId,
      phone: v.data.phone,
      governorate: v.data.governorate,
      district: v.data.district,
      community: v.data.community,
      addressDetail: v.data.addressDetail,
      latitude: v.data.latitude != null ? String(v.data.latitude) : undefined,
      longitude: v.data.longitude != null ? String(v.data.longitude) : undefined,
      householdSize: v.data.householdSize,
      vulnerabilityCategory: v.data.vulnerabilityCategory,
      vulnerabilityScore: v.data.vulnerabilityScore,
      verificationStatus: strongMatch ? "flagged_duplicate" : "pending",
      duplicateCheckHash: hash,
      createdBy: userId,
    }).returning();

    if (v.data.householdMembers.length > 0) {
      await db.insert(householdMembers).values(
        v.data.householdMembers.map(m => ({
          beneficiaryId: beneficiary.id,
          organizationId: v.data.organizationId,
          fullName: m.fullName,
          relationship: m.relationship,
          age: m.age,
          gender: m.gender,
          isVulnerable: m.isVulnerable ?? false,
          vulnerabilityNote: m.vulnerabilityNote,
          createdBy: userId,
        }))
      );
    }

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName: "beneficiaries", recordId: beneficiary.id,
      action: "CREATE", newValues: { code, firstName: v.data.firstName, lastName: v.data.lastName },
    });

    revalidatePath("/beneficiaries");
    return { success:true, data:{ id:beneficiary.id, code, duplicatesFound: duplicates.length } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── التحقق من مستفيد ─────────────────────
export async function verifyBeneficiary(
  beneficiaryId: string, userId: string, organizationId: string,
  decision: "verified"|"rejected",
): Promise<ActionResult> {
  try {
    const session = await requirePermission("beneficiaries", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const existing = await db.query.beneficiaries.findFirst({ where: eq(beneficiaries.id, beneficiaryId) });
    if (!existing) return { success:false, error:"المستفيد غير موجود" };
    if (existing.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };

    await db.update(beneficiaries)
      .set({ verificationStatus: decision, verifiedBy: userId, verifiedAt: new Date(), updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(beneficiaries.id, beneficiaryId), eq(beneficiaries.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId, tableName:"beneficiaries", recordId:beneficiaryId,
      action: decision === "verified" ? "APPROVE" : "REJECT",
      oldValues:{ verificationStatus: existing.verificationStatus },
      newValues:{ verificationStatus: decision },
    });

    revalidatePath("/beneficiaries");
    revalidatePath(`/beneficiaries/${beneficiaryId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── إدارة الحالات (Case Management) ─────────────────────
const CreateCaseSchema = z.object({
  organizationId: z.string().uuid(),
  beneficiaryId:  z.string().uuid(),
  caseType: z.enum(["protection","referral","complaint","assistance_request","follow_up","other"]),
  priority: z.enum(["low","medium","high","urgent"]).default("medium"),
  description: textField(2000, 1),
  isConfidential: z.boolean().default(true),
});
export async function createCase(
  formData: z.infer<typeof CreateCaseSchema>, userId: string,
): Promise<ActionResult<{id:string; code:string}>> {
  try {
    const v = CreateCaseSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("beneficiaries", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const [{ cnt }] = await db.select({ cnt: count() }).from(caseRecords)
      .where(eq(caseRecords.organizationId, v.data.organizationId));
    const code = `CASE-${new Date().getFullYear()}-${String(Number(cnt)+1).padStart(5,"0")}`;

    const [caseRecord] = await db.insert(caseRecords).values({
      ...v.data, code, createdBy: userId,
    }).returning();

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"case_records", recordId:caseRecord.id, action:"CREATE",
      newValues:{ code, caseType: v.data.caseType, priority: v.data.priority },
    });

    revalidatePath(`/beneficiaries/${v.data.beneficiaryId}`);
    return { success:true, data:{ id:caseRecord.id, code } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function addCaseNote(
  caseId: string, organizationId: string, beneficiaryId: string, note: string, userId: string,
): Promise<ActionResult> {
  try {
    if (!note.trim()) return { success:false, error:"الملاحظة فارغة" };

    const session = await requirePermission("beneficiaries", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v35 — نمط "إدراج سجل فرعي" لم يكن مغطى: caseId مُرسَل من
    // العميل مع organizationId، ويُتحقَّق فقط أن organizationId يطابق جلسة
    // المستخدم — بلا أي تحقق أن caseId نفسه فعلاً يخص هذه المنظمة. مستخدم
    // من منظمة A كان يقدر يُرفق ملاحظة على حالة (case) تابعة لمنظمة B عبر
    // تمرير organizationId الصحيح لمنظمته مع caseId أجنبي. نفس النمط
    // بالضبط موجود بـ`addComplaintUpdate` (cfm/actions.ts) و`addPayrollAdjustment`
    // (hr/actions.ts) — أُصلح الثلاثة بنفس الجولة.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(caseRecords, caseId, organizationId))) {
      return { success:false, error:"الحالة غير موجودة أو لا تتبع هذه المنظمة" };
    }

    const [caseNote] = await db.insert(caseNotes).values({ caseId, organizationId, note: sanitizeText(note), createdBy: userId }).returning();
    // إصلاح (audit log integrity v35): كانت هذه الدالة تُدرج بلا أي تسجيل تدقيق.
    await createAuditLog({ organizationId, userId, tableName:"case_notes", recordId:caseNote.id, action:"CREATE", newValues:{ caseId } });
    revalidatePath(`/beneficiaries/${beneficiaryId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function updateCaseStatus(
  caseId: string, organizationId: string, beneficiaryId: string,
  status: "open"|"in_progress"|"referred"|"closed", userId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("beneficiaries", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(caseRecords)
      .set({
        caseStatus: status,
        closedDate: status === "closed" ? new Date() : null,
        updatedBy: userId, updatedAt: new Date(),
      })
      .where(and(eq(caseRecords.id, caseId), eq(caseRecords.organizationId, organizationId)));
    revalidatePath(`/beneficiaries/${beneficiaryId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── التوزيعات (Distribution Management) ─────────────────────
const CreateDistributionSchema = z.object({
  organizationId: z.string().uuid(),
  beneficiaryId:  z.string().uuid(),
  grantId:        z.string().uuid(),
  itemId:         z.string().uuid().optional(),
  distributionType: z.enum(["in_kind","cash","voucher","service"]),
  quantity:   z.number().positive().optional(),
  cashAmount: z.number().positive().optional(),
  currencyCode: z.string().optional(),
  location: optionalTextField(200),
  // مفتاح idempotency اختياري من العميل (مثلاً uuid يُولَّد عند فتح الفورم)
  // يمنع تكرار نفس التوزيع لو انقطعت الشبكة وأعاد العميل الإرسال تلقائياً
  idempotencyKey: z.string().max(200).optional(),
});

export async function createDistribution(
  formData: z.infer<typeof CreateDistributionSchema>, userId: string,
): Promise<ActionResult<{id:string}>> {
  const v = CreateDistributionSchema.safeParse(formData);
  if (!v.success) return { success:false, error:v.error.errors[0].message };

  const session = await requirePermission("beneficiaries", "create");
  if (!session.ok) return { success:false, error:session.error };
  if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

  if (v.data.distributionType !== "cash" && !v.data.itemId)
    return { success:false, error:"يجب تحديد الصنف للتوزيع العيني" };
  if (v.data.distributionType === "cash" && !v.data.cashAmount)
    return { success:false, error:"يجب تحديد المبلغ للتوزيع النقدي" };

  // إصلاح IDOR إضافي (لم يكن مغطى سابقاً): assertOrgMatches فوق يتحقق فقط
  // من أن organizationId المُرسَل من العميل يطابق جلسة المستخدم — لكنه لا
  // يتحقق أن beneficiaryId/grantId المُرسَلان فعلاً تابعان لنفس المنظمة.
  // مستخدم من منظمة A كان يقدر يمرّر organizationId الصحيح لمنظمته (فيمر
  // فحص assertOrgMatches) مع beneficiaryId/grantId يخصان منظمة B، فيربط
  // توزيعاً بسجلات منظمة أخرى دون أي منع. itemId محمي فعلياً بشرط
  // organization_id داخل issueStock، لكن هذين لم يكونا محميين إطلاقاً.
  // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md. رسالتان
  // منفصلتان (لا assertAllOwnedByOrg) لتمييز أي حقل تحديداً غير صالح للمستخدم.
  if (!(await assertOwnedByOrg(beneficiaries, v.data.beneficiaryId, v.data.organizationId)))
    return { success:false, error:"المستفيد غير موجود أو لا يتبع هذه المنظمة" };
  if (!(await assertOwnedByOrg(grants, v.data.grantId, v.data.organizationId)))
    return { success:false, error:"المنحة غير موجودة أو لا تتبع هذه المنظمة" };

  try {
    return await withIdempotency(v.data.organizationId, v.data.idempotencyKey, "createDistribution", async () => {
      // كل شي (خصم المخزون + تسجيل التوزيع) بمعاملة واحدة: لو فشل أي جزء
      // يُلغى الاثنان معاً — قبل هذا الإصلاح كان الخصم منفصلاً عن الإدراج
      // فيمكن أن يُخصَم المخزون وتفشل عملية التوزيع فتضيع الكمية بلا أثر
      const dist = await db.transaction(async (tx) => {
        if (v.data.itemId && v.data.quantity) {
          const stockResult = await issueStock(tx, {
            organizationId: v.data.organizationId,
            itemId: v.data.itemId,
            quantity: v.data.quantity,
            grantId: v.data.grantId,
            referenceTable: "distributions",
            idempotencyKey: v.data.idempotencyKey,
            userId,
          });
          if (!stockResult.success) throw new Error(stockResult.error);
        }

        const [row] = await tx.insert(distributions).values({
          organizationId: v.data.organizationId,
          beneficiaryId: v.data.beneficiaryId,
          grantId: v.data.grantId,
          itemId: v.data.itemId,
          distributionType: v.data.distributionType,
          quantity: v.data.quantity != null ? String(v.data.quantity) : undefined,
          cashAmount: v.data.cashAmount != null ? String(v.data.cashAmount) : undefined,
          currencyCode: v.data.currencyCode,
          location: v.data.location,
          distributedBy: userId,
          createdBy: userId,
        }).returning();

        // إصلاح v32: تسجيل التدقيق صار جزءاً من نفس المعاملة (tx) بدل
        // استدعاء منفصل بعد commit — لو فشل تسجيل التدقيق، يُلغى التوزيع
        // وخصم المخزون معه (rollback واحد للكل)، بدل عملية ناجحة بصمت
        // مع فجوة بسجل التدقيق.
        await createAuditLog({
          organizationId: v.data.organizationId, userId,
          tableName:"distributions", recordId:row.id, action:"CREATE",
          newValues:{ distributionType: v.data.distributionType, beneficiaryId: v.data.beneficiaryId },
        }, tx);

        return row;
      });

      revalidatePath(`/beneficiaries/${v.data.beneficiaryId}`);
      return { success:true as const, data:{ id:dist.id } };
    });
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    return { success:false, error: e instanceof Error && e.message ? e.message : "حدث خطأ غير متوقع" };
  }
}
