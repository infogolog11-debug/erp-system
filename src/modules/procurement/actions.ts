"use server";

import { db } from "@/db";
import {
  purchaseRequests, purchaseRequestItems,
  purchaseOrders, purchaseOrderItems,
  goodsReceiptNotes, grnItems, vendorInvoices, payments,
  grantBudgetLines, journalEntries, journalLines,
  accounts, grants, vendors,
} from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { notify, notifyMany } from "@/core/notifications/notify";
import { checkBudgetCeiling, commitBudgetAmountAtomic } from "@/modules/grants/actions";
import { canTransition } from "@/core/state-machine/transitions";
import { assertOwnedByOrg } from "@/lib/auth/ownership";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { textField, optionalTextField } from "@/lib/security/sanitize";
import { z } from "zod";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { receiveStock } from "@/lib/inventory/stock-movement";
import { withIdempotency, IdempotencyInProgressError } from "@/lib/idempotency/guard";

type ActionResult<T=void> =
  | { success:true; data:T }
  | { success:false; error:string };

// ─── Create Purchase Request ──────────────
const PRSchema = z.object({
  organizationId: z.string().uuid(),
  title:          textField(300, 1),
  requestedBy:    z.string().uuid(),
  grantId:        z.string().uuid().optional(),
  budgetLineId:   z.string().uuid().optional(),
  priority:       z.enum(["low","medium","high","urgent"]).default("medium"),
  requiredDate:   z.string().optional(),
  estimatedTotal: z.number().positive().optional(),
  currencyId:     z.string().uuid().optional(),
  justification:  optionalTextField(1000),
  isEmergency:      z.boolean().optional(),
  emergencyReason:  optionalTextField(1000),
  items:          z.array(z.object({
    itemDescription:    textField(300, 1),
    unit:               textField(30, 1),
    quantity:           z.number().positive(),
    estimatedUnitPrice: z.number().optional(),
    specifications:     optionalTextField(1000),
  })).min(1),
});

export async function createPurchaseRequest(
  formData: z.infer<typeof PRSchema>,
  userId: string
): Promise<ActionResult<{id:string;code:string}>> {
  try {
    const v = PRSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("procurement", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (لم يكن مغطى — راجع SECURITY_NOTES.md §v31-8، القسم الذي
    // ذكر procurement صراحةً كموديول يحتاج نفس مراجعة النمط التي طُبِّقت
    // على createDistribution): grantId هنا مُرسَل من العميل ويُدرَج مباشرة
    // بسجل purchaseRequests دون أي تحقق أنه يخص نفس المنظمة. مستخدم من
    // منظمة A كان يقدر يربط طلب شراء بمنحة تخص منظمة B (تسريب/تلوّث بيانات
    // التقارير المالية بحسب المنحة عبر حدود المستأجرين).
    if (v.data.grantId) {
      // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
      if (!(await assertOwnedByOrg(grants, v.data.grantId, v.data.organizationId)))
        return { success:false, error:"المنحة غير موجودة أو لا تتبع هذه المنظمة" };
    }

    // Budget Ceiling Check إذا كانت مرتبطة بميزانية
    // (checkBudgetCeiling نفسها تتحقق الآن من ملكية budgetLineId للمنظمة —
    // راجع الإصلاح والشرح الكامل في grants/actions.ts)
    if (v.data.budgetLineId && v.data.estimatedTotal) {
      const budgetCheck = await checkBudgetCeiling(
        v.data.organizationId, v.data.budgetLineId, v.data.estimatedTotal
      );
      if (!budgetCheck.canProceed) {
        return { success:false, error:`تجاوز الميزانية: ${budgetCheck.message}` };
      }
    }

    // توليد كود تلقائي
    const count = await db.select({ c: sql`count(*)` }).from(purchaseRequests);
    const seq = Number(count[0].c) + 1;
    const code = `PR-${new Date().getFullYear()}-${String(seq).padStart(5,"0")}`;

    const result = await db.transaction(async (tx) => {
      const [pr] = await tx.insert(purchaseRequests).values({
        ...v.data,
        code,
        estimatedTotal: v.data.estimatedTotal ? String(v.data.estimatedTotal) : null,
        requiredDate: v.data.requiredDate ? new Date(v.data.requiredDate) : null,
        createdBy: userId,
      }).returning();

      // إضافة بنود الطلب
      if (v.data.items.length > 0) {
        await tx.insert(purchaseRequestItems).values(
          v.data.items.map((item) => ({
            prId: pr.id,
            organizationId: v.data.organizationId,
            itemDescription: item.itemDescription,
            unit: item.unit,
            quantity: String(item.quantity),
            estimatedUnitPrice: item.estimatedUnitPrice
              ? String(item.estimatedUnitPrice) : null,
            estimatedTotal: item.estimatedUnitPrice && item.quantity
              ? String(item.estimatedUnitPrice * item.quantity) : null,
            specifications: item.specifications,
            createdBy: userId,
          }))
        );
      }
      return pr;
    });

    await createAuditLog({
      organizationId: v.data.organizationId,
      userId, tableName:"purchase_requests",
      recordId: result.id, action:"CREATE",
      newValues: { ...v.data, code },
    });

    revalidatePath("/procurement");
    return { success:true, data:{ id:result.id, code } };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── Submit PR for Approval ───────────────
export async function submitPurchaseRequest(
  prId: string,
  userId: string,
  organizationId: string,
  approverIds: string[]
): Promise<ActionResult> {
  try {
    const session = await requirePermission("procurement", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const pr = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, prId),
    });
    if (!pr) return { success:false, error:"الطلب غير موجود" };
    if (pr.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!canTransition("procurement", pr.status, "submitted"))
      return { success:false, error:"لا يمكن إرسال الطلب في حالته الحالية" };

    await db.update(purchaseRequests)
      .set({ status:"submitted", updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.organizationId, organizationId)));

    await createAuditLog({
      organizationId, userId,
      tableName:"purchase_requests", recordId:prId,
      action:"UPDATE",
      oldValues:{ status:pr.status },
      newValues:{ status:"submitted" },
    });

    // إشعار المعتمدين
    await notifyMany(approverIds, {
      organizationId,
      title:"طلب شراء بانتظار موافقتك",
      titleAr:"طلب شراء بانتظار موافقتك",
      body:`الطلب ${pr.code}: ${pr.title}`,
      type:"approval",
      link:`/procurement/requests/${prId}`,
    });

    revalidatePath("/procurement");
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    return { success:false, error:"حدث خطأ غير متوقع" };
  }
}

// ─── Approve PR → Create PO ──────────────
export async function approvePurchaseRequest(
  prId: string,
  userId: string,
  organizationId: string
): Promise<ActionResult> {
  try {
    const session = await requirePermission("procurement", "approve");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const pr = await db.query.purchaseRequests.findFirst({
      where: eq(purchaseRequests.id, prId),
    });
    if (!pr) return { success:false, error:"الطلب غير موجود" };
    if (pr.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (!canTransition("procurement", pr.status, "approved"))
      return { success:false, error:"لا يمكن الموافقة في الحالة الحالية" };

    // إعادة التحقق من الميزانية عند الموافقة (فحص إرشادي مبكر لرسالة خطأ
    // أوضح للمستخدم — الإنفاذ الفعلي والوحيد المعتمَد أمنياً هو الالتزام
    // الذرّي داخل الـtransaction أدناه، لأن هذا الفحص المستقل قد يمرّ بينما
    // تستهلك معاملة متزامنة الرصيد قبل وصولنا للكتابة الفعلية)
    if (pr.budgetLineId && pr.estimatedTotal) {
      const check = await checkBudgetCeiling(
        organizationId, pr.budgetLineId, Number(pr.estimatedTotal)
      );
      if (!check.canProceed)
        return { success:false, error:`تجاوز الميزانية: ${check.message}` };
    }

    // إصلاح Race Condition (v35 — راجع commitBudgetAmountAtomic بـgrants/actions.ts
    // للشرح الكامل): تحديث حالة الـPR والتزام الميزانية صارا بمعاملة واحدة،
    // والالتزام نفسه عملية ذرّية بشرط SQL واحد (لا قراءة-ثم-كتابة منفصلتين)
    // — لو استهلكت معاملة متزامنة الرصيد بين الفحص الإرشادي أعلاه ولحظة هذا
    // التحديث، يُرفض الالتزام هنا فعلياً ويُلغى تحديث حالة الـPR معه بالكامل.
    await db.transaction(async (tx) => {
      await tx.update(purchaseRequests)
        .set({ status:"approved", updatedBy:userId, updatedAt:new Date() })
        .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.organizationId, organizationId)));

      if (pr.budgetLineId && pr.estimatedTotal) {
        const commit = await commitBudgetAmountAtomic(
          tx, organizationId, pr.budgetLineId, Number(pr.estimatedTotal), "committedAmount",
        );
        if (!commit.ok) throw new Error(commit.error);
      }
    });

    await createAuditLog({
      organizationId, userId,
      tableName:"purchase_requests", recordId:prId,
      action:"APPROVE",
      oldValues:{ status:pr.status },
      newValues:{ status:"approved" },
    });

    // إشعار مقدم الطلب
    await notify({
      organizationId, userId:pr.requestedBy,
      title:"تمت الموافقة على طلب الشراء",
      body:`تمت الموافقة على الطلب: ${pr.code}`,
      type:"success",
      link:`/procurement/requests/${prId}`,
    });

    revalidatePath("/procurement");
    return { success:true, data:undefined };
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
    return { success:false, error: msg.includes("تجاوز") || msg.includes("الالتزام") ? msg : "حدث خطأ غير متوقع" };
  }
}

// ─── Create Purchase Order (من PR مُعتمَد) ─────
// كانت غائبة بالكامل — موثّق كنقص وظيفي بـSECURITY_NOTES.md § v34. بدونها
// تدفق PR→PO→GRN غير قابل للتشغيل: approvePurchaseRequest تعتمد الطلب
// وتلتزم الميزانية، لكن لا شيء كان يُنشئ سجل purchaseOrders الذي تفترض
// createGoodsReceiptNote وجوده مسبقاً.
//
// قرارات تصميم مقصودة:
// - grantId/budgetLineId على أمر الشراء تُورَّث من الـ PR المعتمد نفسه
//   (pr.grantId/pr.budgetLineId)، لا تُقبَل من العميل مباشرة — تجنّباً
//   لنفس نمط IDOR (grantId) الذي أُصلح بـcreatePurchaseRequest، ولأن
//   الالتزام المالي (committedAmount) تم فعلاً عند اعتماد الـ PR بمبلغه
//   الإجمالي التقديري، فلا داعي لالتزام إضافي هنا.
// - vendorId يُتحقَّق من ملكيته للمنظمة قبل أي كتابة.
// - prItemId (لو أُرسل لكل بند) يُتحقَّق من انتمائه لنفس الـ PR — نفس نمط
//   poItemId بـcreateGoodsReceiptNote.
// - عند نجاح الإنشاء، الـ PR ينتقل لحالة "done" (لا توجد حالة وسيطة
//   "po_created" بمخطط الحالات الحالي procurement: approved→done فقط).
const POItemInput = z.object({
  prItemId:        z.string().uuid().optional(),
  itemId:          z.string().uuid().optional(),
  itemDescription: textField(300, 1),
  unit:            textField(30, 1),
  quantity:        z.number().positive(),
  unitPrice:       z.number().nonnegative(),
  taxRate:         z.number().min(0).max(100).default(0),
});

const CreatePOSchema = z.object({
  organizationId:  z.string().uuid(),
  prId:            z.string().uuid(),
  vendorId:        z.string().uuid(),
  currencyId:      z.string().uuid(),
  exchangeRate:    z.number().positive().default(1),
  deliveryDate:    z.string().optional(),
  deliveryAddress: optionalTextField(300),
  paymentTerms:    optionalTextField(300),
  termsConditions: optionalTextField(2000),
  items:           z.array(POItemInput).min(1),
  idempotencyKey:  z.string().max(200).optional(),
});

export async function createPurchaseOrder(
  input: z.infer<typeof CreatePOSchema>, userId: string,
): Promise<ActionResult<{ id:string; code:string }>> {
  const v = CreatePOSchema.safeParse(input);
  if (!v.success) return { success:false, error:v.error.errors[0].message };

  const session = await requirePermission("procurement", "create");
  if (!session.ok) return { success:false, error:session.error };
  if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

  const pr = await db.query.purchaseRequests.findFirst({ where: eq(purchaseRequests.id, v.data.prId) });
  if (!pr) return { success:false, error:"طلب الشراء غير موجود" };
  if (pr.organizationId !== v.data.organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
  if (pr.status !== "approved") return { success:false, error:"يجب اعتماد طلب الشراء أولاً قبل إنشاء أمر شراء منه" };

  // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
  if (!(await assertOwnedByOrg(vendors, v.data.vendorId, v.data.organizationId)))
    return { success:false, error:"المورد غير موجود أو لا يتبع هذه المنظمة" };

  // تحقق ملكية بنود الطلب المرتبطة (prItemId) لو أُرسلت
  const linkedPrItemIds = v.data.items.map(i => i.prItemId).filter((id): id is string => !!id);
  if (linkedPrItemIds.length > 0) {
    const prItems = await db.query.purchaseRequestItems.findMany({ where: eq(purchaseRequestItems.prId, v.data.prId) });
    const validIds = new Set(prItems.map(i => i.id));
    for (const id of linkedPrItemIds) {
      if (!validIds.has(id)) return { success:false, error:"بند طلب الشراء غير موجود ضمن هذا الطلب" };
    }
  }

  try {
    return await withIdempotency(v.data.organizationId, v.data.idempotencyKey, "createPurchaseOrder", async () => {
      const result = await db.transaction(async (tx) => {
        const countRes = await tx.select({ c: sql<number>`count(*)` }).from(purchaseOrders);
        const seq = Number(countRes[0].c) + 1;
        const code = `PO-${new Date().getFullYear()}-${String(seq).padStart(5,"0")}`;

        let subtotal = 0, taxAmount = 0;
        const itemRows = v.data.items.map((item) => {
          const lineSubtotal = item.quantity * item.unitPrice;
          const lineTax = lineSubtotal * (item.taxRate / 100);
          subtotal += lineSubtotal;
          taxAmount += lineTax;
          return {
            organizationId:  v.data.organizationId,
            prItemId:        item.prItemId,
            itemId:          item.itemId,
            itemDescription: item.itemDescription,
            unit:            item.unit,
            quantity:        String(item.quantity),
            unitPrice:       String(item.unitPrice),
            taxRate:         String(item.taxRate),
            totalAmount:     String(+(lineSubtotal + lineTax).toFixed(2)),
            createdBy:       userId,
          };
        });
        const totalAmount = subtotal + taxAmount;

        const [po] = await tx.insert(purchaseOrders).values({
          organizationId:  v.data.organizationId,
          prId:            v.data.prId,
          vendorId:        v.data.vendorId,
          grantId:         pr.grantId,
          budgetLineId:    pr.budgetLineId,
          code,
          deliveryDate:    v.data.deliveryDate ? new Date(v.data.deliveryDate) : undefined,
          deliveryAddress: v.data.deliveryAddress,
          subtotal:        String(+subtotal.toFixed(2)),
          taxAmount:       String(+taxAmount.toFixed(2)),
          totalAmount:     String(+totalAmount.toFixed(2)),
          currencyId:      v.data.currencyId,
          exchangeRate:    String(v.data.exchangeRate),
          paymentTerms:    v.data.paymentTerms,
          termsConditions: v.data.termsConditions,
          createdBy:       userId,
        }).returning();

        await tx.insert(purchaseOrderItems).values(
          itemRows.map((r) => ({ ...r, poId: po.id }))
        );

        if (canTransition("procurement", pr.status, "done")) {
          await tx.update(purchaseRequests)
            .set({ status:"done", updatedBy:userId, updatedAt:new Date() })
            .where(eq(purchaseRequests.id, v.data.prId));
        }

        await createAuditLog({
          organizationId: v.data.organizationId, userId,
          tableName:"purchase_orders", recordId:po.id, action:"CREATE",
          newValues:{ code, prId: v.data.prId, vendorId: v.data.vendorId, totalAmount:+totalAmount.toFixed(2) },
        }, tx);

        return po;
      });

      revalidatePath("/procurement");
      return { success:true as const, data:{ id: result.id, code: result.code } };
    });
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    return { success:false, error: e instanceof Error && e.message ? e.message : "حدث خطأ غير متوقع بإنشاء أمر الشراء" };
  }
}

// ─── Create Goods Receipt Note (استلام بضاعة) ─────
// كانت غائبة بالكامل: جداول goods_receipt_notes/grn_items كانت موجودة
// بالسكيما وتُقرأ فقط بمحرك المطابقة الثلاثية (three-way-match)، بدون
// أي كود يكتب فيها فعلياً. هذا كان السبب الجذري وراء أن المخزون "لا
// يحدَّث عند الاستلام أبداً". هذي الدالة:
// - تُنشئ GRN + سطوره فعلياً
// - تحدّث purchaseOrderItems.receivedQty تراكمياً (مع منع الاستلام أكثر
//   من المطلوب)
// - تستدعي receiveStock بالكمية *المقبولة* فقط (المستلمة ناقص المرفوضة)
//   لكل بند مرتبط بصنف مخزون فعلي (poItem.itemId) — البنود غير المرتبطة
//   (خدمات، مشتريات لمرة واحدة) تُسجَّل بالـ GRN لكن لا تُحرِّك مخزوناً
// - كل شي بمعاملة واحدة (GRN + سطوره + تحديث PO + خصم/إضافة مخزون +
//   تدقيق) — فشل أي جزء يُلغي الكل
const GRNItemInput = z.object({
  poItemId:  z.string().uuid(),
  receivedQty: z.number().nonnegative(),
  rejectedQty: z.number().nonnegative().default(0),
  rejectionReason: optionalTextField(500),
  condition: z.enum(["good","damaged","expired"]).default("good"),
});

const CreateGRNSchema = z.object({
  organizationId: z.string().uuid(),
  poId:           z.string().uuid(),
  warehouseId:    z.string().uuid().optional(),
  deliveryNote:   optionalTextField(200),
  remarks:        optionalTextField(1000),
  items:          z.array(GRNItemInput).min(1),
  idempotencyKey: z.string().max(200).optional(),
});

export async function createGoodsReceiptNote(
  input: z.infer<typeof CreateGRNSchema>, userId: string,
): Promise<ActionResult<{ id:string; code:string }>> {
  const v = CreateGRNSchema.safeParse(input);
  if (!v.success) return { success:false, error:v.error.errors[0].message };

  const session = await requirePermission("procurement", "create");
  if (!session.ok) return { success:false, error:session.error };
  if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

  const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, v.data.poId) });
  if (!po) return { success:false, error:"أمر الشراء غير موجود" };
  if (po.organizationId !== v.data.organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };

  try {
    return await withIdempotency(v.data.organizationId, v.data.idempotencyKey, "createGoodsReceiptNote", async () => {
      const result = await db.transaction(async (tx) => {
        // تحقق كل بند مقابل بند أمر الشراء الفعلي — فحص إرشادي مبكر فقط
        // (رسالة خطأ واضحة للحالة الشائعة)؛ الإنفاذ الفعلي ضد التزامن صار
        // بالـUPDATE الذرّي أدناه (راجع تعليق إصلاح Race Condition).
        const poItems = await tx.query.purchaseOrderItems.findMany({ where: eq(purchaseOrderItems.poId, v.data.poId) });
        const poItemById = new Map(poItems.map(i => [i.id, i]));

        for (const line of v.data.items) {
          const poItem = poItemById.get(line.poItemId);
          if (!poItem || poItem.poId !== v.data.poId) throw new Error("بند أمر الشراء غير موجود ضمن هذا الأمر");
          const alreadyReceived = Number(poItem.receivedQty ?? 0);
          const ordered = Number(poItem.quantity);
          if (alreadyReceived + line.receivedQty > ordered) {
            throw new Error(`الكمية المستلمة (${alreadyReceived + line.receivedQty}) تتجاوز المطلوب (${ordered}) للبند: ${poItem.itemDescription}`);
          }
        }

        // كود تسلسلي
        const countRes = await tx.select({ c: sql<number>`count(*)` }).from(goodsReceiptNotes);
        const seq = Number(countRes[0].c) + 1;
        const code = `GRN-${new Date().getFullYear()}-${String(seq).padStart(5,"0")}`;

        const [grn] = await tx.insert(goodsReceiptNotes).values({
          organizationId: v.data.organizationId,
          poId: v.data.poId,
          vendorId: po.vendorId,
          code,
          receivedBy: userId,
          deliveryNote: v.data.deliveryNote,
          warehouseId: v.data.warehouseId,
          remarks: v.data.remarks,
          createdBy: userId,
        }).returning();

        for (const line of v.data.items) {
          const poItem = poItemById.get(line.poItemId)!;
          const acceptedQty = line.receivedQty - line.rejectedQty;

          await tx.insert(grnItems).values({
            grnId: grn.id,
            poItemId: line.poItemId,
            organizationId: v.data.organizationId,
            orderedQty: poItem.quantity,
            receivedQty: String(line.receivedQty),
            rejectedQty: String(line.rejectedQty),
            rejectionReason: line.rejectionReason,
            condition: line.condition,
            createdBy: userId,
          });

          // إصلاح Race Condition حقيقي (v35): كان الفحص أعلاه (alreadyReceived
          // + line.receivedQty > ordered) قراءة منفصلة زمنياً عن هذا التحديث
          // — بالضبط نفس فئة ثغرة خصم المخزون قبل إصلاحها بmigration 013
          // (راجع SECURITY_NOTES.md §v31-1). سيناريو الثغرة: سندا استلام (GRN)
          // متزامنان لنفس بند أمر الشراء، كل واحد يقرأ received_qty الحالية
          // *قبل* أن يُثبَّت تحديث الآخر، فيمرّان الفحص معاً وتُستلَم كمية
          // إجمالية تتجاوز المطلوب فعلياً — يُدخِل مخزوناً ومصروفات لم تُطلَب.
          // الحل: نفس مبدأ stock-movement.ts — شرط الكمية داخل عبارة UPDATE
          // الذرّية نفسها بدل فحص JS منفصل، والاعتماد على عدد الصفوف المُحدَّثة
          // (0 يعني رُفض العملية) بدل الثقة بالقراءة المسبقة.
          const receiveUpdate = await tx.update(purchaseOrderItems)
            .set({ receivedQty: sql`COALESCE(received_qty,0) + ${line.receivedQty}` })
            .where(and(
              eq(purchaseOrderItems.id, line.poItemId),
              sql`COALESCE(received_qty,0) + ${line.receivedQty} <= quantity`,
            ))
            .returning({ id: purchaseOrderItems.id });
          if (receiveUpdate.length === 0) {
            throw new Error(`الكمية المستلمة تتجاوز المطلوب للبند: ${poItem.itemDescription} (تم الرفض لمنع تجاوز الكمية — قد تكون معاملة استلام متزامنة استهلكت الكمية المتبقية)`);
          }

          // فقط البنود المرتبطة فعلياً بصنف مخزون، وبكمية مقبولة موجبة
          if (poItem.itemId && acceptedQty > 0) {
            const stockResult = await receiveStock(tx, {
              organizationId: v.data.organizationId,
              itemId: poItem.itemId,
              warehouseId: v.data.warehouseId,
              quantity: acceptedQty,
              unitCost: Number(poItem.unitPrice),
              grantId: po.grantId ?? undefined,
              referenceTable: "goods_receipt_notes",
              referenceId: grn.id,
              idempotencyKey: v.data.idempotencyKey ? `${v.data.idempotencyKey}:${line.poItemId}` : undefined,
              userId,
            });
            if (!stockResult.success) throw new Error(stockResult.error);
          }
        }

        await createAuditLog({
          organizationId: v.data.organizationId, userId,
          tableName:"goods_receipt_notes", recordId:grn.id, action:"CREATE",
          newValues:{ code, poId: v.data.poId, itemsCount: v.data.items.length },
        }, tx);

        return grn;
      });

      revalidatePath("/procurement");
      return { success:true as const, data:{ id: result.id, code: result.code } };
    });
  } catch (e) {
    if (e instanceof IdempotencyInProgressError) return { success:false, error:e.message };
    console.error(e);
    return { success:false, error: e instanceof Error && e.message ? e.message : "حدث خطأ غير متوقع باستلام البضاعة" };
  }
}
