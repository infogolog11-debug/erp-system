// حساب مهلة الاستجابة (SLA) للشكاوى حسب الأولوية والحساسية
// المعايير الشائعة في القطاع الإنساني: الشكاوى الحساسة (حماية/SGBV/فساد) تُعالَج فوراً

const SLA_DAYS: Record<string, number> = {
  critical: 1,
  high: 3,
  medium: 7,
  low: 14,
};

export function computeDueDate(
  receivedDate: Date,
  priority: "low"|"medium"|"high"|"critical",
  sensitivity: "standard"|"sensitive" = "standard",
): Date {
  // الشكاوى الحساسة تُعامَل بأعلى أولوية استجابة بغض النظر عن priority المُدخلة
  const days = sensitivity === "sensitive" ? Math.min(SLA_DAYS[priority], 1) : SLA_DAYS[priority];
  const due = new Date(receivedDate);
  due.setDate(due.getDate() + days);
  return due;
}

export function isOverdue(dueDate: Date | null, status: string, today: Date = new Date()): boolean {
  if (!dueDate) return false;
  if (status === "resolved" || status === "closed") return false;
  return today > dueDate;
}

export function daysOpen(receivedDate: Date, resolvedDate: Date | null, today: Date = new Date()): number {
  const end = resolvedDate ?? today;
  const diffMs = end.getTime() - receivedDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000*60*60*24)));
}
