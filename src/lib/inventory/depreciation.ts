// ════════════════════════════════════════
// حاسبة الاستهلاك الشهري — مدمجة من nexus-erp
// تدعم: القسط الثابت (straight_line)
//        القسط المتناقص (declining_balance)
// ════════════════════════════════════════

export type DepreciationInput = {
  purchaseValue:            number;
  salvageValue:             number;
  usefulLifeYears:          number;
  currentValue:             number;
  accumulatedDepreciation:  number;
  depreciationMethod:       "straight_line" | "declining_balance";
  depreciationRate?:        number; // للقسط المتناقص فقط
  purchaseDate:             string;
};

export type DepreciationResult = {
  monthlyDepreciation:     number;
  newBookValue:            number;
  newAccumulatedDepr:      number;
  isFullyDepreciated:      boolean;
};

export function calculateMonthlyDepreciation(
  asset: DepreciationInput,
): DepreciationResult {
  const depreciable = asset.purchaseValue - asset.salvageValue;
  const totalMonths = asset.usefulLifeYears * 12;
  const bookValue   = asset.currentValue;

  // الأصل مكتمل الاستهلاك
  if (bookValue <= asset.salvageValue) {
    return {
      monthlyDepreciation:    0,
      newBookValue:           asset.salvageValue,
      newAccumulatedDepr:     depreciable,
      isFullyDepreciated:     true,
    };
  }

  let monthly = 0;
  if (asset.depreciationMethod === "straight_line") {
    monthly = depreciable / totalMonths;
  } else if (asset.depreciationMethod === "declining_balance") {
    const rate = asset.depreciationRate ?? 2 / asset.usefulLifeYears;
    monthly = (bookValue * rate) / 12;
  }

  monthly = Math.min(monthly, bookValue - asset.salvageValue);

  const newBookValue       = +(bookValue - monthly).toFixed(2);
  const newAccumulatedDepr = +(asset.accumulatedDepreciation + monthly).toFixed(4);

  return {
    monthlyDepreciation: +monthly.toFixed(4),
    newBookValue,
    newAccumulatedDepr,
    isFullyDepreciated: newBookValue <= asset.salvageValue,
  };
}

/** توليد جدول استهلاك كامل لعمر الأصل */
export function generateDepreciationSchedule(asset: DepreciationInput): DepreciationResult[] {
  const schedule: DepreciationResult[] = [];
  let current = { ...asset };

  for (let i = 0; i < asset.usefulLifeYears * 12; i++) {
    const result = calculateMonthlyDepreciation(current);
    schedule.push(result);
    if (result.isFullyDepreciated) break;
    current = {
      ...current,
      currentValue:           result.newBookValue,
      accumulatedDepreciation: result.newAccumulatedDepr,
    };
  }
  return schedule;
}
