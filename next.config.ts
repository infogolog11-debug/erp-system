// next.config.ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // تحسينات الأداء للإنتاج
  compress: true,
  poweredByHeader: false,

  // تحسين الصور
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },

  // Headers الأمان
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",           value: "DENY"            },
          { key: "X-Content-Type-Options",     value: "nosniff"         },
          { key: "Referrer-Policy",            value: "strict-origin"   },
          { key: "Permissions-Policy",         value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },

  // متغيرات عامة (لا تضع secrets هنا)
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "ERP System",
  },
};

// withSentryConfig آمن تماماً بدون حساب Sentry فعلي — بدون SENTRY_ORG/SENTRY_PROJECT
// لن يرفع أي source maps، وبدون SENTRY_DSN لن تُرسَل أي أحداث إطلاقاً (راجع sentry.*.config.ts)
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  disableLogger: true,
});

