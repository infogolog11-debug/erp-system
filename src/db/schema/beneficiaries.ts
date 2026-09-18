import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, users } from "./shared";
import { grants } from "./grants";
import { items } from "./inventory";

// ═══════════════════════════════════════════════════════════════
// Beneficiary Management — التسجيل، التحقق، الحماية من الازدواجية،
// الحالات الفردية (Case Management)، وسجل التوزيعات
// ═══════════════════════════════════════════════════════════════

export const genderEnum2 = pgEnum("beneficiary_gender", ["male","female"]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "pending","verified","rejected","flagged_duplicate",
]);

export const vulnerabilityCategoryEnum = pgEnum("vulnerability_category", [
  "none","elderly","disability","chronic_illness","female_headed_household",
  "child_headed_household","unaccompanied_minor","pregnant_lactating","other",
]);

export const beneficiaries = pgTable("beneficiaries",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id), // المشروع/المنحة المسجَّل تحتها
  code:           text("code").unique().notNull(), // رقم المستفيد الفريد (Beneficiary ID)
  firstName:      text("first_name").notNull(),
  lastName:       text("last_name").notNull(),
  fullNameAr:     text("full_name_ar"),
  dateOfBirth:    text("date_of_birth"),
  gender:         genderEnum2("gender").notNull(),
  nationalId:     text("national_id"), // رقم هوية / بطاقة عائلية
  phone:          text("phone"),
  governorate:    text("governorate"),
  district:       text("district"),
  community:      text("community"),
  addressDetail:  text("address_detail"),
  latitude:       decimal("latitude",{precision:10,scale:7}),
  longitude:      decimal("longitude",{precision:10,scale:7}),
  householdSize:  integer("household_size").default(1).notNull(),
  vulnerabilityCategory: vulnerabilityCategoryEnum("vulnerability_category").default("none").notNull(),
  vulnerabilityScore:    integer("vulnerability_score").default(0).notNull(), // 0-100، أعلى = أكثر ضعفاً
  verificationStatus:    verificationStatusEnum("verification_status").default("pending").notNull(),
  verifiedBy:     uuid("verified_by").references(()=>users.id),
  verifiedAt:     timestamp("verified_at",{withTimezone:true}),
  registrationDate: timestamp("registration_date",{withTimezone:true}).default(sql`now()`).notNull(),
  // بصمة تحقق من الازدواجية: hash من (الاسم الكامل + تاريخ الميلاد + رقم الهوية) مُطبّع
  duplicateCheckHash: text("duplicate_check_hash").notNull(),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({
  orgIdx:      index("ben_org_idx").on(t.organizationId),
  grantIdx:    index("ben_grant_idx").on(t.grantId),
  dupHashIdx:  index("ben_dup_hash_idx").on(t.duplicateCheckHash), // للبحث السريع عن تطابقات محتملة
  nationalIdIdx: index("ben_national_id_idx").on(t.nationalId),
}));

export const householdMembers = pgTable("household_members",{
  ...baseColumns,
  beneficiaryId:  uuid("beneficiary_id").references(()=>beneficiaries.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  fullName:       text("full_name").notNull(),
  relationship:   text("relationship").notNull(), // spouse|child|parent|other
  age:            integer("age"),
  gender:         genderEnum2("gender"),
  isVulnerable:   boolean("is_vulnerable").default(false).notNull(),
  vulnerabilityNote: text("vulnerability_note"),
},(t)=>({ benIdx: index("hh_beneficiary_idx").on(t.beneficiaryId) }));

// ── Case Management ──────────────────────────────────────────
export const caseTypeEnum = pgEnum("case_type", [
  "protection","referral","complaint","assistance_request","follow_up","other",
]);
export const casePriorityEnum = pgEnum("case_priority", ["low","medium","high","urgent"]);
export const caseStatusEnum   = pgEnum("case_status", ["open","in_progress","referred","closed"]);

export const caseRecords = pgTable("case_records",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  beneficiaryId:  uuid("beneficiary_id").references(()=>beneficiaries.id).notNull(),
  code:           text("code").unique().notNull(),
  caseType:       caseTypeEnum("case_type").notNull(),
  priority:       casePriorityEnum("priority").default("medium").notNull(),
  caseStatus:     caseStatusEnum("case_status").default("open").notNull(),
  assignedTo:     uuid("assigned_to").references(()=>users.id),
  description:    text("description").notNull(),
  openedDate:     timestamp("opened_date",{withTimezone:true}).default(sql`now()`).notNull(),
  closedDate:     timestamp("closed_date",{withTimezone:true}),
  isConfidential: boolean("is_confidential").default(true).notNull(), // حماية بيانات الحالات الحساسة
},(t)=>({
  orgIdx: index("case_org_idx").on(t.organizationId),
  benIdx: index("case_beneficiary_idx").on(t.beneficiaryId),
}));

export const caseNotes = pgTable("case_notes",{
  ...baseColumns,
  caseId:         uuid("case_id").references(()=>caseRecords.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  note:           text("note").notNull(),
},(t)=>({ caseIdx: index("case_note_case_idx").on(t.caseId) }));

// ── Distribution Management ──────────────────────────────────
export const distributionTypeEnum = pgEnum("distribution_type", ["in_kind","cash","voucher","service"]);

export const distributions = pgTable("distributions",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  beneficiaryId:  uuid("beneficiary_id").references(()=>beneficiaries.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id).notNull(),
  itemId:         uuid("item_id").references(()=>items.id), // فارغ إذا نقدي
  distributionType: distributionTypeEnum("distribution_type").notNull(),
  quantity:       decimal("quantity",{precision:18,scale:3}),
  cashAmount:     decimal("cash_amount",{precision:18,scale:2}),
  currencyCode:   text("currency_code"),
  distributionDate: timestamp("distribution_date",{withTimezone:true}).default(sql`now()`).notNull(),
  distributedBy:  uuid("distributed_by").references(()=>users.id).notNull(),
  location:       text("location"),
  signatureConfirmed: boolean("signature_confirmed").default(false).notNull(),
},(t)=>({
  orgIdx:  index("dist_org_idx").on(t.organizationId),
  benIdx:  index("dist_beneficiary_idx").on(t.beneficiaryId),
  grantIdx: index("dist_grant_idx").on(t.grantId),
  dateIdx: index("dist_date_idx").on(t.distributionDate),
}));
