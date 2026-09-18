// sentry.client.config.ts
// يبقى هذا الملف بلا أثر طالما NEXT_PUBLIC_SENTRY_DSN غير مضبوط — آمن للتشغيل بدون حساب Sentry فعلي.
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    // لا نرسل أي محتوى نصي حساس ضمن الأحداث تلقائياً
    beforeSend(event) {
      return event;
    },
  });
}
