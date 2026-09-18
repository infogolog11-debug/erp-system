// ════════════════════════════════════════════════════════════
// محرك المطابقة الثلاثية (3-Way Matching) — طبقة 1
// PO (ما طُلب) ↔ GRN (ما وصل) ↔ Invoice (ما فُوتر)
// يمنع الدفع إذا وجد تعارض
// ════════════════════════════════════════════════════════════
"use server";
import { errMsg } from "@/types/db";

import { db } from "@/db";
import { getProcurementSettings } from "@/lib/settings/service";
import {
  purchaseOrders, purchaseOrderItems,
  goodsReceiptNotes, grnItems,
  vendorInvoices,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  computeItemVariance, computeOverallMatchStatus,
  type MatchVariance, type ThreeWayMatchResult,
} from "./three-way-match-logic";

export type { MatchVariance, ThreeWayMatchResult };

// ─── تنفيذ المطابقة الثلاثية لفاتورة محددة ──────────────────────────────
export async function runThreeWayMatch(
  invoiceId: string,
): Promise<{ success:true; data:ThreeWayMatchResult } | { success:false; error:string }> {
  try {
    // 1. جلب الفاتورة
    const invoice = await db.query.vendorInvoices.findFirst({
      where: eq(vendorInvoices.id, invoiceId),
    });
    if (!invoice) return { success:false, error:"الفاتورة غير موجودة" };

    // 2. جلب أمر الشراء وبنوده
    const po = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, invoice.poId),
    });
    if (!po) return { success:false, error:"أمر الشراء غير موجود" };

    const poItems = await db.query.purchaseOrderItems.findMany({
      where: eq(purchaseOrderItems.poId, invoice.poId),
    });

    // 3. جلب مذكرة الاستلام (GRN)
    const grn = invoice.grnId ? await db.query.goodsReceiptNotes.findFirst({
      where: eq(goodsReceiptNotes.id, invoice.grnId),
    }) : null;

    const grnItemsList = grn ? await db.query.grnItems.findMany({
      where: eq(grnItems.grnId, grn.id),
    }) : [];

    // 4. المطابقة بند بند — جلب هامش التسامح من الإعدادات الديناميكية
    const settings = await getProcurementSettings(invoice.organizationId);
    const TOLERANCE_PCT = settings.matchingTolerancePct;

    let totalPoAmount       = 0;
    let totalReceivedValue  = 0;
    const totalInvoiceAmount  = Number(invoice.totalAmount);

    const variances: MatchVariance[] = poItems.map(poItem => {
      const poQty       = Number(poItem.quantity);
      const poUnitPrice = Number(poItem.unitPrice);
      totalPoAmount    += poQty * poUnitPrice;

      const grnItem = grnItemsList.find(g => g.poItemId === poItem.id);
      const receivedQty = grnItem ? Number(grnItem.receivedQty) : 0;
      totalReceivedValue += receivedQty * poUnitPrice;

      return computeItemVariance({
        itemDescription: poItem.itemDescription,
        poQty, poUnitPrice, receivedQty,
        tolerancePct: TOLERANCE_PCT,
      });
    });

    // 5. الحكم الإجمالي
    const amountVariance = totalInvoiceAmount - totalReceivedValue;
    const { overallStatus, canApprovePayment, summary } = computeOverallMatchStatus({ hasGrn: !!grn, variances });

    return {
      success: true,
      data: {
        invoiceId, poId: invoice.poId, grnId: invoice.grnId ?? null,
        overallStatus, canApprovePayment,
        totalPoAmount:       +totalPoAmount.toFixed(2),
        totalReceivedValue:  +totalReceivedValue.toFixed(2),
        totalInvoiceAmount:  +totalInvoiceAmount.toFixed(2),
        amountVariance:      +amountVariance.toFixed(2),
        variances, summary,
      },
    };
  } catch (e) {
    return { success:false, error: errMsg(e) };
  }
}

// ─── تحديث حالة الفاتورة بناءً على نتيجة المطابقة ─────────────────────
export async function applyMatchingResult(
  invoiceId: string,
  userId:    string,
): Promise<{ success:true; data:ThreeWayMatchResult } | { success:false; error:string }> {
  const match = await runThreeWayMatch(invoiceId);
  if (!match.success) return match;

  // matchingStatus بقاعدة البيانات يقبل فقط: pending|matched|discrepancy|overridden
  const DB_STATUS_MAP: Record<ThreeWayMatchResult["overallStatus"], string> = {
    fully_matched: "matched",
    pending_grn:   "pending",
    mismatch:      "discrepancy",
    partial_match: "discrepancy",
  };

  const newStatus: "approved" | "submitted" = match.data.canApprovePayment ? "approved" : "submitted";
  await db.update(vendorInvoices)
    .set({
      status:             newStatus,
      matchingStatus:     DB_STATUS_MAP[match.data.overallStatus],
      matchingCheckedAt:  new Date(),
      matchingCheckedBy:  userId,
      updatedAt:          new Date(),
    })
    .where(eq(vendorInvoices.id, invoiceId));

  return match;
}
