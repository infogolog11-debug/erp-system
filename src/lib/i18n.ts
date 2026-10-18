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
