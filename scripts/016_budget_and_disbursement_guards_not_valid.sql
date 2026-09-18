-- ═══════════════════════════════════════════════════════════════
-- بديل آمن لـ migration 016 على بيئة إنتاج فيها بيانات قديمة
-- ═══════════════════════════════════════════════════════════════
-- استخدم هذا الملف بدل src/db/migrations/016_budget_and_disbursement_guards.sql
-- فقط إذا كشف scripts/pre-migration-016-diagnostics.ts وجود صفوف مخالفة
-- لم يمكن تصحيحها كاملة قبل النشر. لو كان الفحص التشخيصي نظيفاً (صفر
-- مخالفات)، لا داعي لهذا الملف — نفّذ 016 الأصلية مباشرة.
--
-- الفرق الجوهري:
-- ── ADD CONSTRAINT ... CHECK (...) العادية ────────────────────────
--   • تفحص كل صف موجود فوراً وقت التنفيذ.
--   • تأخذ قفل ACCESS EXCLUSIVE على الجدول طوال مدة الفحص — يمنع
--     القراءة والكتابة تماماً على جدول قد يكون كبيراً بالإنتاج.
--   • تفشل بالكامل (ROLLBACK) لو وُجد صف واحد مخالف.
-- ── ADD CONSTRAINT ... CHECK (...) NOT VALID ──────────────────────
--   • لا تفحص أي صف موجود — تنجح فوراً بغض النظر عن البيانات القديمة.
--   • قفل خفيف جداً (لا يحتاج مسح الجدول)، يُنفَّذ خلال أجزاء من الثانية
--     حتى على جدول ضخم.
--   • تبدأ إنفاذ القيد على أي INSERT/UPDATE جديد فوراً بعد هذا الأمر —
--     الحماية المستقبلية مفعّلة من هذه اللحظة رغم أن القيد "غير مُتحقَّق"
--     بعد بالمعنى الرسمي لبيانات الماضي.
-- ── VALIDATE CONSTRAINT (خطوة لاحقة منفصلة) ───────────────────────
--   • تفحص الصفوف القديمة فقط (الجديدة مفحوصة أصلاً من NOT VALID).
--   • قفل SHARE UPDATE EXCLUSIVE فقط — يسمح بالقراءة والكتابة العادية
--     أثناء الفحص (يمنع فقط عمليات DDL أخرى متزامنة على نفس الجدول).
--   • يمكن تشغيلها بأي وقت لاحق مناسب (خارج أوقات الذروة مثلاً)، بمعزل
--     تام عن نشر الكود نفسه.
--   • لو فشلت (وُجدت مخالفة)، القيد يبقى NOT VALID (لا يُسقَط تلقائياً)—
--     يحتاج تصحيح الصف المخالف ثم إعادة تشغيل VALIDATE فقط، لا الإضافة كاملة.
--
-- ─── الخطوة 1: أضف كل القيود بصيغة NOT VALID (نفّذها بالنشر) ──────────
ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_commit_within_planned"
  CHECK ("committed_amount" + "spent_amount" <= "planned_amount") NOT VALID;--> statement-breakpoint

ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_committed_non_negative"
  CHECK ("committed_amount" >= 0) NOT VALID;--> statement-breakpoint

ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_spent_non_negative"
  CHECK ("spent_amount" >= 0) NOT VALID;--> statement-breakpoint

ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_within_total"
  CHECK ("disbursed_amount" <= "total_amount") NOT VALID;--> statement-breakpoint

ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_non_negative"
  CHECK ("disbursed_amount" >= 0) NOT VALID;--> statement-breakpoint

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_within_ordered"
  CHECK ("received_qty" IS NULL OR "received_qty" <= "quantity") NOT VALID;--> statement-breakpoint

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_non_negative"
  CHECK ("received_qty" IS NULL OR "received_qty" >= 0) NOT VALID;--> statement-breakpoint

-- ─── الخطوة 2: تحقق لاحقاً (نفّذها يدوياً بعد تصحيح البيانات القديمة) ──
-- شغّل كل سطر منفرداً (ليس ضمن معاملة/transaction واحدة مع غيره) بعد
-- تصحيح الصفوف المخالفة التي أظهرها scripts/pre-migration-016-diagnostics.ts:
--
-- ALTER TABLE "grant_budget_lines" VALIDATE CONSTRAINT "grant_budget_lines_commit_within_planned";
-- ALTER TABLE "grant_budget_lines" VALIDATE CONSTRAINT "grant_budget_lines_committed_non_negative";
-- ALTER TABLE "grant_budget_lines" VALIDATE CONSTRAINT "grant_budget_lines_spent_non_negative";
-- ALTER TABLE "sub_grants" VALIDATE CONSTRAINT "sub_grants_disbursed_within_total";
-- ALTER TABLE "sub_grants" VALIDATE CONSTRAINT "sub_grants_disbursed_non_negative";
-- ALTER TABLE "purchase_order_items" VALIDATE CONSTRAINT "purchase_order_items_received_within_ordered";
-- ALTER TABLE "purchase_order_items" VALIDATE CONSTRAINT "purchase_order_items_received_non_negative";
--
-- ملاحظة: أعد تشغيل scripts/pre-migration-016-diagnostics.ts قبل كل
-- VALIDATE للتأكد من صفر مخالفات على ذلك الجدول تحديداً، بدل التخمين.
