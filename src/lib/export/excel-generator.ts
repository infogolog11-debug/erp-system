// ════════════════════════════════════════════════════════════
// مولّد Excel — يُستخدم في API routes لتوليد ملفات XLSX
// يستخدم SheetJS (xlsx) المتاح في البيئة
// ════════════════════════════════════════════════════════════

export type PayrollExcelData = {
  periodName: string;
  month:      string;
  year:       number;
  lines: Array<{
    empCode:          string;
    employeeName:     string;
    baseSalary:       number;
    housingAllowance: number;
    transportAllowance: number;
    performanceBonus: number;
    overtimePay:      number;
    otherAllowances:  number;
    totalAllowances:  number;
    absentDeduction:  number;
    incomeTax:        number;
    socialSecurity:   number;
    loanDeduction:    number;
    otherDeductions:  number;
    totalDeductions:  number;
    grossSalary:      number;
    netSalary:        number;
    daysPresent:      number;
    daysAbsent:       number;
    overtimeHours:    number;
    paymentStatus:    string;
  }>;
};

// يُنتج بيانات JSON مُهيَّأة للتحويل إلى Excel عبر SheetJS في الـ client
export function buildPayrollSheetData(data: PayrollExcelData) {
  const headers = [
    "الكود", "الموظف",
    "الراتب الأساسي", "بدل السكن", "بدل المواصلات", "مكافأة الأداء",
    "أجر الأوفرتايم", "بدلات أخرى", "إجمالي البدلات",
    "خصم الغياب", "ضريبة الدخل", "الضمان الاجتماعي",
    "خصم القرض", "خصومات أخرى", "إجمالي الخصومات",
    "الراتب الإجمالي", "الراتب الصافي",
    "أيام حضور", "أيام غياب", "ساعات أوفرتايم", "حالة الدفع",
  ];

  const rows = data.lines.map(l => [
    l.empCode, l.employeeName,
    l.baseSalary, l.housingAllowance, l.transportAllowance, l.performanceBonus,
    l.overtimePay, l.otherAllowances, l.totalAllowances,
    l.absentDeduction, l.incomeTax, l.socialSecurity,
    l.loanDeduction, l.otherDeductions, l.totalDeductions,
    l.grossSalary, l.netSalary,
    l.daysPresent, l.daysAbsent, l.overtimeHours,
    l.paymentStatus === "paid" ? "مدفوع" : l.paymentStatus === "on_hold" ? "موقوف" : "معلق",
  ]);

  // صف الإجمالي
  const totals = data.lines.reduce((acc, l) => ({
    baseSalary:       acc.baseSalary       + l.baseSalary,
    totalAllowances:  acc.totalAllowances  + l.totalAllowances,
    totalDeductions:  acc.totalDeductions  + l.totalDeductions,
    grossSalary:      acc.grossSalary      + l.grossSalary,
    netSalary:        acc.netSalary        + l.netSalary,
  }), { baseSalary:0, totalAllowances:0, totalDeductions:0, grossSalary:0, netSalary:0 });

  const totalsRow = [
    "الإجمالي", "",
    totals.baseSalary, "", "", "", "", "", totals.totalAllowances,
    "", "", "", "", "", totals.totalDeductions,
    totals.grossSalary, totals.netSalary,
    "", "", "", "",
  ];

  return {
    sheetName:  `رواتب ${data.month} ${data.year}`,
    headers,
    rows,
    totalsRow,
    meta: { periodName:data.periodName, month:data.month, year:data.year },
  };
}

export function buildGrantsSheetData(grants: Array<{
  code:string; name:string; donor:string; totalAmount:number; spentAmount:number;
  committedAmount:number; status:string; startDate:string; endDate:string;
}>) {
  return {
    sheetName: "تقرير المنح",
    headers: [
      "الكود","اسم المنحة","المانح","المبلغ الإجمالي",
      "المنفق","الملتزم","المتبقي","نسبة الإنفاق","الحالة","تاريخ البداية","تاريخ النهاية"
    ],
    rows: grants.map(g => {
      const remaining = g.totalAmount - g.spentAmount - g.committedAmount;
      const pct = g.totalAmount > 0 ? ((g.spentAmount / g.totalAmount) * 100).toFixed(1)+"%" : "0%";
      return [
        g.code, g.name, g.donor,
        g.totalAmount, g.spentAmount, g.committedAmount, remaining, pct,
        g.status, g.startDate, g.endDate,
      ];
    }),
  };
}

export function buildVendorsSheetData(vendors: Array<{
  code:string; name:string; email:string; phone:string; country:string;
  status:string; averageRating:number; ratingsCount:number;
}>) {
  return {
    sheetName: "قائمة الموردين",
    headers: ["الكود","اسم المورد","البريد","الهاتف","الدولة","الحالة","متوسط التقييم","عدد التقييمات"],
    rows: vendors.map(v => [
      v.code, v.name, v.email ?? "", v.phone ?? "", v.country ?? "",
      v.status, v.averageRating ?? 0, v.ratingsCount ?? 0,
    ]),
  };
}
