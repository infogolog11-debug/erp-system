import type { Metadata } from "next";
import "./globals.css";
import { getRequestPreferences } from "@/lib/preferences";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "ERP System",
  description: "نظام إدارة مؤسساتي متكامل",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = getRequestPreferences();

  return (
    <html
      lang={prefs.locale}
      dir={prefs.direction}
      data-theme={prefs.theme === "system" ? "dark" : prefs.theme}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="theme-color" content="#0F6E56" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var storedTheme = localStorage.getItem("erp-theme");
                  var storedLocale = localStorage.getItem("erp-locale");
                  var theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system"
                    ? storedTheme
                    : "${prefs.theme}";
                  var locale = storedLocale === "en" || storedLocale === "ar"
                    ? storedLocale
                    : "${prefs.locale}";
                  var resolvedTheme = theme === "system"
                    ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
                    : theme;

                  document.documentElement.dataset.theme = resolvedTheme;
                  document.documentElement.lang = locale;
                  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
