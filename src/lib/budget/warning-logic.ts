// src/lib/budget/warning-logic.ts
// منطق نقي (بدون "use server") — قابل للاستيراد من كود العميل والاختبارات على حد سواء.

export type BudgetCheckResult = {
  canProceed:      boolean;
  utilizationPct:  number;
  remainingAmount: number;
  plannedAmount:   number;
  spentAmount:     number;
  committedAmount: number;
  warningLevel:    "ok" | "warning" | "critical" | "blocked";
  message:         string;
};

// ─── حساب مستوى التحذير (دالة نقية — قابلة للاختبار بدون قاعدة بيانات) ──
export function computeBudgetWarning(input: {
  plannedAmount: number;
  spentAmount: number;
  committedAmount: number;
  requestedAmount: number;
  warningThreshold?: number | null;
  blockThreshold?: number | null;
  lineName: string;
}): Pick<BudgetCheckResult, "canProceed"|"utilizationPct"|"remainingAmount"|"warningLevel"|"message"> {
  const { plannedAmount: planned, spentAmount: spent, committedAmount: committed, requestedAmount, lineName } = input;
  const used          = spent + committed;
  const afterRequest  = used + requestedAmount;
  const pct           = planned > 0 ? (afterRequest / planned) * 100 : 0;
  const remaining     = planned - used;

  const warningThreshold = input.warningThreshold ?? 80;
  const blockThreshold   = input.blockThreshold   ?? 100;

  let warningLevel: BudgetCheckResult["warningLevel"] = "ok";
  let canProceed = true;
  let message = "";

  if (pct >= blockThreshold) {
    warningLevel = "blocked";
    canProceed   = false;
    message = `تجاوز ميزانية "${lineName}": المبلغ المطلوب (${requestedAmount.toLocaleString()}) يتجاوز الحد المتاح (${remaining.toLocaleString()})`;
  } else if (pct >= 95) {
    warningLevel = "critical";
    message = `تحذير حرج: استخدام ميزانية "${lineName}" وصل ${pct.toFixed(1)}%`;
  } else if (pct >= warningThreshold) {
    warningLevel = "warning";
    message = `تنبيه: استخدام ميزانية "${lineName}" سيصل ${pct.toFixed(1)}% بعد هذا الطلب`;
  }

  return {
    canProceed,
    utilizationPct:  +pct.toFixed(2),
    remainingAmount: +remaining.toFixed(2),
    warningLevel,
    message,
  };
}
