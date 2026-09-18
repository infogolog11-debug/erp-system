import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, users, currencies } from "./shared";
import { grants } from "./grants";

export const partnerTypeEnum = pgEnum("partner_type", [
  "local_ngo","international_ngo","government","community_based","private_sector","un_agency",
]);
export const dueDiligenceStatusEnum = pgEnum("due_diligence_status", [
  "pending","cleared","flagged","rejected",
]);

export const partners = pgTable("partners",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").unique().notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  partnerType:    partnerTypeEnum("partner_type").notNull(),
  country:        text("country"),
  registrationNumber: text("registration_number"),
  contactPerson:  text("contact_person"),
  email:          text("email"),
  phone:          text("phone"),
  capacityAssessmentScore: integer("capacity_assessment_score"),
  capacityAssessmentDate:  timestamp("capacity_assessment_date",{withTimezone:true}),
  dueDiligenceStatus: dueDiligenceStatusEnum("due_diligence_status").default("pending").notNull(),
  dueDiligenceNotes:  text("due_diligence_notes"),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("partner_org_idx").on(t.organizationId) }));

export const subGrantStatusEnum = pgEnum("sub_grant_status", [
  "draft","active","completed","terminated","suspended",
]);

export const subGrants = pgTable("sub_grants",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  parentGrantId:  uuid("parent_grant_id").references(()=>grants.id).notNull(),
  partnerId:      uuid("partner_id").references(()=>partners.id).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  code:           text("code").unique().notNull(),
  title:          text("title").notNull(),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  disbursedAmount: decimal("disbursed_amount",{precision:18,scale:2}).default("0").notNull(),
  reportedSpentAmount: decimal("reported_spent_amount",{precision:18,scale:2}).default("0").notNull(),
  startDate:      timestamp("start_date",{withTimezone:true}).notNull(),
  endDate:        timestamp("end_date",{withTimezone:true}).notNull(),
  agreementSignedDate: timestamp("agreement_signed_date",{withTimezone:true}),
  subGrantStatus: subGrantStatusEnum("sub_grant_status").default("draft").notNull(),
  description:    text("description"),
},(t)=>({
  orgIdx:     index("subgrant_org_idx").on(t.organizationId),
  parentIdx:  index("subgrant_parent_idx").on(t.parentGrantId),
  partnerIdx: index("subgrant_partner_idx").on(t.partnerId),
}));

export const disbursementStatusEnum = pgEnum("disbursement_status", ["pending","completed","cancelled"]);

export const subGrantDisbursements = pgTable("sub_grant_disbursements",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  subGrantId:     uuid("sub_grant_id").references(()=>subGrants.id).notNull(),
  amount:         decimal("amount",{precision:18,scale:2}).notNull(),
  disbursementDate: timestamp("disbursement_date",{withTimezone:true}).default(sql`now()`).notNull(),
  method:         text("method"),
  referenceNumber: text("reference_number"),
  disbursementStatus: disbursementStatusEnum("disbursement_status").default("pending").notNull(),
  approvedBy:     uuid("approved_by").references(()=>users.id),
},(t)=>({ subGrantIdx: index("disb_subgrant_idx").on(t.subGrantId) }));

export const reportReviewStatusEnum = pgEnum("report_review_status", ["pending","approved","needs_revision"]);

export const partnerReports = pgTable("partner_reports",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  subGrantId:     uuid("sub_grant_id").references(()=>subGrants.id).notNull(),
  periodStart:    timestamp("period_start",{withTimezone:true}).notNull(),
  periodEnd:      timestamp("period_end",{withTimezone:true}).notNull(),
  narrativeReport: text("narrative_report"),
  financialReportAmount: decimal("financial_report_amount",{precision:18,scale:2}),
  submittedDate:  timestamp("submitted_date",{withTimezone:true}).default(sql`now()`).notNull(),
  reviewStatus:   reportReviewStatusEnum("review_status").default("pending").notNull(),
  reviewedBy:     uuid("reviewed_by").references(()=>users.id),
  reviewedAt:     timestamp("reviewed_at",{withTimezone:true}),
  reviewComments: text("review_comments"),
},(t)=>({ subGrantIdx: index("preport_subgrant_idx").on(t.subGrantId) }));
