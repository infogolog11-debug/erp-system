// Helper: safe numeric conversion for Drizzle decimal fields (text-typed in PG)
export const n = (v: unknown, d = 0): number => {
  if (v === null || v === undefined) return d;
  const x = Number(v);
  return isNaN(x) ? d : x;
};

export type UserRole = "super_admin"|"admin"|"finance_manager"|"program_manager"|"hr_manager"|"procurement_officer"|"warehouse_manager"|"viewer";

// ── أنواع العرض المشتركة لمكونات القوائم (List/Card components) ──────────
// تُستخدم في مكونات client تستقبل بيانات مُجهَّزة من صفحات server
export type DisplayRecord = {
  id: string;
  [key: string]: unknown;
};

export type GrantDisplay = DisplayRecord & {
  code: string; name: string; status: string;
  totalAmount: string | number;
  endDate: string | Date;
  donor?: { name: string; nameAr?: string | null } | null;
  budgetLines?: BudgetLineDisplay[];
};

export type BudgetLineDisplay = DisplayRecord & {
  code: string; name: string; nameAr?: string | null;
  budgetCategory?: string | null;
  plannedAmount: string | number;
  spentAmount: string | number;
  committedAmount?: string | number;
  warningThreshold?: number | null;
  blockThreshold?: number | null;
};

export type AccountDisplay = DisplayRecord & {
  code: string; name: string; nameAr?: string | null;
  accountType: string; currentBalance?: string | number;
};

export type JournalEntryDisplay = DisplayRecord & {
  code: string; entryDate: string | Date; entryType?: string;
  description?: string | null; totalDebit: string | number;
  totalCredit: string | number; status: string;
};

export type AssetDisplay = DisplayRecord & {
  code: string; name: string;
  purchaseDate: string | Date;
  purchaseCost: string | number;
  currentValue?: string | number | null;
  location?: string | null;
  assetCondition: string;
};

export type EmployeeDisplay = DisplayRecord & {
  code: string; firstNameAr?: string | null; lastNameAr?: string | null;
  firstName?: string | null; lastName?: string | null;
  email?: string | null;
  isActive: boolean;
  department?: { name: string; nameAr?: string | null } | null;
  position?:   { title: string; titleAr?: string | null } | null;
  contracts?: { contractType: string; baseSalary?: string | number | null }[];
};

export type PRDisplay = DisplayRecord & {
  code: string; title: string; status: string; priority?: string | null;
  estimatedTotal?: string | number | null;
  isEmergency?: boolean;
  grant?: { name: string; nameAr?: string | null } | null;
};

export type VendorDisplay = DisplayRecord & {
  code: string; name: string; nameAr?: string | null; status: string;
  vendorType?: string | null; email?: string | null;
  overallScore?: string | number | null;
  contacts?: { email?: string | null; phone?: string | null }[];
};

// ── معالج رسائل الأخطاء الآمن للـ catch(e) بنوع unknown ──────────────────
export function errMsg(e: unknown, fallback = "حدث خطأ غير متوقع"): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}
