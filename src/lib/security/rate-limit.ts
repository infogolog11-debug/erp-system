// src/lib/security/rate-limit.ts
// Rate limiting بسيط بالذاكرة — كافٍ لنشر instance واحد.
// عند التوسع لأكثر من instance، استبدله بـ Upstash Redis أو مشابه.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// تنظيف دوري لمنع تسرب الذاكرة
setInterval(() => {
  const now = Date.now();
  for (const [key, b] of buckets) if (b.resetAt < now) buckets.delete(key);
}, 60_000).unref?.();

/**
 * يتحقق من حد الطلبات لمفتاح معيّن (عادة IP أو IP+route).
 * @returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  { limit = 20, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** يستخرج عنوان IP الحقيقي من الطلب (يدعم بيئات proxy مثل Vercel/Render) */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
