// ════════════════════════════════════════
// حاسبة الرواتب — مدمجة من nexus-erp
// تدعم: الخصم بالغياب، الأوفرتايم x1.5،
//        ضريبة الدخل 5%، الضمان الاجتماعي 7.5%
// ════════════════════════════════════════

export type AttendanceSummary = {
  workingDaysInMonth: number;
  daysPresent:        number;
  daysAbsent:         number;
  daysLeave:          number;
  overtimeHours:      number;
};

export type ContractData = {
  baseSalary:         number;
  housingAllowance:   number;
  transportAllowance: number;
  otherAllowances:    number;
  workingDays:        number;
};

export type AdditionalComponents = {
  performanceBonus: number;
  loanDeduction:    number;
  otherDeductions:  number;
  otherAllowances:  number;
};

export type PayrollResult = {
  baseSalary:          number;
  adjustedBaseSalary:  number;
  housingAllowance:    number;
  transportAllowance:  number;
  performanceBonus:    number;
  overtimePay:         number;
  otherAllowances:     number;
  totalAllowances:     number;
  absentDeduction:     number;
  incomeTax:           number;
  socialSecurity:      number;
  loanDeduction:       number;
  otherDeductions:     number;
  totalDeductions:     number;
  grossSalary:         number;
  netSalary:           number;
} & AttendanceSummary;

export type PayrollConfig = {
  incomeTaxRate:       number;  // من الإعدادات الديناميكية
  socialSecurityRate:  number;
  overtimeMultiplier:  number;
  taxExemptThreshold:  number;
};

const DEFAULT_CONFIG: PayrollConfig = {
  incomeTaxRate:      0.05,
  socialSecurityRate: 0.075,
  overtimeMultiplier: 1.5,
  taxExemptThreshold: 500,
};

// ── تحديد بدل السكن/المواصلات: يفضّل قيمة العقد الفردية، وإلا يرجع
//    لقيمة الكتالوج الافتراضية على مستوى المنظمة ──────────────────
export type AllowanceCatalogEntry = { componentType: string; code: string; defaultValue: string | number | null };

export function resolveContractAllowance(
  contractValue: string | number | null | undefined,
  catalog: readonly AllowanceCatalogEntry[],
  code: "HOUSE" | "TRANS",
): number {
  if (contractValue != null) return Number(contractValue);
  const entry = catalog.find(c => c.componentType === "allowance" && c.code === code);
  return entry?.defaultValue != null ? Number(entry.defaultValue) : 0;
}

export function calculatePayroll(
  contract: ContractData,
  att:      AttendanceSummary,
  extra:    AdditionalComponents,
  config:   PayrollConfig = DEFAULT_CONFIG,
): PayrollResult {
  const dailyRate        = contract.baseSalary / contract.workingDays;
  const absentDeduction  = dailyRate * att.daysAbsent;
  const adjustedBase     = contract.baseSalary - absentDeduction;
  const overtimePay      = att.overtimeHours * (dailyRate / 8) * config.overtimeMultiplier;

  const totalAllowances  =
    contract.housingAllowance +
    contract.transportAllowance +
    extra.performanceBonus +
    overtimePay +
    contract.otherAllowances +
    extra.otherAllowances;

  const grossSalary    = adjustedBase + totalAllowances;
  const taxable        = Math.max(0, grossSalary - config.taxExemptThreshold);
  const incomeTax      = taxable * config.incomeTaxRate;
  const socialSecurity = grossSalary * config.socialSecurityRate;

  const totalDeductions =
    absentDeduction + incomeTax + socialSecurity +
    extra.loanDeduction + extra.otherDeductions;

  const netSalary = Math.max(0, grossSalary - totalDeductions);

  return {
    baseSalary:         contract.baseSalary,
    adjustedBaseSalary: +adjustedBase.toFixed(2),
    housingAllowance:   contract.housingAllowance,
    transportAllowance: contract.transportAllowance,
    performanceBonus:   extra.performanceBonus,
    overtimePay:        +overtimePay.toFixed(2),
    otherAllowances:    contract.otherAllowances + extra.otherAllowances,
    totalAllowances:    +totalAllowances.toFixed(2),
    absentDeduction:    +absentDeduction.toFixed(2),
    incomeTax:          +incomeTax.toFixed(2),
    socialSecurity:     +socialSecurity.toFixed(2),
    loanDeduction:      extra.loanDeduction,
    otherDeductions:    extra.otherDeductions,
    totalDeductions:    +totalDeductions.toFixed(2),
    grossSalary:        +grossSalary.toFixed(2),
    netSalary:          +netSalary.toFixed(2),
    ...att,
  };
}

/** أيام العمل الفعلية في الشهر (يستثني الجمعة والسبت) */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 5 && day !== 6) count++;
  }
  return count;
}
