/**
 * ═══════════════════════════════════════════════════════════════
 * مهمة دورية: التحقق من سلامة سلسلة سجل التدقيق (كل المنظمات)
 * ═══════════════════════════════════════════════════════════════
 * التشغيل اليدوي:
 *   npx tsx --env-file=.env.production scripts/verify-audit-integrity.ts
 *
 * التشغيل الدوري: راجع قسم "مهمة التحقق الدوري" بدليل النشر —
 * الخيارات المدعومة: Render Cron Job (render.yaml)، GitHub Actions
 * scheduled workflow، أو أي crontab عادي على خادم يصل لنفس DATABASE_URL.
 * مقترَح: أسبوعياً (نفس ما طُلب) — الفحص O(n) على كامل سجل كل منظمة،
 * فتشغيله بتردد أعلى بكثير على منظمة بسجل تدقيق ضخم قد يكون مكلفاً.
 *
 * كود الخروج (exit code):
 *   0  — كل المنظمات سليمة
 *   1  — وُجد كسر بسلسلة تدقيق منظمة واحدة أو أكثر (تنبيهات أُرسلت فعلاً
 *        من runScheduledAuditIntegrityCheck نفسها قبل وصول الكود لهذا السطر)
 *   2  — خطأ تشغيلي بالسكريبت نفسه (لا علاقة بسلامة البيانات) — مثلاً فشل
 *        الاتصال بقاعدة البيانات
 * كود الخروج غير الصفري مفيد لو رُبط هذا السكريبت بخدمة مراقبة cron خارجية
 * (Healthchecks.io ونحوها) تُنبّه لو فشلت المهمة نفسها، بمعزل عن تنبيهات
 * البريد الإلكتروني الداخلية.
 */
import { runScheduledAuditIntegrityCheck } from "@/core/audit/scheduled-check";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL غير مُعرَّف");
    process.exit(2);
  }

  console.log("🔍 بدء التحقق الدوري من سلامة سجل التدقيق...\n");

  const summary = await runScheduledAuditIntegrityCheck();

  console.log(`فُحصت ${summary.totalOrganizations} منظمة نشطة بتاريخ ${summary.checkedAt.toISOString()}\n`);

  for (const r of summary.results) {
    if (r.valid) {
      console.log(`✅ ${r.organizationName} — سليمة`);
    } else {
      console.log(`🔴 ${r.organizationName} — كسر عند السجل ${r.brokenAtRecordId}: ${r.reason}`);
    }
  }

  console.log("\n" + "═".repeat(60));

  if (summary.brokenCount === 0) {
    console.log("✅ كل سلاسل التدقيق سليمة.");
    process.exit(0);
  }

  console.log(`🔴 ${summary.brokenCount} منظمة بسلسلة تدقيق مكسورة — تنبيهات أُرسلت لمسؤولي كل منظمة، وللبريد الأمني (SECURITY_ALERT_EMAIL) إن كان مُعرَّفاً.`);
  process.exit(1);
}

main().catch((e) => {
  console.error("❌ خطأ غير متوقع أثناء الفحص الدوري:", e instanceof Error ? e.message : String(e));
  process.exit(2);
});
