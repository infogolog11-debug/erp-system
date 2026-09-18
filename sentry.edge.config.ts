// sentry.edge.config.ts
// يبقى هذا الملف بلا أثر طالما SENTRY_DSN غير مضبوط.
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}
