// src/lib/procurement/three-way-match-logic.ts
// منطق نقي (بدون "use server") — قابل للاستيراد من كود العميل والاختبارات على حد سواء.
// ملفات "use server" لا يمكن أن تحتوي إلا على دوال async، لذا فُصل هذا المنطق هنا.

export type MatchVariance = {
  itemDescription: string;
  poQty:           number;
  receivedQty:     number;
  invoicedQty:     number;
  poUnitPrice:     number;
  invoiceUnitPrice: number;
  qtyVariance:     number;   // receivedQty - poQty
  priceVariance:   number;   // invoiceUnitPrice - poUnitPrice
  qtyVariancePct:  number;
  priceVariancePct: number;
  status: "matched" | "qty_over" | "qty_short" | "price_mismatch" | "not_received";
};

export type ThreeWayMatchResult = {
  invoiceId:       string;
  poId:            string;
  grnId:           string | null;
  overallStatus:   "fully_matched" | "partial_match" | "mismatch" | "pending_grn";
  canApprovePayment: boolean;
  totalPoAmount:   number;
  totalReceivedValue: number;
  totalInvoiceAmount: number;
  amountVariance:  number;
  variances:       MatchVariance[];
  summary:         string;
};

// ─── حساب الانحراف لبند واحد (دالة نقية — قابلة للاختبار بدون قاعدة بيانات) ──
export function computeItemVariance(input: {
  itemDescription: string;
  poQty: number;
  poUnitPrice: number;
  receivedQty: number;
  invoicedQty?: number;
  invoiceUnitPrice?: number;
  tolerancePct: number;
}): MatchVariance {
  const {
    itemDescription, poQty, poUnitPrice, receivedQty,
    tolerancePct,
  } = input;
  const invoicedQty      = input.invoicedQty ?? poQty;
  const invoiceUnitPrice = input.invoiceUnitPrice ?? poUnitPrice;

  const qtyVariance      = receivedQty - poQty;
  const priceVariance    = invoiceUnitPrice - poUnitPrice;
  const qtyVariancePct   = poQty > 0 ? (Math.abs(qtyVariance) / poQty) * 100 : 0;
  const priceVariancePct = poUnitPrice > 0 ? (Math.abs(priceVariance) / poUnitPrice) * 100 : 0;

  let status: MatchVariance["status"] = "matched";
  if (receivedQty === 0)                                        status = "not_received";
  else if (qtyVariancePct > tolerancePct && qtyVariance > 0)     status = "qty_over";
  else if (qtyVariancePct > tolerancePct && qtyVariance < 0)     status = "qty_short";
  else if (priceVariancePct > tolerancePct)                      status = "price_mismatch";

  return {
    itemDescription, poQty, receivedQty, invoicedQty,
    poUnitPrice, invoiceUnitPrice,
    qtyVariance, priceVariance,
    qtyVariancePct:   +qtyVariancePct.toFixed(2),
    priceVariancePct: +priceVariancePct.toFixed(2),
    status,
  };
}

// ─── الحكم الإجمالي على نتيجة المطابقة (دالة نقية) ──────────────────────
export function computeOverallMatchStatus(input: {
  hasGrn: boolean;
  variances: MatchVariance[];
}): { overallStatus: ThreeWayMatchResult["overallStatus"]; canApprovePayment: boolean; summary: string } {
  const { hasGrn, variances } = input;
  const hasAnyMismatch = variances.some(v => v.status !== "matched");
  const hasAnyShortage = variances.some(v => v.status === "qty_short" || v.status === "not_received");

  if (!hasGrn) {
    return { overallStatus:"pending_grn", canApprovePayment:false, summary:"لا يمكن الموافقة على الدفع: لم يُسجَّل استلام البضاعة بعد" };
  }
  if (!hasAnyMismatch) {
    return { overallStatus:"fully_matched", canApprovePayment:true, summary:"✅ المطابقة الثلاثية ناجحة — يمكن الموافقة على الدفع" };
  }
  if (hasAnyShortage) {
    return { overallStatus:"mismatch", canApprovePayment:false, summary:"⛔ تعارض: الكمية المستلمة أقل من المطلوبة — يتطلب مراجعة قبل الدفع" };
  }
  return {
    overallStatus:"partial_match", canApprovePayment:false,
    summary:`⚠️ تطابق جزئي: يوجد ${variances.filter(v=>v.status!=="matched").length} بند(وط) تحتاج مراجعة`,
  };
}
