import { cookies } from "next/headers";

export type AppLocale = "ar" | "en";
export type ThemePreference = "dark" | "light" | "system";

export interface AppPreferences {
  locale: AppLocale;
  direction: "rtl" | "ltr";
  theme: ThemePreference;
}

const DEFAULT_LOCALE: AppLocale = "ar";
const DEFAULT_THEME: ThemePreference = "dark";

export function parseLocale(value?: string | null): AppLocale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}

export function parseThemePreference(value?: string | null): ThemePreference {
  return value === "light" || value === "system" ? value : DEFAULT_THEME;
}

export async function getRequestPreferences(): Promise<AppPreferences> {
  const store = await cookies();
  const locale = parseLocale(store.get("erp-locale")?.value);

  return {
    locale,
    direction: locale === "ar" ? "rtl" : "ltr",
    theme: parseThemePreference(store.get("erp-theme")?.value),
  };
}
