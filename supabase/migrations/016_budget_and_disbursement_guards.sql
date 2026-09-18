-- v35 — قيود CHECK لسد الفجوة المتبقية من إصلاحات Race Condition بمستوى
-- التطبيق (grants/procurement/partners actions.ts). نفس المبدأ المطبَّق
-- بmigration 013 على المخزون والقيود المحاسبية: الكود صار يستخدم UPDATE
-- ذرّي بشرط SQL بدل check-then-act، لكن هذا القيد يبقى خط الدفاع الأخير
-- على مستوى القاعدة نفسها — يحمي من أي مسار كتابة مستقبلي (migration
-- script, seed, أداة إدارية مباشرة، أو خطأ برمجي لاحق) يتجاوز طبقة
-- التطبيق بالكامل.
--
-- ⚠️ ملاحظة تشغيلية مهمة قبل التطبيق على قاعدة بيانات فعلية بها بيانات:
-- ALTER TABLE ... ADD CONSTRAINT ... CHECK (بدون NOT VALID) يفحص كل صف
-- موجود فعلياً وقت التنفيذ ويفشل لو وُجد صف واحد مخالف. بما أن هذه الجولة
-- وثّقت أن الثغرات (budget ceiling race، GRN over-receipt، disbursement
-- race) كانت موجودة فعلياً بالتطبيق سابقاً، لو كانت هذه القاعدة استُخدمت
-- إنتاجياً *قبل* إصلاحات actions.ts فقد توجد بيانات تاريخية مخالفة فعلاً.
-- لم يُشغَّل هذا الـmigration بعد ضد أي قاعدة حقيقية (نفس القيد الموثّق
-- بـ013/014/015 — بيئة الحماية لا تصل postgres). قبل التنفيذ الفعلي على
-- أي بيئة فيها بيانات:
--   1) شغّل الاستعلامات التشخيصية بأسفل هذا الملف (معلَّقة) للتأكد من
--      عدم وجود صفوف مخالفة حالياً.
--   2) لو وُجدت صفوف مخالفة، صحّحها يدوياً أولاً أو استخدم NOT VALID ثم
--      VALIDATE CONSTRAINT لاحقاً بعد التصحيح التدريجي.

-- ─── 1) بنود ميزانية المنح: لا يجوز أن يتجاوز (الملتزم + المصروف) المخطَّط ──
-- يحمي من نفس ثغرة "Race Condition بخصم/التزام الميزانية" (checkBudgetCeiling
-- + committedAmount بprocurement، وspentAmount بhr) حتى لو تجاوزها كود
-- مستقبلي لا يستخدم commitBudgetAmountAtomic.
ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_commit_within_planned"
  CHECK ("committed_amount" + "spent_amount" <= "planned_amount");--> statement-breakpoint

ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_committed_non_negative"
  CHECK ("committed_amount" >= 0);--> statement-breakpoint

ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_spent_non_negative"
  CHECK ("spent_amount" >= 0);--> statement-breakpoint

-- ─── 2) المنح الفرعية للشركاء: لا يجوز أن يتجاوز المصروف الإجمالي المُلتزَم ──
-- يحمي من ثغرة "Race Condition بصرف المنح الفرعية" (createDisbursement
-- بpartners/actions.ts) حتى لو تجاوزها كود مستقبلي.
ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_within_total"
  CHECK ("disbursed_amount" <= "total_amount");--> statement-breakpoint

ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_non_negative"
  CHECK ("disbursed_amount" >= 0);--> statement-breakpoint

-- ─── 3) بنود أوامر الشراء: لا يجوز استلام كمية أكبر من المطلوبة ──
-- يحمي من ثغرة "Race Condition باستلام البضاعة" (createGoodsReceiptNote
-- بprocurement/actions.ts). received_qty قد تكون NULL (لم يُستلَم شيء بعد)
-- لذا الشرط يسمح بـNULL صراحة.
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_within_ordered"
  CHECK ("received_qty" IS NULL OR "received_qty" <= "quantity");--> statement-breakpoint

ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_non_negative"
  CHECK ("received_qty" IS NULL OR "received_qty" >= 0);--> statement-breakpoint

-- ─── استعلامات تشخيصية (معلَّقة عمداً — شغّلها يدوياً قبل التفعيل على بيئة حقيقية) ──
-- SELECT id, planned_amount, committed_amount, spent_amount FROM grant_budget_lines
--   WHERE committed_amount + spent_amount > planned_amount OR committed_amount < 0 OR spent_amount < 0;
-- SELECT id, total_amount, disbursed_amount FROM sub_grants
--   WHERE disbursed_amount > total_amount OR disbursed_amount < 0;
-- SELECT id, quantity, received_qty FROM purchase_order_items
--   WHERE received_qty > quantity OR received_qty < 0;
