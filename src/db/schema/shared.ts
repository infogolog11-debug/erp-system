import {
  pgTable,text,timestamp,boolean,uuid,pgEnum,integer,decimal,index,jsonb,uniqueIndex
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";

export const userRoleEnum = pgEnum("user_role",[
  "super_admin","admin","finance_manager","program_manager",
  "hr_manager","procurement_officer","warehouse_manager","viewer",
]);

export const organizations = pgTable("organizations",{
  ...baseColumns,
  name:      text("name").notNull(),
  nameAr:    text("name_ar"),
  code:      text("code").unique().notNull(),
  logo:      text("logo_url"),
  address:   text("address"),
  phone:     text("phone"),
  email:     text("email"),
  taxNumber: text("tax_number"),
  isActive:  boolean("is_active").default(true).notNull(),
});

export const users = pgTable("users",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  email:          text("email").unique().notNull(),
  passwordHash:   text("password_hash").notNull(),
  firstName:      text("first_name").notNull(),
  lastName:       text("last_name").notNull(),
  firstNameAr:    text("first_name_ar"),
  lastNameAr:     text("last_name_ar"),
  role:           userRoleEnum("role").default("viewer").notNull(),
  phone:          text("phone"),
  isActive:       boolean("is_active").default(true).notNull(),
  lastLoginAt:    timestamp("last_login_at",{withTimezone:true}),
  delegatedTo:    uuid("delegated_to"),
  delegatedUntil: timestamp("delegated_until",{withTimezone:true}),
},(t)=>({
  orgIdx:   index("users_org_idx").on(t.organizationId),
  emailIdx: index("users_email_idx").on(t.email),
}));

export const costCenters = pgTable("cost_centers",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:     text("code").notNull(),
  name:     text("name").notNull(),
  nameAr:   text("name_ar"),
  parentId: uuid("parent_id"),
  isActive: boolean("is_active").default(true).notNull(),
});

export const currencies = pgTable("currencies",{
  id:           uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code:         text("code").unique().notNull(),
  name:         text("name").notNull(),
  nameAr:       text("name_ar"),
  symbol:       text("symbol").notNull(),
  exchangeRate: decimal("exchange_rate",{precision:18,scale:6}).default("1").notNull(),
  isBase:       boolean("is_base").default(false).notNull(),
  isActive:     boolean("is_active").default(true).notNull(),
  updatedAt:    timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
});

export const fiscalYears = pgTable("fiscal_years",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  name:      text("name").notNull(),
  startDate: timestamp("start_date",{withTimezone:true}).notNull(),
  endDate:   timestamp("end_date",{withTimezone:true}).notNull(),
  isClosed:  boolean("is_closed").default(false).notNull(),
  closedAt:  timestamp("closed_at",{withTimezone:true}),
  closedBy:  uuid("closed_by"),
});

export const fiscalPeriods = pgTable("fiscal_periods",{
  ...baseColumns,
  fiscalYearId:   uuid("fiscal_year_id").references(()=>fiscalYears.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  name:           text("name").notNull(),
  periodNumber:   integer("period_number").notNull(),
  startDate:      timestamp("start_date",{withTimezone:true}).notNull(),
  endDate:        timestamp("end_date",{withTimezone:true}).notNull(),
  isClosed:       boolean("is_closed").default(false).notNull(),
});

export const auditLogs = pgTable("audit_logs",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").notNull(),
  userId:         uuid("user_id").notNull(),
  tableName:      text("table_name").notNull(),
  recordId:       uuid("record_id").notNull(),
  action:         text("action").notNull(),
  oldValues:      text("old_values"),
  newValues:      text("new_values"),
  ipAddress:      text("ip_address"),
  prevHash:       text("prev_hash"),
  hash:           text("hash"),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  tableRecordIdx: index("audit_table_record_idx").on(t.tableName,t.recordId),
  userIdx:        index("audit_user_idx").on(t.userId),
  createdIdx:     index("audit_created_idx").on(t.createdAt),
}));

export const idempotencyKeys = pgTable("idempotency_keys",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").notNull(),
  key:            text("key").notNull(),
  action:         text("action").notNull(),
  responseJson:   text("response_json"),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  uniqueKey: uniqueIndex("idempotency_org_key_action_uidx").on(t.organizationId,t.key,t.action),
}));

export const chatterMessages = pgTable("chatter_messages",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").notNull(),
  tableName:      text("table_name").notNull(),
  recordId:       uuid("record_id").notNull(),
  userId:         uuid("user_id").notNull(),
  message:        text("message").notNull(),
  messageType:    text("message_type").default("comment").notNull(),
  isInternal:     boolean("is_internal").default(false).notNull(),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({ recordIdx: index("chatter_record_idx").on(t.tableName,t.recordId) }));

export const attachments = pgTable("attachments",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").notNull(),
  tableName:      text("table_name").notNull(),
  recordId:       uuid("record_id").notNull(),
  fileName:       text("file_name").notNull(),
  fileUrl:        text("file_url").notNull(),
  storageKey:     text("storage_key"),
  fileSize:       integer("file_size"),
  mimeType:       text("mime_type"),
  uploadedBy:     uuid("uploaded_by").notNull(),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
});

export const approvalRules = pgTable("approval_rules",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  moduleCode:      text("module_code").notNull(),
  label:           text("label"),
  labelAr:         text("label_ar"),
  minAmount:       decimal("min_amount",{precision:18,scale:2}).default("0").notNull(),
  maxAmount:       decimal("max_amount",{precision:18,scale:2}),
  approvalLevel:   integer("approval_level").notNull(),
  levelName:       text("level_name").notNull().default("Approval"),
  levelNameAr:     text("level_name_ar"),
  approverUserId:  uuid("approver_user_id").references(()=>users.id),
  approverRole:    userRoleEnum("approver_role"),
  slaHours:        integer("sla_hours").default(48),
  escalateTo:      uuid("escalate_to").references(()=>users.id),
  onLimitAction:   text("on_limit_action").default("escalate_to_next"),
  isActive:        boolean("is_active").default(true).notNull(),
},(t)=>({
  matrixIdx: index("ar_matrix_idx").on(t.organizationId, t.moduleCode, t.approvalLevel),
}));

export const approvalDecisions = pgTable("approval_decisions",{
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId:   uuid("organization_id").notNull(),
  recordType:       text("record_type").notNull(),
  recordId:         uuid("record_id").notNull(),
  ruleId:           uuid("rule_id").references(()=>approvalRules.id).notNull(),
  approvalLevel:    integer("approval_level").notNull(),
  approverId:       uuid("approver_id").references(()=>users.id).notNull(),
  decision:         text("decision").notNull(),
  comments:         text("comments"),
  decidedAt:        timestamp("decided_at",{withTimezone:true}).default(sql`now()`).notNull(),
  isEscalated:      boolean("is_escalated").default(false),
  escalatedAt:      timestamp("escalated_at",{withTimezone:true}),
  amountAtDecision: decimal("amount_at_decision",{precision:18,scale:2}),
},(t)=>({
  recordIdx:   index("appdec_record_idx").on(t.recordType, t.recordId),
  approverIdx: index("appdec_approver_idx").on(t.approverId),
}));

export const notifications = pgTable("notifications",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").notNull(),
  userId:         uuid("user_id").notNull(),
  title:          text("title").notNull(),
  titleAr:        text("title_ar"),
  body:           text("body").notNull(),
  type:           text("type").notNull(),
  link:           text("link"),
  isRead:         boolean("is_read").default(false).notNull(),
  readAt:         timestamp("read_at",{withTimezone:true}),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  userIdx:   index("notif_user_idx").on(t.userId),
  unreadIdx: index("notif_unread_idx").on(t.userId,t.isRead),
}));

export const userModulePermissions = pgTable("user_module_permissions",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  userId:         uuid("user_id").references(()=>users.id).notNull(),
  moduleCode:     text("module_code").notNull(),
  permission:     text("permission").notNull().default("view"),
  constraints:    jsonb("constraints"),
  grantedBy:      uuid("granted_by").references(()=>users.id).notNull(),
  grantedAt:      timestamp("granted_at",{withTimezone:true}).default(sql`now()`).notNull(),
  updatedAt:      timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  uniqueUserModule: index("ump_unique_idx").on(t.organizationId, t.userId, t.moduleCode),
}));

export const systemSettings = pgTable("system_settings",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  category:       text("category").notNull(),
  settingKey:     text("setting_key").notNull(),
  value:          text("value").notNull(),
  valueType:      text("value_type").notNull().default("string"),
  label:          text("label").notNull(),
  labelAr:        text("label_ar"),
  description:    text("description"),
  descriptionAr:  text("description_ar"),
  minValue:       text("min_value"),
  maxValue:       text("max_value"),
  unit:           text("unit"),
  updatedBy:      uuid("updated_by").references(()=>users.id),
  updatedAt:      timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  uniqueKey: index("ss_unique_key").on(t.organizationId, t.category, t.settingKey),
}));
