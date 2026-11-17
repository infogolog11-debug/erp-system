-- 018_tender_types.sql
-- أنواع المناقصات المتعددة — كان جدول tenders بلا حقل نوع، فكل المناقصات
-- تُعامَل كمناقصة عامة واحدة بلا تمييز بين العام/المحدود/طلب عرض سعر/
-- الاتفاقية الإطارية/الشراء المباشر... إلخ.
-- القيم المسموحة: open|limited|itb|framework|rfq|rfp|direct|reverse_auction
ALTER TABLE tenders ADD COLUMN IF NOT EXISTS tender_type text NOT NULL DEFAULT 'open';

COMMENT ON COLUMN tenders.tender_type IS
  'open|limited|itb|framework|rfq|rfp|direct|reverse_auction (راجع TENDER_TYPES في src/lib/i18n.ts)';
