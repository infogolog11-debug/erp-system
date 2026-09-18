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
  // سلسلة تجزئة (hash chain) لجعل السجل tamper-evident على مستوى التطبيق:
  // كل سطر يحمل تجزئة سطره + تجزئة السطر السابق له لنفس المنظمة، فأي
  // تعديل/حذف لاحق على سطر قديم يكسر تسلسل كل ما بعده وينكشف بالتحقق.
  // ملاحظة: هذا tamper-evident وليس immutable بشكل مطلق أمام مالك القاعدة
  // (DB owner/superuser) — الحماية المطلقة تتطلب دور DB منفصل بصلاحيات
  // محدودة (REVOKE UPDATE/DELETE) لا يملكها التطبيق نفسه؛ راجع SECURITY_NOTES.md.
  prevHash:       text("prev_hash"),
  hash:           text("hash"),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  tableRecordIdx: index("audit_table_record_idx").on(t.tableName,t.recordId),
  userIdx:        index("audit_user_idx").on(t.userId),
  createdIdx:     index("audit_created_idx").on(t.createdAt),
}));

// مفاتيح idempotency — تمنع تكرار تنفيذ نفس العملية (مثلاً بسبب retry من
// الشبكة أو نقرة مزدوجة) لنفس المنظمة + نفس المفتاح + نفس نوع الإجراء.
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

// ══ مصفوفة التواقيع الديناميكية (Layer 1) ══════════════════════════════════
// ══════════════════════════════════════════════════════
// مصفوفة التواقيع الديناميكية (Approval Matrix) — طبقة 1
// كل صف = مرحلة موافقة داخل نطاق مالي محدد
// مثال: PR 1000-10000$ → مستوى 1: مدير المشتريات → مستوى 2: المدير المالي
// ══════════════════════════════════════════════════════
export const approvalRules = pgTable("approval_rules",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  moduleCode:      text("module_code").notNull(), // procurement|grants|payments|hr
  label:           text("label"),
  labelAr:         text("label_ar"),
  minAmount:       decimal("min_amount",{precision:18,scale:2}).default("0").notNull(),
  maxAmount:       decimal("max_amount",{precision:18,scale:2}),   // null = بلا حد أعلى
  approvalLevel:   integer("approval_level").notNull(),            // 1,2,3 تسلسلي
  levelName:       text("level_name").notNull().default("Approval"),
  levelNameAr:     text("level_name_ar"),
  approverUserId:  uuid("approver_user_id").references(()=>users.id),
  approverRole:    userRoleEnum("approver_role"),
  // مهلة SLA بالساعات قبل التصعيد التلقائي
  slaHours:        integer("sla_hours").default(48),
  escalateTo:      uuid("escalate_to").references(()=>users.id),
  // الإجراء عند التجاوز: escalate_to_next | block | notify_only
  onLimitAction:   text("on_limit_action").default("escalate_to_next"),
  isActive:        boolean("is_active").default(true).notNull(),
},(t)=>({
  matrixIdx: index("ar_matrix_idx").on(t.organizationId, t.moduleCode, t.approvalLevel),
}));

// سجل قرارات الموافقة لكل طلب (audit trail)
export const approvalDecisions = pgTable("approval_decisions",{
  id:               uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId:   uuid("organization_id").notNull(),
  recordType:       text("record_type").notNull(), // purchase_request|grant|payment
  recordId:         uuid("record_id").notNull(),
  ruleId:           uuid("rule_id").references(()=>approvalRules.id).notNull(),
  approvalLevel:    integer("approval_level").notNull(),
  approverId:       uuid("approver_id").references(()=>users.id).notNull(),
  decision:         text("decision").notNull(), // approved|rejected|returned|escalated
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


// ══════════════════════════════════════════════════════
// صلاحيات المستخدمين الدقيقة per-module
// ══════════════════════════════════════════════════════
export const userModulePermissions = pgTable("user_module_permissions",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  userId:         uuid("user_id").references(()=>users.id).notNull(),
  // الوحدة: grants | procurement | vendors | hr | inventory | accounting | reports | settings
  moduleCode:     text("module_code").notNull(),
  // الصلاحية: none | view | create | edit | approve | admin
  permission:     text("permission").notNull().default("view"),
  // قيود إضافية (JSON) — مثال: { onlyOwnDept: true }
  constraints:    jsonb("constraints"),
  grantedBy:      uuid("granted_by").references(()=>users.id).notNull(),
  grantedAt:      timestamp("granted_at",{withTimezone:true}).default(sql`now()`).notNull(),
  updatedAt:      timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  uniqueUserModule: index("ump_unique_idx").on(t.organizationId, t.userId, t.moduleCode),
}));

// ══════════════════════════════════════════════════════
// إعدادات النظام الديناميكية — Admin Panel
// يحل محل كل القيم الـ hardcoded في الكود
// ══════════════════════════════════════════════════════
export const systemSettings = pgTable("system_settings",{
  id:             uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  // التصنيف: payroll | budget | procurement | hr | accounting | notifications
  category:       text("category").notNull(),
  // المفتاح الفريد داخل التصنيف: income_tax_rate | overtime_multiplier | etc.
  settingKey:     text("setting_key").notNull(),
  // القيمة المخزنة دائماً كـ text — يُحوَّل حسب valueType
  value:          text("value").notNull(),
  // نوع القيمة للتحويل الصحيح عند القراءة
  valueType:      text("value_type").notNull().default("string"), // number|boolean|string|json
  // بيانات العرض
  label:          text("label").notNull(),
  labelAr:        text("label_ar"),
  description:    text("description"),
  descriptionAr:  text("description_ar"),
  // حدود القيمة (للتحقق)
  minValue:       text("min_value"),
  maxValue:       text("max_value"),
  unit:           text("unit"), // % | days | hours | multiplier
  // من غيّر الإعداد آخر مرة
  updatedBy:      uuid("updated_by").references(()=>users.id),
  updatedAt:      timestamp("updated_at",{withTimezone:true}).default(sql`now()`).notNull(),
  createdAt:      timestamp("created_at",{withTimezone:true}).default(sql`now()`).notNull(),
},(t)=>({
  uniqueKey: index("ss_unique_key").on(t.organizationId, t.category, t.settingKey),
}));

