import {
  pgTable,text,boolean,uuid,integer,decimal,index,pgEnum,timestamp
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, currencies, users } from "./shared";

export const vendorStatusEnum = pgEnum("vendor_status",[
  "pending","approved","preferred","restricted","blacklisted",
]);

export const vendors = pgTable("vendors",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  name:            text("name").notNull(),
  nameAr:          text("name_ar"),
  code:            text("code").notNull(),
  vendorStatus:    vendorStatusEnum("vendor_status").default("pending").notNull(),
  vendorType:      text("vendor_type").notNull(), // supplier|contractor|consultant|individual
  taxNumber:       text("tax_number"),
  registrationNo:  text("registration_no"),
  country:         text("country"),
  city:            text("city"),
  address:         text("address"),
  phone:           text("phone"),
  email:           text("email"),
  website:         text("website"),
  preferredCurrencyId: uuid("preferred_currency_id").references(()=>currencies.id),
  paymentTermsDays:    integer("payment_terms_days").default(30),
  // Scorecard
  overallScore:    decimal("overall_score",{precision:5,scale:2}).default("0"),
  totalOrders:     integer("total_orders").default(0),
  onTimeDelivery:  decimal("on_time_delivery",{precision:5,scale:2}).default("0"),
  qualityScore:    decimal("quality_score",{precision:5,scale:2}).default("0"),
  isActive:        boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("vendors_org_idx").on(t.organizationId) }));

export const vendorContacts = pgTable("vendor_contacts",{
  ...baseColumns,
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  name:           text("name").notNull(),
  title:          text("title"),
  email:          text("email"),
  phone:          text("phone"),
  isPrimary:      boolean("is_primary").default(false).notNull(),
});

export const vendorCategories = pgTable("vendor_categories",{
  ...baseColumns,
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  category:       text("category").notNull(), // IT|Construction|Supplies|Consulting|etc
});

export const tenders = pgTable("tenders",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").unique().notNull(),
  title:          text("title").notNull(),
  titleAr:        text("title_ar"),
  description:    text("description"),
  category:       text("category").notNull(),
  estimatedValue: decimal("estimated_value",{precision:18,scale:2}),
  currencyId:     uuid("currency_id").references(()=>currencies.id),
  submissionDeadline: text("submission_deadline").notNull(),
  openingDate:        text("opening_date"),
  awardedVendorId:    uuid("awarded_vendor_id").references(()=>vendors.id),
  awardedAmount:      decimal("awarded_amount",{precision:18,scale:2}),
});

export const tenderBids = pgTable("tender_bids",{
  ...baseColumns,
  tenderId:       uuid("tender_id").references(()=>tenders.id).notNull(),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  bidAmount:      decimal("bid_amount",{precision:18,scale:2}).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  technicalScore: decimal("technical_score",{precision:5,scale:2}),
  financialScore: decimal("financial_score",{precision:5,scale:2}),
  totalScore:     decimal("total_score",{precision:5,scale:2}),
  isSealed:       boolean("is_sealed").default(true).notNull(),
  sealedData:     text("sealed_data"), // encrypted until opening
  isAwarded:      boolean("is_awarded").default(false).notNull(),
});

// ══════════════════════════════════════════════════════
// تقييم الموردين (Vendor Scorecard) — طبقة 1
// ══════════════════════════════════════════════════════
export const vendorRatings = pgTable("vendor_ratings",{
  ...baseColumns,
  organizationId:   uuid("organization_id").references(()=>organizations.id).notNull(),
  vendorId:         uuid("vendor_id").references(()=>vendors.id).notNull(),
  // مرجع التقييم: GRN أو PO أو مستقل
  relatedPoId:      uuid("related_po_id"),
  relatedGrnId:     uuid("related_grn_id"),
  ratedBy:          uuid("rated_by").references(()=>users.id).notNull(),
  // المحاور الثلاثة (0-5)
  qualityScore:     decimal("quality_score",{precision:3,scale:1}).notNull(),     // جودة البضائع/الخدمات
  deliveryScore:    decimal("delivery_score",{precision:3,scale:1}).notNull(),    // الالتزام بوقت التسليم
  complianceScore:  decimal("compliance_score",{precision:3,scale:1}).notNull(), // الامتثال للشروط
  // المعدل المحسوب: (جودة×40% + توصيل×35% + امتثال×25%)
  weightedAverage:  decimal("weighted_average",{precision:4,scale:2}).notNull(),
  comments:         text("comments"),
  ratingDate:       timestamp("rating_date",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  vendorIdx: index("vr_vendor_idx").on(t.vendorId, t.organizationId),
}));

// ══════════════════════════════════════════════════════
// تقييم عروض المناقصات (Bid Evaluation Committee) — طبقة 1
// ══════════════════════════════════════════════════════
export const bidEvaluationCriteria = pgTable("bid_evaluation_criteria",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  tenderId:       uuid("tender_id").references(()=>tenders.id).notNull(),
  criteriaName:   text("criteria_name").notNull(),   // "السعر" | "المواصفات" | "وقت التسليم"
  criteriaNameAr: text("criteria_name_ar"),
  weight:         integer("weight").notNull(),         // النسبة % (مجموعها يجب = 100)
  maxScore:       integer("max_score").default(10),   // الدرجة القصوى
  sortOrder:      integer("sort_order").default(1),
},(t)=>({ tenderIdx: index("bec_tender_idx").on(t.tenderId) }));

export const bidEvaluations = pgTable("bid_evaluations",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  tenderId:       uuid("tender_id").references(()=>tenders.id).notNull(),
  bidId:          uuid("bid_id").references(()=>tenderBids.id).notNull(),
  criteriaId:     uuid("criteria_id").references(()=>bidEvaluationCriteria.id).notNull(),
  evaluatorId:    uuid("evaluator_id").references(()=>users.id).notNull(),
  score:          decimal("score",{precision:5,scale:2}).notNull(),        // الدرجة التي منحها المقيّم
  weightedScore:  decimal("weighted_score",{precision:6,scale:3}).notNull(),// score × weight/100
  justification:  text("justification"),
  evaluatedAt:    timestamp("evaluated_at",{withTimezone:true}).default(sql`now()`).notNull(),
  isLocked:       boolean("is_locked").default(false).notNull(),            // مقفل بعد الإرسال
},(t)=>({
  bidEvalIdx:  index("be_bid_idx").on(t.bidId, t.criteriaId),
  evalUserIdx: index("be_evaluator_idx").on(t.evaluatorId, t.tenderId),
}));
