// src/lib/budget/__tests__/warning.test.ts
import { describe, it, expect } from "vitest";
import { computeBudgetWarning } from "../warning-logic";

const base = {
  plannedAmount: 10000,
  spentAmount: 0,
  committedAmount: 0,
  lineName: "بند اختبار",
};

describe("computeBudgetWarning", () => {
  it("ok عندما الاستخدام أقل من حد التحذير", () => {
    const r = computeBudgetWarning({ ...base, requestedAmount: 1000 }); // 10%
    expect(r.warningLevel).toBe("ok");
    expect(r.canProceed).toBe(true);
  });

  it("warning عند وصول الاستخدام لحد warningThreshold (80% افتراضياً)", () => {
    const r = computeBudgetWarning({ ...base, requestedAmount: 8000 }); // 80%
    expect(r.warningLevel).toBe("warning");
    expect(r.canProceed).toBe(true);
  });

  it("critical عند تجاوز 95%", () => {
    const r = computeBudgetWarning({ ...base, requestedAmount: 9600 }); // 96%
    expect(r.warningLevel).toBe("critical");
    expect(r.canProceed).toBe(true);
  });

  it("blocked ويمنع المتابعة عند تجاوز 100%", () => {
    const r = computeBudgetWarning({ ...base, requestedAmount: 10500 }); // 105%
    expect(r.warningLevel).toBe("blocked");
    expect(r.canProceed).toBe(false);
  });

  it("يأخذ بعين الاعتبار المبالغ المصروفة والملتزم بها مسبقاً", () => {
    const r = computeBudgetWarning({
      ...base, spentAmount: 5000, committedAmount: 2000, requestedAmount: 2000,
    }); // (5000+2000+2000)/10000 = 90%
    expect(r.utilizationPct).toBe(90);
    expect(r.warningLevel).toBe("warning");
  });

  it("يحترم عتبات مخصصة (warningThreshold/blockThreshold) بدل الافتراضية", () => {
    const r = computeBudgetWarning({
      ...base, requestedAmount: 6000, warningThreshold: 50, blockThreshold: 90,
    }); // 60% > عتبة تحذير مخصصة 50%
    expect(r.warningLevel).toBe("warning");
  });

  it("blocked بعتبة مخصصة أقل من الافتراضي", () => {
    const r = computeBudgetWarning({
      ...base, requestedAmount: 9500, blockThreshold: 90,
    }); // 95% > عتبة حجب مخصصة 90%
    expect(r.warningLevel).toBe("blocked");
    expect(r.canProceed).toBe(false);
  });

  it("لا ينهار عند plannedAmount صفر (تفادي القسمة على صفر)", () => {
    const r = computeBudgetWarning({ ...base, plannedAmount: 0, requestedAmount: 100 });
    expect(Number.isFinite(r.utilizationPct)).toBe(true);
  });

  it("remainingAmount يُحسب بشكل صحيح بعد الصرف والالتزام", () => {
    const r = computeBudgetWarning({
      ...base, spentAmount: 3000, committedAmount: 1000, requestedAmount: 500,
    });
    expect(r.remainingAmount).toBe(6000); // 10000 - (3000+1000)
  });
});
