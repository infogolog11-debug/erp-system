// ════════════════════════════════════════════════════════════
// خدمة الإعدادات الديناميكية — بديل كل القيم الـ hardcoded
// الاستخدام: const rate = await getSetting(orgId, "payroll", "income_tax_rate")
// ════════════════════════════════════════════════════════════
import { db }           from "@/db";
import { systemSettings } from "@/db/schema";
import { and, eq }      from "drizzle-orm";
import { cache }        from "react";

// cache() = يُخزَّن مؤقتاً لمدة طلب HTTP واحد (Next.js per-request cache)
export const getSetting = cache(async (
  organizationId: string,
  category:       string,
  key:            string,
  fallback?:      string,
): Promise<string> => {
  const row = await db.query.systemSettings.findFirst({
    where: and(
      eq(systemSettings.organizationId, organizationId),
      eq(systemSettings.category,       category),
      eq(systemSettings.settingKey,     key),
    ),
  });
  return row?.value ?? fallback ?? "";
});

export const getSettingNumber = cache(async (
  organizationId: string,
  category:       string,
  key:            string,
  fallback:       number,
): Promise<number> => {
  const val = await getSetting(organizationId, category, key, String(fallback));
  const n   = parseFloat(val);
  return isNaN(n) ? fallback : n;
});

export const getSettingBool = cache(async (
  organizationId: string,
  category:       string,
  key:            string,
  fallback:       boolean = false,
): Promise<boolean> => {
  const val = await getSetting(organizationId, category, key, String(fallback));
  return val === "true" || val === "1";
});

// جلب كل إعدادات تصنيف دفعةً واحدة (أكثر كفاءة)
export const getCategorySettings = cache(async (
  organizationId: string,
  category:       string,
): Promise<Record<string, string>> => {
  const rows = await db.query.systemSettings.findMany({
    where: and(
      eq(systemSettings.organizationId, organizationId),
      eq(systemSettings.category,       category),
    ),
  });
  return Object.fromEntries(rows.map(r => [r.settingKey, r.value]));
});

// جلب كل إعدادات المنظمة مُجمَّعة حسب التصنيف
export const getAllSettings = cache(async (
  organizationId: string,
): Promise<Record<string, Record<string, string>>> => {
  const rows = await db.query.systemSettings.findMany({
    where: eq(systemSettings.organizationId, organizationId),
  });
  return rows.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = {};
    acc[r.category][r.settingKey] = r.value;
    return acc;
  }, {} as Record<string, Record<string, string>>);
});

// ── اختصارات جاهزة لكل وحدة ──────────────────────────────────────────

export async function getPayrollSettings(orgId: string) {
  const s = await getCategorySettings(orgId, "payroll");
  return {
    incomeTaxRate:       parseFloat(s.income_tax_rate       ?? "5")   / 100,
    socialSecurityRate:  parseFloat(s.social_security_rate  ?? "7.5") / 100,
    overtimeMultiplier:  parseFloat(s.overtime_multiplier   ?? "1.5"),
    workingDaysPerMonth: parseInt  (s.working_days_per_month ?? "22"),
    taxExemptThreshold:  parseFloat(s.tax_exempt_threshold  ?? "500"),
    weekendDays:         (s.weekend_days ?? "5,6").split(",").map(Number),
  };
}

export async function getBudgetSettings(orgId: string) {
  const s = await getCategorySettings(orgId, "budget");
  return {
    warningThreshold:   parseInt(s.warning_threshold    ?? "80"),
    criticalThreshold:  parseInt(s.critical_threshold   ?? "95"),
    blockThreshold:     parseInt(s.block_threshold      ?? "100"),
    notifyCooldownHrs:  parseInt(s.notify_cooldown_hours ?? "24"),
  };
}

export async function getProcurementSettings(orgId: string) {
  const s = await getCategorySettings(orgId, "procurement");
  return {
    matchingTolerancePct: parseFloat(s.matching_tolerance_pct ?? "2"),
    emergencyReviewDays:  parseInt  (s.emergency_review_days  ?? "30"),
    approvalSlaHours:     parseInt  (s.approval_sla_hours     ?? "48"),
    rfqMinVendors:        parseInt  (s.rfq_min_vendors        ?? "3"),
  };
}

export async function getAssetSettings(orgId: string) {
  const s = await getCategorySettings(orgId, "assets");
  return {
    defaultMethod:           s.default_depreciation_method   ?? "straight_line",
    itDepreciationRate:      parseFloat(s.it_depreciation_rate       ?? "20") / 100,
    vehicleDepreciationRate: parseFloat(s.vehicle_depreciation_rate  ?? "15") / 100,
    furnitureDepreciationRate:parseFloat(s.furniture_depreciation_rate ?? "10") / 100,
  };
}

export async function getHRSettings(orgId: string) {
  const s = await getCategorySettings(orgId, "hr");
  return {
    annualLeaveDays:  parseInt(s.annual_leave_days ?? "21"),
    sickLeaveDays:    parseInt(s.sick_leave_days   ?? "14"),
    probationMonths:  parseInt(s.probation_months  ?? "3"),
  };
}
