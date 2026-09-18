import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations,currencies,fiscalPeriods } from "./shared";
import { grants } from "./grants";

export const accountTypeEnum = pgEnum("account_type",[
  "asset","liability","equity","revenue","expense",
]);

export const accounts = pgTable("accounts",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  accountType:    accountTypeEnum("account_type").notNull(),
  parentId:       uuid("parent_id"),
  isControl:      boolean("is_control").default(false), // حساب مجمع
  currencyId:     uuid("currency_id").references(()=>currencies.id),
  currentBalance: decimal("current_balance",{precision:18,scale:2}).default("0").notNull(),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({
  orgCodeIdx: index("acc_org_code_idx").on(t.organizationId,t.code),
}));

export const journalEntries = pgTable("journal_entries",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  fiscalPeriodId: uuid("fiscal_period_id").references(()=>fiscalPeriods.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id),
  code:           text("code").unique().notNull(),
  entryDate:      timestamp("entry_date",{withTimezone:true}).default(sql`now()`).notNull(),
  description:    text("description").notNull(),
  reference:      text("reference"),
  entryType:      text("entry_type").notNull(),
  // manual | procurement | payroll | depreciation | payment
  totalDebit:     decimal("total_debit",{precision:18,scale:2}).notNull(),
  totalCredit:    decimal("total_credit",{precision:18,scale:2}).notNull(),
  isPosted:       boolean("is_posted").default(false).notNull(),
  postedAt:       timestamp("posted_at",{withTimezone:true}),
  postedBy:       uuid("posted_by"),
  isReversed:     boolean("is_reversed").default(false).notNull(),
  reversalEntryId: uuid("reversal_entry_id"),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  exchangeRate:   decimal("exchange_rate",{precision:18,scale:6}).default("1"),
},(t)=>({
  orgIdx:    index("je_org_idx").on(t.organizationId),
  periodIdx: index("je_period_idx").on(t.fiscalPeriodId),
  dateIdx:   index("je_date_idx").on(t.entryDate),
}));

export const journalLines = pgTable("journal_lines",{
  ...baseColumns,
  journalEntryId: uuid("journal_entry_id").references(()=>journalEntries.id).notNull(),
  accountId:      uuid("account_id").references(()=>accounts.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id),
  description:    text("description"),
  debitAmount:    decimal("debit_amount",{precision:18,scale:2}).default("0").notNull(),
  creditAmount:   decimal("credit_amount",{precision:18,scale:2}).default("0").notNull(),
  lineOrder:      integer("line_order").notNull(),
},(t)=>({
  entryIdx:   index("jl_entry_idx").on(t.journalEntryId),
  accountIdx: index("jl_account_idx").on(t.accountId),
}));

// ═══════════════════════════════════════════════════════════════
// Fund Accounting — Multi-Currency Real-Time (خسارة/ربح صرف)
// ═══════════════════════════════════════════════════════════════

// سجل تاريخي يومي لسعر الصرف — يُستخدم لحساب فروقات القطع
// بدلاً من الاعتماد على سعر واحد ثابت في جدول currencies
export const exchangeRateHistory = pgTable("exchange_rate_history",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  rateDate:       timestamp("rate_date",{withTimezone:true}).notNull(),
  rateToBase:     decimal("rate_to_base",{precision:18,scale:6}).notNull(),
  source:         text("source").default("manual").notNull(), // manual | api | central_bank
},(t)=>({
  currDateIdx: index("fx_hist_curr_date_idx").on(t.currencyId,t.rateDate),
  orgIdx:      index("fx_hist_org_idx").on(t.organizationId),
}));

// فروقات القطع — تُنشأ عند إعادة تقييم أرصدة المنح/الحسابات
// بعملة أجنبية عند تغيّر سعر الصرف (محقّقة عند التسوية، غير محقّقة عند إعادة التقييم الدوري)
export const fxRevaluationTypeEnum = pgEnum("fx_revaluation_type",[
  "realized","unrealized",
]);

export const fxRevaluations = pgTable("fx_revaluations",{
  ...baseColumns,
  organizationId:   uuid("organization_id").references(()=>organizations.id).notNull(),
  grantId:          uuid("grant_id").references(()=>grants.id),
  accountId:        uuid("account_id").references(()=>accounts.id),
  currencyId:       uuid("currency_id").references(()=>currencies.id).notNull(),
  revaluationDate:  timestamp("revaluation_date",{withTimezone:true}).notNull(),
  revaluationType:  fxRevaluationTypeEnum("revaluation_type").notNull(),
  baseCurrencyAmount:  decimal("base_currency_amount",{precision:18,scale:2}).notNull(),
  originalRate:        decimal("original_rate",{precision:18,scale:6}).notNull(),
  currentRate:         decimal("current_rate",{precision:18,scale:6}).notNull(),
  gainLossAmount:      decimal("gain_loss_amount",{precision:18,scale:2}).notNull(),
  journalEntryId:      uuid("journal_entry_id").references(()=>journalEntries.id),
},(t)=>({
  orgIdx:   index("fx_reval_org_idx").on(t.organizationId),
  grantIdx: index("fx_reval_grant_idx").on(t.grantId),
}));
