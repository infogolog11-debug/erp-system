import type { AppLocale } from "@/lib/preferences";

export function getLocaleTag(locale: AppLocale) {
  return locale === "ar" ? "ar-SA" : "en-US";
}

export const commonCopy = {
  ar: {
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    showing: "عرض",
    of: "من",
    cancel: "إلغاء",
    save: "حفظ",
    saveChanges: "حفظ التغييرات",
    optional: "اختياري",
    select: "اختر...",
    noGrant: "بدون منحة",
  },
  en: {
    previous: "Previous",
    next: "Next",
    page: "Page",
    showing: "Showing",
    of: "of",
    cancel: "Cancel",
    save: "Save",
    saveChanges: "Save changes",
    optional: "Optional",
    select: "Select...",
    noGrant: "No grant",
  },
} as const;

export const grantStatusLabels = {
  ar: {
    draft: "مسودة",
    submitted: "قيد المراجعة",
    approved: "معتمدة",
    rejected: "مرفوضة",
    done: "مكتملة",
    cancelled: "ملغاة",
  },
  en: {
    draft: "Draft",
    submitted: "In review",
    approved: "Approved",
    rejected: "Rejected",
    done: "Completed",
    cancelled: "Cancelled",
  },
} as const;

export const procurementStatusLabels = {
  ar: {
    draft: "مسودة",
    submitted: "بانتظار الموافقة",
    approved: "معتمدة",
    done: "منجزة",
  },
  en: {
    draft: "Draft",
    submitted: "Awaiting approval",
    approved: "Approved",
    done: "Completed",
  },
} as const;

export const procurementPriorityLabels = {
  ar: {
    urgent: "عاجل",
    high: "عالية",
    medium: "متوسطة",
    low: "منخفضة",
  },
  en: {
    urgent: "Urgent",
    high: "High",
    medium: "Medium",
    low: "Low",
  },
} as const;

// ── أنواع المناقصات (Tender Types) ──────────────────────────────────────
// sealed = تُقدَّم العروض مظروفة/سرّية (لا تُكشف قبل موعد الفتح)
export const TENDER_TYPES = [
  { key: "open",            sealed: true  },
  { key: "limited",         sealed: true  },
  { key: "itb",             sealed: true  },
  { key: "framework",       sealed: true  },
  { key: "rfq",             sealed: false },
  { key: "rfp",             sealed: false },
  { key: "direct",          sealed: false },
  { key: "reverse_auction", sealed: false },
] as const;

export type TenderTypeKey = (typeof TENDER_TYPES)[number]["key"];

export const TENDER_TYPE_KEYS = TENDER_TYPES.map(t => t.key) as unknown as [TenderTypeKey, ...TenderTypeKey[]];

export const tenderTypeLabels: Record<AppLocale, Record<TenderTypeKey, string>> = {
  ar: {
    open:            "مناقصة عامة",
    limited:         "مناقصة محدودة",
    itb:             "دعوة لتقديم عطاء",
    framework:       "اتفاقية إطارية",
    rfq:             "طلب عرض سعر",
    rfp:             "طلب تقديم مقترح",
    direct:          "شراء مباشر",
    reverse_auction: "مزاد عكسي",
  },
  en: {
    open:            "Open tender",
    limited:         "Limited tender",
    itb:             "Invitation to bid",
    framework:       "Framework agreement",
    rfq:             "Request for quotation",
    rfp:             "Request for proposal",
    direct:          "Direct purchase",
    reverse_auction: "Reverse auction",
  },
};

export function tenderTypeLabel(key: string | null | undefined, locale: AppLocale = "ar") {
  const table = tenderTypeLabels[locale] ?? tenderTypeLabels.ar;
  return table[key as TenderTypeKey] ?? key ?? "—";
}

export function tenderTypeIsSealed(key: string | null | undefined) {
  return TENDER_TYPES.find(t => t.key === key)?.sealed ?? true;
}
