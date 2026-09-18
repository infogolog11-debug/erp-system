"use server";

import { db } from "@/db";
import { partners, subGrants, subGrantDisbursements, partnerReports, grants } from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, count, sql } from "drizzle-orm";
import { z } from "zod";
import { textField, optionalTextField, sanitizeText } from "@/lib/security/sanitize";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";
import { withIdempotency, IdempotencyInProgressError } from "@/lib/idempotency/guard";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

// ─── تسجيل شريك منفّذ ─────────────────────
const CreatePartnerSchema = z.object({
  organizationId: z.string().uuid(),
  name: textField(200, 1),
  nameAr: optionalTextField(200),
  partnerType: z.enum(["local_ngo","international_ngo","government","community_based","private_sector","un_agency"]),
  country: optionalTextField(100),
  registrationNumber: optionalTextField(100),
  contactPerson: optionalTextField(150),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  capacityAssessmentScore: z.number().int().min(0).max(100).optional(),
});

export async function createPartner(
  formData: z.infer<typeof CreatePartnerSchema>, userId: string,
): Promise<ActionResult<{id:string; code:string}>> {
  try {
    const v = CreatePartnerSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("partners", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const [{ cnt }] = await db.select({ cnt: count() }).from(partners)
      .where(eq(partners.organizationId, v.data.organizationId));
    const code = `PTR-${String(Number(cnt)+1).padStart(4,"0")}`;

    const [partner] = await db.insert(partners).values({
      organizationId: v.data.organizationId,
      code, name: v.data.name, nameAr: v.data.nameAr,
      partnerType: v.data.partnerType, country: v.data.country,
      registrationNumber: v.data.registrationNumber,
      contactPerson: v.data.contactPerson,
      email: v.data.email || undefined,
      phone: v.data.phone,
      capacityAssessmentScore: v.data.capacityAssessmentScore,
      capacityAssessmentDate: v.data.capacityAssessmentScore != null ? new Date() : undefined,
      createdBy: userId,
    }).returning();

    await createAuditLog({
      organizationId: v.data.organizationId, userId,
      tableName:"partners", recordId:partner.id, action:"CREATE",
      newValues:{ code, name: v.data.name },
    });

    revalidatePath("/partners");
    return { success:true, data:{ id:partner.id, code } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function updateDueDiligence(
  partnerId: string, organizationId: string, userId: string,
  status: "pending"|"cleared"|"flagged"|"rejected", notes?: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("partners", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(partners)
      .set({ dueDiligenceStatus: status, dueDiligenceNotes: notes, updatedBy: userId, updatedAt: new Date() })
      .where(and(eq(partners.id, partnerId), eq(partners.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId, tableName:"partners", recordId:partnerId,
      action:"UPDATE", newValues:{ dueDiligenceStatus: status },
    });

    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── المنح الفرعية ─────────────────────
const CreateSubGrantSchema = z.object({
  organizationId: z.string().uuid(),
  parentGrantId: z.string().uuid(),
  partnerId: z.string().uuid(),
  currencyId: z.string().uuid(),
  title: textField(300, 1),
  totalAmount: z.number().positive(),
  startDate: z.string(),
  endDate: z.string(),
  description: optionalTextField(2000),
  idempotencyKey: z.string().max(120).optional(),
});

export async function createSubGrant(
  formData: z.infer<typeof CreateSubGrantSchema>, userId: string,
): Promise<ActionResult<{id:string; code:string}>> {
  try {
    const v = CreateSubGrantSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("partners", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // منع سحب موارد الشريك ما لم تُنجَز عملية الفحص المسبق (Due Diligence)
    const partner = await db.query.partners.findFirst({ where: eq(partners.id, v.data.partnerId) });
    if (!partner) return { success:false, error:"الشريك غير موجود" };
    // IDOR (اكتُشفت أثناء إغلاق ثغرات v35): partnerId وparentGrantId لم يكونا
    // يُتحقَّق من ملكيتهما للمنظمة إطلاقاً — كان يمكن ربط منحة فرعية بشريك أو
    // بمنحة أب تابعين لمنظمة أخرى بالكامل. نفس نمط الثغرات الموثّقة سابقاً.
    if (partner.organizationId !== v.data.organizationId) return { success:false, error:"الشريك غير موجود" };
    if (partner.dueDiligenceStatus === "rejected")
      return { success:false, error:"لا يمكن إنشاء منحة فرعية — الشريك مرفوض بعد الفحص المسبق" };

    // مُوحَّد عبر assertOwnedByOrg بدل استعلام findFirst مخصص (راجع src/lib/auth/ownership.ts).
    if (!(await assertOwnedByOrg(grants, v.data.parentGrantId, v.data.organizationId)))
      return { success:false, error:"المنحة الأم غير موجودة" };

    const result = await withIdempotency(v.data.organizationId, v.data.idempotencyKey, "createSubGrant", async () => {
      const [{ cnt }] = await db.select({ cnt: count() }).from(subGrants)
        .where(eq(subGrants.organizationId, v.data.organizationId));
      const code = `SG-${new Date().getFullYear()}-${String(Number(cnt)+1).padStart(4,"0")}`;

      const [subGrant] = await db.insert(subGrants).values({
        organizationId: v.data.organizationId,
        parentGrantId: v.data.parentGrantId,
        partnerId: v.data.partnerId,
        currencyId: v.data.currencyId,
        code, title: v.data.title,
        totalAmount: String(v.data.totalAmount),
        startDate: new Date(v.data.startDate),
        endDate: new Date(v.data.endDate),
        description: v.data.description,
        createdBy: userId,
      }).returning();

      await createAuditLog({
        organizationId: v.data.organizationId, userId,
        tableName:"sub_grants", recordId:subGrant.id, action:"CREATE",
        newValues:{ code, title: v.data.title, totalAmount: v.data.totalAmount },
      });

      return { success:true as const, data:{ id:subGrant.id, code } };
    });

    revalidatePath(`/partners/${v.data.partnerId}`);
    return result;
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function activateSubGrant(subGrantId: string, partnerId: string, organizationId: string, userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("partners", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sg = await db.query.subGrants.findFirst({ where: eq(subGrants.id, subGrantId) });
    if (!sg) return { success:false, error:"المنحة الفرعية غير موجودة" };
    if (sg.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!sg.agreementSignedDate)
      return { success:false, error:"لا يمكن التفعيل قبل تسجيل تاريخ توقيع الاتفاقية" };

    await db.update(subGrants)
      .set({ subGrantStatus:"active", updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(subGrants.id, subGrantId), eq(subGrants.organizationId, organizationId)));

    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function signAgreement(subGrantId: string, partnerId: string, organizationId: string, signedDate: string, userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("partners", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sg = await db.query.subGrants.findFirst({ where: eq(subGrants.id, subGrantId) });
    if (!sg) return { success:false, error:"المنحة الفرعية غير موجودة" };
    if (sg.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };

    await db.update(subGrants)
      .set({ agreementSignedDate: new Date(signedDate), updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(subGrants.id, subGrantId), eq(subGrants.organizationId, organizationId)));
    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── الصرفيات (Disbursements) ─────────────────────
const CreateDisbursementSchema = z.object({
  organizationId: z.string().uuid(),
  subGrantId: z.string().uuid(),
  amount: z.number().positive(),
  method: optionalTextField(100),
  referenceNumber: optionalTextField(150),
  idempotencyKey: z.string().max(120).optional(),
});

export async function createDisbursement(
  formData: z.infer<typeof CreateDisbursementSchema>, partnerId: string, userId: string,
): Promise<ActionResult<{id:string}>> {
  try {
    const v = CreateDisbursementSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("partners", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sg = await db.query.subGrants.findFirst({ where: eq(subGrants.id, v.data.subGrantId) });
    if (!sg) return { success:false, error:"المنحة الفرعية غير موجودة" };
    if (sg.organizationId !== v.data.organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    const remaining = Number(sg.totalAmount) - Number(sg.disbursedAmount);
    if (v.data.amount > remaining)
      return { success:false, error:`المبلغ يتجاوز الرصيد المتبقي (${remaining.toLocaleString()})` };

    // Idempotency (مطلوب صراحة v35): كانت createDisbursement بدون حماية —
    // نقرة مزدوجة أو retry شبكة على "صرف" فعلي قبل هذا الإصلاح ينتج سندي
    // صرف حقيقيين منفصلين (القيد الذرّي بالأسفل يمنع فقط تجاوز السقف
    // الإجمالي، لا التكرار نفسه إن كان كل صرف بمفرده ضمن الحد المتبقي).
    return await withIdempotency(v.data.organizationId, v.data.idempotencyKey, "createDisbursement", async () => {
      return await createDisbursementInner(v.data, partnerId, userId);
    });
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
    return { success:false, error: msg.includes("يتجاوز") ? msg : "حدث خطأ غير متوقع" };
  }
}

async function createDisbursementInner(
  v: z.infer<typeof CreateDisbursementSchema>, partnerId: string, userId: string,
): Promise<ActionResult<{id:string}>> {
  try {

    // إصلاح Race Condition حقيقي (v35): كان فحص "المبلغ يتجاوز الرصيد
    // المتبقي" أعلاه قراءة منفصلة عن كتابتين لاحقتين (INSERT سند الصرف ثم
    // UPDATE منفصل تماماً بلا حتى معاملة tx واحدة تجمعهما) — نفس فئة ثغرة
    // خصم المخزون/الميزانية. صرفان متزامنان قريبان من الرصيد المتبقي كانا
    // يقدران يمرّان الفحص معاً ويُنتجان disbursedAmount أكبر من totalAmount
    // فعلياً؛ وحتى بلا تزامن، فشل الـUPDATE بعد نجاح الـINSERT كان يترك سند
    // صرف "مكتمل" مسجَّلاً دون أن ينعكس على رصيد المنحة الفرعية (لا rollback
    // لعدم وجود transaction تجمعهما). الحل: كل شي بمعاملة واحدة، والتحديث
    // نفسه شرط ذرّي (WHERE disbursed_amount + amount <= total_amount) بدل
    // الاعتماد فقط على القراءة المسبقة أعلاه (تبقى كفحص إرشادي مبكر فقط).
    const disb = await db.transaction(async (tx) => {
      const updated = await tx.update(subGrants)
        .set({ disbursedAmount: sql`${subGrants.disbursedAmount} + ${v.amount}` })
        .where(and(
          eq(subGrants.id, v.subGrantId),
          eq(subGrants.organizationId, v.organizationId),
          sql`total_amount - disbursed_amount >= ${String(v.amount)}`,
        ))
        .returning({ id: subGrants.id });
      if (updated.length === 0) {
        throw new Error("المبلغ يتجاوز الرصيد المتبقي (تم الرفض لمنع تجاوز مبلغ المنحة الفرعية — قد تكون معاملة صرف متزامنة استهلكت الرصيد)");
      }

      const [row] = await tx.insert(subGrantDisbursements).values({
        organizationId: v.organizationId,
        subGrantId: v.subGrantId,
        amount: String(v.amount),
        method: v.method,
        referenceNumber: v.referenceNumber,
        disbursementStatus: "completed",
        approvedBy: userId,
        createdBy: userId,
      }).returning();

      await createAuditLog({
        organizationId: v.organizationId, userId,
        tableName:"sub_grant_disbursements", recordId:row.id, action:"CREATE",
        newValues:{ amount: v.amount, subGrantId: v.subGrantId },
      }, tx);

      return row;
    });

    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:{ id:disb.id } };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
    return { success:false, error: msg.includes("يتجاوز") ? msg : "حدث خطأ غير متوقع" };
  }
}

// ─── تقارير الشريك (Narrative + Financial) ─────────────────────
const SubmitReportSchema = z.object({
  organizationId: z.string().uuid(),
  subGrantId: z.string().uuid(),
  periodStart: z.string(),
  periodEnd: z.string(),
  narrativeReport: optionalTextField(3000),
  financialReportAmount: z.number().nonnegative().optional(),
});

export async function submitPartnerReport(
  formData: z.infer<typeof SubmitReportSchema>, partnerId: string, userId: string,
): Promise<ActionResult<{id:string}>> {
  try {
    const v = SubmitReportSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("partners", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sg = await db.query.subGrants.findFirst({ where: eq(subGrants.id, v.data.subGrantId) });
    if (!sg) return { success:false, error:"المنحة الفرعية غير موجودة" };
    if (sg.organizationId !== v.data.organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };

    const [report] = await db.insert(partnerReports).values({
      organizationId: v.data.organizationId,
      subGrantId: v.data.subGrantId,
      periodStart: new Date(v.data.periodStart),
      periodEnd: new Date(v.data.periodEnd),
      narrativeReport: v.data.narrativeReport,
      financialReportAmount: v.data.financialReportAmount != null ? String(v.data.financialReportAmount) : undefined,
      createdBy: userId,
    }).returning();

    if (v.data.financialReportAmount) {
      await db.update(subGrants)
        .set({ reportedSpentAmount: sql`${subGrants.reportedSpentAmount} + ${v.data.financialReportAmount}` })
        .where(and(eq(subGrants.id, v.data.subGrantId), eq(subGrants.organizationId, v.data.organizationId)));
    }

    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:{ id:report.id } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

export async function reviewPartnerReport(
  reportId: string, partnerId: string, organizationId: string, userId: string,
  decision: "approved"|"needs_revision", comments?: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("partners", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(partnerReports)
      .set({ reviewStatus: decision, reviewedBy: userId, reviewedAt: new Date(), reviewComments: comments ? sanitizeText(comments) : comments, updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(partnerReports.id, reportId), eq(partnerReports.organizationId, organizationId)));
    revalidatePath(`/partners/${partnerId}`);
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}
