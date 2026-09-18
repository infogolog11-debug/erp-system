// ════════════════════════════════════════════════════════════
// تقييم الموردين (Vendor Scorecard) — طبقة 1
// ════════════════════════════════════════════════════════════
"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import {
  vendorRatings, vendors,
  bidEvaluationCriteria, bidEvaluations, tenderBids,
  purchaseRequests, purchaseOrders, goodsReceiptNotes,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { textField, optionalTextField, sanitizeText } from "@/lib/security/sanitize";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

const ratingSchema = z.object({
  vendorId:        z.string().uuid(),
  organizationId:  z.string().uuid(),
  qualityScore:    z.number().min(0).max(5),
  deliveryScore:   z.number().min(0).max(5),
  complianceScore: z.number().min(0).max(5),
  comments:        optionalTextField(1000),
  relatedPoId:     z.string().uuid().optional(),
  relatedGrnId:    z.string().uuid().optional(),
});

export async function submitVendorRating(
  params: z.infer<typeof ratingSchema>,
  ratedBy: string,
): Promise<ActionResult<{ ratingId:string; weightedAverage:number; newVendorAverage:number }>> {
  try {
    const data = ratingSchema.parse(params);

    const session = await requirePermission("vendors", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v34 — راجع SECURITY_NOTES.md): vendorId مُرسَل من العميل
    // ولم يكن يُتحقّق من ملكيته للمنظمة قبل إدراج التقييم. تحديث overallScore
    // اللاحق كان آمناً بفضل WHERE organizationId (يصبح no-op على مورد تابع
    // لمنظمة أخرى)، لكن سجل vendorRatings نفسه كان يُدرَج بلا أي تحقق —
    // يسمح لمستخدم من منظمة A بإدراج تقييم مربوط بمورد (vendorId) تابع
    // لمنظمة B (تلوّث بيانات تقييم موردين عبر حدود المستأجرين).
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(vendors, data.vendorId, data.organizationId)))
      return { success:false, error:"المورد غير موجود أو لا يتبع هذه المنظمة" };

    if (data.relatedPoId) {
      if (!(await assertOwnedByOrg(purchaseOrders, data.relatedPoId, data.organizationId)))
        return { success:false, error:"أمر الشراء المرتبط غير موجود أو لا يتبع هذه المنظمة" };
    }
    if (data.relatedGrnId) {
      if (!(await assertOwnedByOrg(goodsReceiptNotes, data.relatedGrnId, data.organizationId)))
        return { success:false, error:"سند الاستلام المرتبط غير موجود أو لا يتبع هذه المنظمة" };
    }

    // المعادلة: جودة 40% + توصيل 35% + امتثال 25%
    const weighted = (
      data.qualityScore    * 0.40 +
      data.deliveryScore   * 0.35 +
      data.complianceScore * 0.25
    );

    // إصلاح (v39 — راجع SECURITY_NOTES.md): كان المعدل التراكمي يُحسَب
    // بنمط "اقرأ كل السجلات ثم احسب بالذاكرة ثم اكتب" — تقييمان متزامنان
    // لنفس المورد يقدر كل واحد فيهما يقرأ قبل أن يرى إدراج التاني، فيحسب
    // كل واحد معدلاً ناقصاً (بلا تقييم الآخر)، وآخر UPDATE ينفّذ يفوز
    // ويطمر نتيجة التقييم التاني بالكامل من overallScore — رغم أن سجل
    // vendorRatings نفسه يبقى محفوظاً بشكل صحيح لكل التقييمات (لا فقدان
    // بيانات، فقط overallScore المُخزَّن يصبح غير دقيق مؤقتاً حتى تقييم
    // تالٍ يُعيد حسابه من الصفر). الأثر: تجميلي/عرضي فقط لا مالي — لكنه
    // إصلاح حقيقي مطلوب لدقة scorecard المورد.
    //
    // الإصلاح: تحديث ذرّي حقيقي عبر subquery SQL aggregate (AVG) داخل نفس
    // معاملة الإدراج. البند الحاسم: قفل الصف (row lock) الذي يفرضه UPDATE
    // بنفسه على مستوى postgres — لو مرّت معاملتان متزامنتان لنفس المورد،
    // الثانية تُحجَب على قفل صف vendors حتى تُنجز الأولى commit، فتُعاد
    // حسبة subquery الثانية من جديد بعد أن ترى تقييم الأولى المُثبَّت —
    // لا فقدان تحديث ممكن (lost update)، بخلاف نمط قراءة-ثم-كتابة القديم.
    const { rating, newAvg } = await db.transaction(async (tx) => {
      const [rating] = await tx.insert(vendorRatings).values({
        ...data,
        qualityScore:    String(data.qualityScore),
        deliveryScore:   String(data.deliveryScore),
        complianceScore: String(data.complianceScore),
        weightedAverage: String(+weighted.toFixed(2)),
        ratedBy,
        createdBy: ratedBy,
      }).returning();

      const [updatedVendor] = await tx.update(vendors)
        .set({
          overallScore: sql`(
            SELECT AVG(${vendorRatings.weightedAverage})
            FROM ${vendorRatings}
            WHERE ${vendorRatings.vendorId} = ${data.vendorId}
              AND ${vendorRatings.organizationId} = ${data.organizationId}
          )`,
          updatedAt: new Date(),
        })
        .where(and(eq(vendors.id, data.vendorId), eq(vendors.organizationId, data.organizationId)))
        .returning({ overallScore: vendors.overallScore });

      return { rating, newAvg: Number(updatedVendor.overallScore) };
    });

    await createAuditLog({
      organizationId: data.organizationId,
      userId: ratedBy,
      tableName: "vendors",
      recordId: data.vendorId,
      action: "UPDATE",
      newValues: { averageRating: +newAvg.toFixed(2), newRating: +weighted.toFixed(2) },
    });

    revalidatePath("/vendors");
    return { success:true, data:{
      ratingId: rating.id,
      weightedAverage: +weighted.toFixed(2),
      newVendorAverage: +newAvg.toFixed(2),
    }};
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── إعداد معايير تقييم لمناقصة معينة ────────────────────────────────────
export async function setupBidCriteria(
  tenderId:       string,
  organizationId: string,
  userId:         string,
  criteria: Array<{ nameAr:string; name:string; weight:number; maxScore?:number }>,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("vendors", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // التحقق أن الأوزان تساوي 100%
    const totalWeight = criteria.reduce((s,c) => s + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      return { success:false, error:`مجموع الأوزان يجب أن يساوي 100% (الحالي: ${totalWeight}%)` };
    }

    // حذف المعايير القديمة إن وجدت
    await db.delete(bidEvaluationCriteria)
      .where(and(eq(bidEvaluationCriteria.tenderId, tenderId), eq(bidEvaluationCriteria.organizationId, organizationId)));

    // إدراج المعايير الجديدة
    await db.insert(bidEvaluationCriteria).values(
      criteria.map((c, i) => ({
        tenderId, organizationId,
        criteriaName:   c.name,
        criteriaNameAr: c.nameAr,
        weight:         c.weight,
        maxScore:       c.maxScore ?? 10,
        sortOrder:      i + 1,
        createdBy:      userId,
      }))
    );

    // إصلاح (audit log integrity v35): استبدال معايير تقييم العروض (تؤثر
    // مباشرة على قرار ترسية العطاء) كان يتم بلا أي تسجيل تدقيق.
    await createAuditLog({ organizationId, userId, tableName:"bid_evaluation_criteria", recordId:tenderId, action:"UPDATE", newValues:{ criteriaCount: criteria.length, totalWeight } });
    revalidatePath(`/vendors/tenders/${tenderId}`);
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── تقديم تقييم عرض من عضو لجنة ──────────────────────────────────────
export async function submitBidScore(
  tenderId:      string,
  bidId:         string,
  criteriaId:    string,
  evaluatorId:   string,
  organizationId: string,
  score:         number,
  justification?: string,
): Promise<ActionResult<{ finalScore:number }>> {
  try {
    const session = await requirePermission("vendors", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const sanitizedJustification = justification ? sanitizeText(justification) : justification;
    const criteria = await db.query.bidEvaluationCriteria.findFirst({
      where: eq(bidEvaluationCriteria.id, criteriaId),
    });
    if (!criteria) return { success:false, error:"المعيار غير موجود" };
    if (criteria.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (criteria.tenderId !== tenderId) return { success:false, error:"المعيار لا يتبع هذه المناقصة" };

    // tenderBids ليس فيها عمود organizationId مباشرة — نتحقق أن العرض يتبع نفس المناقصة
    // التي تأكّدنا أصلاً أنها ضمن منظمة المستخدم عبر criteria.organizationId أعلاه
    const bid = await db.query.tenderBids.findFirst({ where: eq(tenderBids.id, bidId) });
    if (!bid) return { success:false, error:"العرض غير موجود" };
    if (bid.tenderId !== tenderId) return { success:false, error:"غير مصرَّح بالوصول لهذا العرض" };

    const maxScore = criteria.maxScore ?? 10;
    if (score < 0 || score > maxScore) {
      return { success:false, error:`الدرجة يجب أن تكون بين 0 و ${maxScore}` };
    }

    const weightedScore = (score / maxScore) * criteria.weight;

    // تحقق من عدم تكرار التقييم لنفس المقيّم والمعيار والعرض
    const existing = await db.query.bidEvaluations.findFirst({
      where: and(
        eq(bidEvaluations.bidId, bidId),
        eq(bidEvaluations.criteriaId, criteriaId),
        eq(bidEvaluations.evaluatorId, evaluatorId),
      ),
    });

    if (existing?.isLocked) {
      return { success:false, error:"تم إقفال هذا التقييم ولا يمكن تعديله" };
    }

    // إصلاح (v39 — راجع SECURITY_NOTES.md): totalScore كان يُحسَب بنفس نمط
    // submitVendorRating القديم — قراءة كل تقييمات العرض، حساب
    // SUM(weightedScore)/COUNT(DISTINCT evaluatorId) بالذاكرة، ثم كتابة
    // النتيجة. نفس أثر lost-update المحتمل عند تقييمَين متزامنَين لنفس
    // العرض من مقيِّمَين مختلفين. الإصلاح: تحديث ذرّي عبر subquery SQL
    // aggregate ضمن نفس معاملة الإدراج/التحديث — قفل صف tenderBids يمنع
    // فقدان أي تحديث (نفس منطق submitVendorRating أعلاه بالضبط).
    //
    // نطاق هذا الإصلاح محصور بحساب المتوسط فقط، حسب المطلوب صراحة. فحص
    // "هل يوجد تقييم سابق لنفس المقيّم/المعيار/العرض" (check-then-act
    // أعلاه) يبقى كما هو دون قفل قاعدة بيانات حقيقي — تبنّي upsert ذرّي
    // له (via onConflictDoUpdate) يتطلب أولاً UNIQUE index جديد على
    // (bidId, criteriaId, evaluatorId) غير موجود بالمخطط الحالي، أي
    // migration جديدة (017) خارج نطاق هذه الجولة. أثره هامشي عملياً: نفس
    // المقيّم نادراً ما يُرسل نفس المعيار لنفس العرض بشكل متزامن حرفياً؛
    // أسوأ سيناريو هو صفّان بدل واحد لتقييم واحد، لا يتم تجاهله بصمت —
    // موثّق هنا كبند مفتوح صريح بدل تركه ضمنياً.
    const { finalScore } = await db.transaction(async (tx) => {
      if (existing) {
        await tx.update(bidEvaluations)
          .set({ score:String(score), weightedScore:String(+weightedScore.toFixed(3)), justification: sanitizedJustification, updatedAt:new Date() })
          .where(and(eq(bidEvaluations.id, existing.id), eq(bidEvaluations.organizationId, organizationId)));
      } else {
        await tx.insert(bidEvaluations).values({
          tenderId, bidId, criteriaId, evaluatorId, organizationId,
          score:         String(score),
          weightedScore: String(+weightedScore.toFixed(3)),
          justification: sanitizedJustification,
          createdBy:     evaluatorId,
        });
      }

      const [updatedBid] = await tx.update(tenderBids)
        .set({
          totalScore: sql`(
            SELECT SUM(${bidEvaluations.weightedScore}) / NULLIF(COUNT(DISTINCT ${bidEvaluations.evaluatorId}), 0)
            FROM ${bidEvaluations}
            WHERE ${bidEvaluations.bidId} = ${bidId}
          )`,
          updatedAt: new Date(),
        })
        .where(and(eq(tenderBids.id, bidId), eq(tenderBids.tenderId, tenderId)))
        .returning({ totalScore: tenderBids.totalScore });

      return { finalScore: Number(updatedBid.totalScore) };
    });

    // إصلاح (audit log integrity v35): تقييم عرض فردي (يغذّي قرار ترسية
    // العطاء النهائي) كان يُدرج/يُحدَّث بلا أي تسجيل تدقيق.
    await createAuditLog({ organizationId, userId: evaluatorId, tableName:"bid_evaluations", recordId:bidId, action: existing ? "UPDATE" : "CREATE", newValues:{ criteriaId, score, finalScore:+finalScore.toFixed(2) } });
    revalidatePath(`/vendors/tenders/${tenderId}`);
    return { success:true, data:{ finalScore:+finalScore.toFixed(2) } };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── مسار الشراء الطارئ ────────────────────────────────────────────────
export async function flagEmergencyProcurement(
  prId:            string,
  reason:          string,
  authorizedBy:    string,
  organizationId:  string,
): Promise<ActionResult<void>> {
  try {
    const session = await requirePermission("procurement", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const reviewDue = new Date();
    reviewDue.setDate(reviewDue.getDate() + 30); // مراجعة إلزامية خلال 30 يوم

    // إصلاح (v34-تتمة الثانية): كانت الدالة تُحدّث ثم تُنشئ سجل تدقيق دائماً،
    // حتى لو كان التحديث no-op فعلياً (prId تابع لمنظمة أخرى أو غير موجود) —
    // ينتج سجل تدقيق مضلِّل يوثّق عملية لم تحدث. الآن نتحقق من وجود/ملكية
    // الـ PR أولاً، بنفس نمط بقية الدوال بالملف.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(purchaseRequests, prId, organizationId)))
      return { success:false, error:"طلب الشراء غير موجود أو لا يتبع هذه المنظمة" };

    await db.update(purchaseRequests)
      .set({
        isEmergency:           true,
        emergencyReason:       sanitizeText(reason),
        emergencyAuthorizedBy: authorizedBy,
        emergencyReviewDue:    reviewDue,
        updatedAt:             new Date(),
      })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId: authorizedBy,
      tableName: "purchase_requests", recordId: prId,
      action: "UPDATE",
      newValues: { isEmergency:true, reason, reviewDue },
    });

    revalidatePath("/procurement");
    return { success:true, data:undefined };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}
