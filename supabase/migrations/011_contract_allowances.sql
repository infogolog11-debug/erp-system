-- إصلاح: بدلات السكن/المواصلات كانت تُقرأ من كتالوج مستوى-المنظمة فقط
-- (نفس القيمة لكل الموظفين). هذا العمود يسمح بتخصيص قيمة لكل عقد؛
-- NULL = استخدم القيمة الافتراضية من كتالوج salary_components (سلوك قديم، متوافق رجعياً)
-- قيمة رقمية = تتجاوز الكتالوج لهذا الموظف تحديداً
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "housing_allowance" decimal(18,2);--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "transport_allowance" decimal(18,2);
