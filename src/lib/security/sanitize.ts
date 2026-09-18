import { z } from "zod";

// ════════════════════════════════════════════════════════════
// تنظيف حقول النص الحر — يمنع XSS مخزَّن (Stored XSS)
// ════════════════════════════════════════════════════════════
// المشروع لم يكن يملك أداة تنظيف موحّدة، وكل حقول النص الحر
// (اسم مستفيد، وصف حالة، ملاحظات شكوى...) كانت تُقبَل كنص خام
// بدون إزالة وسوم HTML — ثغرة مطابقة لما وُجد بمشروع Ten-Ven Nexus.
//
// يُستخدم بدل z.string() العادية لأي حقل نص حرّ يُدخله مستخدم
// ويُعرَض لاحقاً لمستخدمين آخرين (عناوين، أوصاف، ملاحظات، أسماء).

export function textField(maxLen = 500, minLen = 0) {
  return z.string()
    .min(minLen)
    .max(maxLen)
    .transform((s) => s.trim().replace(/<[^>]*>/g, ""));
}

// نسخة اختيارية (optional) — لحقول النص الحر غير الإلزامية
export function optionalTextField(maxLen = 500) {
  return textField(maxLen).optional();
}

// تنظيف مباشر لنص جاهز (خارج سياق مخطط zod)، مثلاً قبل الإدراج اليدوي
export function sanitizeText(input: string): string {
  return input.trim().replace(/<[^>]*>/g, "");
}
