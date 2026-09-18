import {
  pgTable,text,boolean,uuid,integer,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, users } from "./shared";
import { grants } from "./grants";
import { beneficiaries } from "./beneficiaries";

// ═══════════════════════════════════════════════════════════════
// CFM — Complaint & Feedback Mechanism (آلية الشكاوى والتغذية الراجعة)
// ═══════════════════════════════════════════════════════════════

export const complaintChannelEnum = pgEnum("complaint_channel", [
  "hotline","in_person","sms","email","suggestion_box","community_meeting","other",
]);
export const complaintCategoryEnum = pgEnum("complaint_category", [
  "service_quality","staff_conduct","corruption_fraud","sgbv_protection",
  "distribution_issue","eligibility_targeting","data_privacy","suggestion","other",
]);
// شكاوى حساسة (حماية/SGBV/فساد) تتطلب صلاحية وصول مُقيَّدة ومسار تصعيد خاص
export const complaintSensitivityEnum = pgEnum("complaint_sensitivity", ["standard","sensitive"]);
export const complaintStatusEnum = pgEnum("complaint_status", [
  "received","under_review","investigating","resolved","closed","escalated",
]);
export const complaintPriorityEnum = pgEnum("complaint_priority", ["low","medium","high","critical"]);

export const complaints = pgTable("complaints",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").unique().notNull(),
  channel:        complaintChannelEnum("channel").notNull(),
  category:       complaintCategoryEnum("category").notNull(),
  sensitivity:    complaintSensitivityEnum("sensitivity").default("standard").notNull(),
  isAnonymous:    boolean("is_anonymous").default(false).notNull(),
  complainantName: text("complainant_name"),
  complainantPhone: text("complainant_phone"),
  beneficiaryId:  uuid("beneficiary_id").references(()=>beneficiaries.id),
  grantId:        uuid("grant_id").references(()=>grants.id),
  description:    text("description").notNull(),
  complaintStatus: complaintStatusEnum("complaint_status").default("received").notNull(),
  priority:       complaintPriorityEnum("priority").default("medium").notNull(),
  receivedDate:   timestamp("received_date",{withTimezone:true}).default(sql`now()`).notNull(),
  dueDate:        timestamp("due_date",{withTimezone:true}), // مهلة الاستجابة حسب SLA
  assignedTo:     uuid("assigned_to").references(()=>users.id),
  resolutionSummary: text("resolution_summary"),
  resolvedDate:   timestamp("resolved_date",{withTimezone:true}),
  satisfactionRating: integer("satisfaction_rating"), // 1-5، يُجمَع من مقدّم الشكوى بعد الحل
},(t)=>({
  orgIdx:  index("complaint_org_idx").on(t.organizationId),
  statusIdx: index("complaint_status_idx").on(t.complaintStatus),
}));

export const complaintUpdates = pgTable("complaint_updates",{
  ...baseColumns,
  complaintId:    uuid("complaint_id").references(()=>complaints.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  update:         text("update").notNull(),
},(t)=>({ complaintIdx: index("cupdate_complaint_idx").on(t.complaintId) }));
