-- 017_grant_beneficiaries_target.sql
-- هدف المستفيدين المخطَّط لكل منحة — كان تقرير المانح (UNHCR IPR) يستخدم
-- قيمة ثابتة (|| 100) بدل هدف حقيقي مخزَّن، ما يُشوّه نسبة الإنجاز.
ALTER TABLE grants ADD COLUMN IF NOT EXISTS beneficiaries_target integer;
