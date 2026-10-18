"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppLocale, ThemePreference } from "@/lib/preferences";

type Props = {
  locale: AppLocale;
  theme: ThemePreference;
};

const COPY = {
  ar: {
    language: "اللغة",
    theme: "المظهر",
    dark: "ليلي",
    light: "نهاري",
    system: "تلقائي",
  },
  en: {
    language: "Language",
    theme: "Theme",
    dark: "Dark",
    light: "Light",
    system: "System",
  },
} as const;

export default function HeaderPreferences({ locale, theme }: Props) {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState<AppLocale>(locale);
  const [currentTheme, setCurrentTheme] = useState<ThemePreference>(theme);
  const t = COPY[currentLocale];

  const themeItems = useMemo(
    () => [
      { key: "dark" as const, label: t.dark, icon: "ti-moon-stars" },
      { key: "light" as const, label: t.light, icon: "ti-sun-high" },
      { key: "system" as const, label: t.system, icon: "ti-device-desktop" },
    ],
    [t.dark, t.light, t.system]
  );

  function setCookie(name: string, value: string) {
    document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
  }

  function applyTheme(nextTheme: ThemePreference) {
    const resolved =
      nextTheme === "system"
        ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
        : nextTheme;

    document.documentElement.dataset.theme = resolved;
    setCookie("erp-theme", nextTheme);
    localStorage.setItem("erp-theme", nextTheme);
    setCurrentTheme(nextTheme);
  }

  function applyLocale(nextLocale: AppLocale) {
    const nextDir = nextLocale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextDir;
    setCookie("erp-locale", nextLocale);
    localStorage.setItem("erp-locale", nextLocale);
    setCurrentLocale(nextLocale);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-xl border border-[#1F2937] bg-[#161B26] p-1">
        <span className="px-2 text-[11px] text-[#4B5563]">{t.language}</span>
        {(["ar", "en"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => applyLocale(lang)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              currentLocale === lang
                ? "bg-[#0F6E56] text-white"
                : "text-[#9CA3AF] hover:bg-[#0F1117] hover:text-white"
            }`}
            title={lang === "ar" ? "العربية" : "English"}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-[#1F2937] bg-[#161B26] p-1">
        <span className="px-2 text-[11px] text-[#4B5563]">{t.theme}</span>
        {themeItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => applyTheme(item.key)}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all ${
              currentTheme === item.key
                ? "bg-[#0F6E56] text-white"
                : "text-[#9CA3AF] hover:bg-[#0F1117] hover:text-white"
            }`}
            title={item.label}
          >
            <i className={`ti ${item.icon} text-[13px]`} />
            <span className="hidden xl:inline">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
