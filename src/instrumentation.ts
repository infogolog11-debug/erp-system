// src/instrumentation.ts
// يُستدعى تلقائياً من Next.js عند بدء تشغيل الخادم (App Router)
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}
