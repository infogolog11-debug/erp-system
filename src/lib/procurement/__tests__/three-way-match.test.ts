// src/lib/procurement/__tests__/three-way-match.test.ts
import { describe, it, expect } from "vitest";
import { computeItemVariance, computeOverallMatchStatus } from "../three-way-match-logic";

describe("computeItemVariance", () => {
  it("يعتبر البند مطابقاً عند تطابق الكمية والسعر تماماً", () => {
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 100, tolerancePct: 5,
    });
    expect(r.status).toBe("matched");
    expect(r.qtyVariance).toBe(0);
  });

  it("يعتبر البند غير مستلم إذا كانت الكمية المستلمة صفر", () => {
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 0, tolerancePct: 5,
    });
    expect(r.status).toBe("not_received");
  });

  it("يقبل انحراف الكمية ضمن هامش التسامح دون تحذير", () => {
    // انحراف 3% وهامش التسامح 5% → يجب أن يبقى مطابقاً
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 103, tolerancePct: 5,
    });
    expect(r.status).toBe("matched");
  });

  it("يرصد زيادة الكمية عند تجاوز هامش التسامح", () => {
    // انحراف 10% أكبر من هامش 5%
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 110, tolerancePct: 5,
    });
    expect(r.status).toBe("qty_over");
    expect(r.qtyVariance).toBe(10);
  });

  it("يرصد نقص الكمية عند تجاوز هامش التسامح", () => {
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 80, tolerancePct: 5,
    });
    expect(r.status).toBe("qty_short");
    expect(r.qtyVariance).toBe(-20);
  });

  it("يرصد فرق السعر عند تجاوز هامش التسامح", () => {
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 100, invoiceUnitPrice: 2.5, tolerancePct: 5,
    });
    expect(r.status).toBe("price_mismatch");
  });

  it("لا ينهار عند poQty صفر (تفادي القسمة على صفر)", () => {
    const r = computeItemVariance({
      itemDescription: "بند مجاني", poQty: 0, poUnitPrice: 0,
      receivedQty: 0, tolerancePct: 5,
    });
    expect(r.qtyVariancePct).toBe(0);
    expect(Number.isFinite(r.qtyVariancePct)).toBe(true);
  });

  it("حدود هامش التسامح: انحراف مساوٍ تماماً للحد يبقى مطابقاً (> صارمة وليس >=)", () => {
    // انحراف 5% بالضبط مع هامش تسامح 5%
    const r = computeItemVariance({
      itemDescription: "أقلام", poQty: 100, poUnitPrice: 2,
      receivedQty: 105, tolerancePct: 5,
    });
    expect(r.status).toBe("matched");
  });
});

describe("computeOverallMatchStatus", () => {
  it("pending_grn عند عدم وجود مذكرة استلام", () => {
    const r = computeOverallMatchStatus({ hasGrn: false, variances: [] });
    expect(r.overallStatus).toBe("pending_grn");
    expect(r.canApprovePayment).toBe(false);
  });

  it("fully_matched ويسمح بالدفع عندما كل البنود مطابقة", () => {
    const r = computeOverallMatchStatus({
      hasGrn: true,
      variances: [computeItemVariance({ itemDescription:"a", poQty:10, poUnitPrice:1, receivedQty:10, tolerancePct:5 })],
    });
    expect(r.overallStatus).toBe("fully_matched");
    expect(r.canApprovePayment).toBe(true);
  });

  it("mismatch ولا يسمح بالدفع عند وجود نقص بالكمية", () => {
    const r = computeOverallMatchStatus({
      hasGrn: true,
      variances: [computeItemVariance({ itemDescription:"a", poQty:10, poUnitPrice:1, receivedQty:5, tolerancePct:5 })],
    });
    expect(r.overallStatus).toBe("mismatch");
    expect(r.canApprovePayment).toBe(false);
  });

  it("partial_match عند وجود فرق سعر فقط بدون نقص كمية", () => {
    const r = computeOverallMatchStatus({
      hasGrn: true,
      variances: [computeItemVariance({ itemDescription:"a", poQty:10, poUnitPrice:1, receivedQty:10, invoiceUnitPrice:2, tolerancePct:5 })],
    });
    expect(r.overallStatus).toBe("partial_match");
    expect(r.canApprovePayment).toBe(false);
  });
});
