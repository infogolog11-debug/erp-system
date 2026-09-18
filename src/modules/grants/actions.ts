"use server";

import { db } from "@/db";
import { grants, grantBudgetLines, budgetAllocations } from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { notify } from "@/core/notifications/notify";
import { canTransition } from "@/core/state-machine/transitions";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { textField, optionalTextField } from "@/lib/security/sanitize";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";

// ─── Validation Schemas ───────────────────
const CreateGrantSchema = z.object({
  organizationId: z.string().uuid(),
  donorId:        z.string().uuid(),
  currencyId:     z.string().uuid(),
  code:           textField(50, 1),
  name:           textField(300, 1),
  nameAr:         optionalTextField(300),
  totalAmount:    z.number().positive(),
  startDate:      z.string(),
  endDate:        z.string(),
  grantManagerId: z.string().uuid().optional(),
  description:    optionalTextField(2000),
});

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── Create Grant ─────────────────────────
export async function createGrant(
  formData: z.infer<typeof CreateGrantSchema>,
  userId: string
): Promise<ActionResult<{id:string}>> {
  try {
    const v = CreateGrantSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("grants", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const [grant] = await db.insert(grants).values({
      ...v.data,
      totalAmount: String(v.data.totalAmount),
      startDate: new Date(v.data.startDate),
      endDate:   new Date(v.data.endDate),
      createdBy: userId,
    }).returning();

    await createAuditLog({
      organizationId: v.data.organizationId,
      userId,
      tableName: "grants",
      recordId: grant.id,
      action: "CREATE",
      newValues: v.data,
    });

    revalidatePath("/grants");
    return { success:true, data:{ id:grant.id } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── Approve Grant ────────────────────────
export async function approveGrant(
  grantId: string,
  userId: string,
  organizationId: string
): Promise<ActionResult> {
  try {
    const session = await requirePermission("grants", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const existing = await db.query.grants.findFirst({
      where: eq(grants.id, grantId),
    });
    if (!existing) return { success:false, error:"المنحة غير موجودة" };
    if (existing.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!canTransition("grants", existing.status, "approved"))
      return { success:false, error:`لا يمكن الموافقة من حالة ${existing.status}` };

    await db.update(grants)
      .set({ status:"approved", updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(grants.id, grantId), eq(grants.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId,
      tableName:"grants", recordId:grantId,
      action:"APPROVE",
      oldValues:{ status:existing.status },
      newValues:{ status:"approved" },
    });

    // إشعار مدير المنحة
    if (existing.grantManagerId) {
      await notify({
        organizationId, userId:existing.grantManagerId,
        title:"تمت الموافقة على المنحة",
        titleAr:"تمت الموافقة على المنحة",
        body:`تمت الموافقة على المنحة: ${existing.name}`,
        type:"success",
        link:`/grants/${grantId}`,
      });
    }

    revalidatePath("/grants");
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── Budget Ceiling Check ─────────────────
// يُستدعى قبل كل موافقة على مشتريات أو رواتب
//
// إصلاح IDOR (اكتُشف أثناء مراجعة procurement التي وثّق SECURITY_NOTES.md
// §v31-8 أنها لم تُراجَع بعد): هذه الدالة كانت تجلب بند الميزانية بمعرّفه
// فقط، بدون أي تحقق من أن organizationId المُستدعي يطابق منظمة البند.
// مستخدم من منظمة A كان يقدر يمرّر budgetLineId يخص منظمة B ضمن طلب شراء
// (createPurchaseRequest/approvePurchaseRequest في procurement/actions.ts)
// فتُفحص أرقام ميزانية B الفعلية (تسريب بيانات مالية عبر رسالة الخطأ)،
// والأخطر: approvePurchaseRequest تُحدّث committedAmount على نفس البند
// مباشرة بعد نجاح هذا الفحص — أي أن منظمة A كانت تقدر تُغيّر أرقام ميزانية
// منظمة B فعلياً. الإصلاح: إضافة organizationId إلزامي، ورفض أي بند لا
// يتبع المنظمة المستدعية بنفس رسالة "غير موجود" (بدون تمييز بين
// "غير موجود" و"يخص منظمة أخرى" لمنع استكشاف وجود بنود منظمات أخرى).
export async function checkBudgetCeiling(
  organizationId: string,
  budgetLineId: string,
  requestedAmount: number
): Promise<{ available:number; canProceed:boolean; message:string }> {
  const line = await db.query.grantBudgetLines.findFirst({
    where: eq(grantBudgetLines.id, budgetLineId),
  });
  if (!line || line.organizationId !== organizationId)
    return { available:0, canProceed:false, message:"بند الميزانية غير موجود" };

  const planned   = Number(line.plannedAmount);
  const committed = Number(line.committedAmount);
  const spent     = Number(line.spentAmount);
  const available = planned - committed - spent;

  if (requestedAmount > available) {
    return {
      available,
      canProceed: false,
      message: `الميزانية المتاحة ${available.toFixed(2)} — المطلوب ${requestedAmount.toFixed(2)}`,
    };
  }
  return { available, canProceed:true, message:"الميزانية كافية" };
}

// ─── Atomic Budget Commit (v35) ────────────
// إصلاح Race Condition حقيقي: checkBudgetCeiling أعلاه هي قراءة (read)
// فقط — القرار (canProceed) والكتابة الفعلية لاحقة (committed_amount +=)
// كانا عمليتين منفصلتين بزمن مختلف (check-then-act) بلا أي قفل أو شرط
// ذرّي، بنفس فئة ثغرة خصم المخزون قبل إصلاحها بmigration 013 (راجع
// SECURITY_NOTES.md §v31-1). الأثر: طلبا شراء متزامنان (أو أكثر) على نفس
// budgetLineId، كل واحد يقرأ رصيداً متاحاً كافياً *قبل* أن يُثبَّت التزام
// الآخر، فيمرّان الفحص معاً وتلتزم الميزانية بمبلغ يتجاوز المتاح فعلياً —
// لا يوجد حتى الآن أي CHECK constraint أو قفل DB يمنع هذا (خلافاً للمخزون
// والرواتب، المحميين فعلياً بقيد ذرّي).
//
// الحل: بدل "اقرأ ثم قرّر ثم اكتب"، عملية واحدة ذرّية: UPDATE...WHERE يشترط
// أن الرصيد المتاح كافٍ *في نفس عبارة SQL* التي تُنفّذ الزيادة — Postgres
// يضمن أن صفاً واحداً لا يُقرأ ويُعدَّل من معاملتين متزامنتين بنفس اللحظة
// (row-level locking ضمني عبر UPDATE). لو رجعت الدالة 0 صفوف محدَّثة، يعني
// إما البند غير موجود/لا يخص المنظمة، أو أن الرصيد لم يعد كافياً (سواء لعدم
// كفايته أصلاً أو لأن معاملة متزامنة استهلكته للتو) — بلا تمييز بين
// الحالتين برسالة الخطأ (نفس مبدأ منع enumeration المطبَّق بـcheckBudgetCeiling).
// يجب استدعاؤها **داخل** نفس transaction الذي يكتب حالة PR/Payroll، بحيث لو
// فشل أي جزء لاحق يُلغى الالتزام معه تلقائياً بالـ rollback.
export async function commitBudgetAmountAtomic(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  organizationId: string,
  budgetLineId: string,
  amount: number,
  column: "committedAmount" | "spentAmount",
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (amount <= 0) return { ok: true }; // لا شيء لالتزامه
  const col = column === "committedAmount" ? sql`committed_amount` : sql`spent_amount`;
  const updated = await tx.update(grantBudgetLines)
    .set({
      [column]: sql`${col} + ${String(amount)}`,
      updatedAt: new Date(),
    } as Record<string, unknown>)
    .where(and(
      eq(grantBudgetLines.id, budgetLineId),
      eq(grantBudgetLines.organizationId, organizationId),
      sql`planned_amount - committed_amount - spent_amount >= ${String(amount)}`,
    ))
    .returning({ id: grantBudgetLines.id });

  if (updated.length === 0) {
    return { ok:false, error:"تجاوز الميزانية المتاحة لبند الميزانية (تم رفض الالتزام بسبب عدم كفاية الرصيد أو معاملة متزامنة استهلكته)" };
  }
  return { ok:true };
}
