// إعادة الفحص الدورية — المعيار الشائع: فحص سنوي، أو فوري عند وجود تطابق محتمل

export function computeNextScreeningDue(
  screeningDate: Date,
  result: "clear"|"potential_match"|"confirmed_match"|"pending_review",
): Date | null {
  // التطابق المؤكد يعني إيقاف التعامل — لا داعي لجدولة فحص لاحق تلقائياً
  if (result === "confirmed_match") return null;
  // التطابق المحتمل يحتاج مراجعة سريعة خلال 30 يوماً وليس دورة سنوية كاملة
  const months = result === "potential_match" ? 1 : 12;
  const due = new Date(screeningDate);
  due.setMonth(due.getMonth() + months);
  return due;
}

export function isScreeningOverdue(nextScreeningDue: Date | null, today: Date = new Date()): boolean {
  if (!nextScreeningDue) return false;
  return today > nextScreeningDue;
}

export function screeningStatusLabel(
  hasRecord: boolean,
  result: "clear"|"potential_match"|"confirmed_match"|"pending_review"|null,
  overdue: boolean,
): "not_screened"|"overdue"|"clear"|"flagged"|"blocked" {
  if (!hasRecord) return "not_screened";
  if (result === "confirmed_match") return "blocked";
  if (result === "potential_match" || result === "pending_review") return "flagged";
  if (overdue) return "overdue";
  return "clear";
}
