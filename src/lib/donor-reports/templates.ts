// ════════════════════════════════════════════════════════════
// Donor Reporting — حسابات نماذج التقارير المالية حسب معايير المانحين
// USAID SF-425 | ECHO Single Form | UNHCR IPR
// ════════════════════════════════════════════════════════════

export type BudgetLineInput = {
  code: string; name: string; nameAr: string | null; budgetCategory: string;
  plannedAmount: number; committedAmount: number; spentAmount: number;
};

export type GrantInput = {
  code: string; name: string; nameAr: string | null;
  totalAmount: number; currencyCode: string;
  startDate: string; endDate: string;
};

const CATEGORY_LABEL_AR: Record<string,string> = {
  staff:"الموارد البشرية", supplies:"المستلزمات", services:"الخدمات", travel:"السفر", other:"أخرى",
};

// ── USAID SF-425 (Federal Financial Report) ───────────────────────
// https://www.usaid.gov — تقرير مالي فيدرالي ربعي/نهائي
export function computeSF425(grant: GrantInput, lines: BudgetLineInput[]) {
  const totalFederalAuthorized = grant.totalAmount;
  const federalExpenditures    = lines.reduce((s,l)=>s+l.spentAmount,0);       // 10e
  const unliquidatedObligations = lines.reduce((s,l)=>s+l.committedAmount,0);  // 10f
  const totalFederalShare      = federalExpenditures + unliquidatedObligations; // 10g
  const unobligatedBalance     = totalFederalAuthorized - totalFederalShare;    // 10h = 10d - 10g

  return {
    template: "usaid_sf425" as const,
    grant,
    line10: {
      a_cashReceipts:      totalFederalAuthorized, // مبسّط: نفترض استلام كامل التمويل المعتمد
      b_cashDisbursements: federalExpenditures,
      c_cashOnHand:        totalFederalAuthorized - federalExpenditures,
      d_totalFederalAuthorized: totalFederalAuthorized,
      e_federalShareExpenditures: federalExpenditures,
      f_federalShareUnliquidatedObligations: unliquidatedObligations,
      g_totalFederalShare: totalFederalShare,
      h_unobligatedBalance: unobligatedBalance,
      i_totalRecipientShare: 0,   // لا يوجد تمويل مناظر متتبَّع حالياً
      j_programIncome: 0,          // لا يوجد دخل برنامج متتبَّع حالياً
    },
    byCategory: lines.map(l => ({
      category: CATEGORY_LABEL_AR[l.budgetCategory] ?? l.budgetCategory,
      planned: l.plannedAmount, spent: l.spentAmount, committed: l.committedAmount,
      remaining: l.plannedAmount - l.spentAmount - l.committedAmount,
    })),
  };
}

// ── ECHO Single Form (Financial Report Annex) ──────────────────────
// https://ec.europa.eu/echo — تقرير مالي حسب فئة الموازنة
export function computeEchoSingleForm(grant: GrantInput, lines: BudgetLineInput[]) {
  const rows = lines.map(l => {
    const actualCost = l.spentAmount + l.committedAmount;
    const balance = l.plannedAmount - actualCost;
    const implementationPct = l.plannedAmount > 0 ? (actualCost/l.plannedAmount*100) : 0;
    return {
      budgetLine: l.nameAr || l.name,
      category: CATEGORY_LABEL_AR[l.budgetCategory] ?? l.budgetCategory,
      budgetApproved: l.plannedAmount,
      actualCostToDate: actualCost,
      balance,
      implementationPct,
    };
  });

  const totals = {
    budgetApproved: rows.reduce((s,r)=>s+r.budgetApproved,0),
    actualCostToDate: rows.reduce((s,r)=>s+r.actualCostToDate,0),
    balance: rows.reduce((s,r)=>s+r.balance,0),
  };

  return {
    template: "echo_single_form" as const,
    grant, rows,
    totals: {
      ...totals,
      implementationPct: totals.budgetApproved > 0 ? (totals.actualCostToDate/totals.budgetApproved*100) : 0,
    },
  };
}

// ── UNHCR IPR (Implementing Partner Report) ────────────────────────
// تقرير الشريك المنفّذ: قسم مالي + قسم إنجاز مقابل الأهداف
export function computeUnhcrIPR(
  grant: GrantInput, lines: BudgetLineInput[],
  achievement: { beneficiariesReached: number; beneficiariesTargeted: number; distributionsCount: number; totalDistributionValue: number },
) {
  const financial = lines.map(l => ({
    budgetLine: l.nameAr || l.name,
    category: CATEGORY_LABEL_AR[l.budgetCategory] ?? l.budgetCategory,
    planned: l.plannedAmount,
    expenditure: l.spentAmount,
    variance: l.plannedAmount - l.spentAmount,
    utilizationPct: l.plannedAmount > 0 ? (l.spentAmount/l.plannedAmount*100) : 0,
  }));

  const achievementPct = achievement.beneficiariesTargeted > 0
    ? (achievement.beneficiariesReached / achievement.beneficiariesTargeted * 100)
    : 0;

  return {
    template: "unhcr_ipr" as const,
    grant, financial,
    totals: {
      planned: lines.reduce((s,l)=>s+l.plannedAmount,0),
      expenditure: lines.reduce((s,l)=>s+l.spentAmount,0),
    },
    achievement: { ...achievement, achievementPct },
  };
}

export function selectTemplate(reportingStandard: string) {
  switch (reportingStandard) {
    case "usaid_sf425": return "usaid_sf425" as const;
    case "echo_single_form": return "echo_single_form" as const;
    case "unhcr_ipr": return "unhcr_ipr" as const;
    default: return "generic" as const;
  }
}
