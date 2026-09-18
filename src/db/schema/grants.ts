import {
  pgTable,text,timestamp,boolean,uuid,decimal,integer,index
} from "drizzle-orm/pg-core";
import { baseColumns } from "./base";
import { organizations, costCenters, currencies, users } from "./shared";

export const donors = pgTable("donors",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  code:           text("code").notNull(),
  contactPerson:  text("contact_person"),
  email:          text("email"),
  phone:          text("phone"),
  country:        text("country"),
  donorType:      text("donor_type").notNull(),
  reportingStandard: text("reporting_standard").default("generic").notNull(),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("donors_org_idx").on(t.organizationId) }));

export const grants = pgTable("grants",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  donorId:        uuid("donor_id").references(()=>donors.id).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  code:           text("code").unique().notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  startDate:      timestamp("start_date",{withTimezone:true}).notNull(),
  endDate:        timestamp("end_date",{withTimezone:true}).notNull(),
  grantManagerId: uuid("grant_manager_id").references(()=>users.id),
  description:    text("description"),
  objectives:     text("objectives"),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({
  orgIdx:   index("grants_org_idx").on(t.organizationId),
  donorIdx: index("grants_donor_idx").on(t.donorId),
}));

export const grantBudgetLines = pgTable("grant_budget_lines",{
  ...baseColumns,
  grantId:        uuid("grant_id").references(()=>grants.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  costCenterId:   uuid("cost_center_id").references(()=>costCenters.id),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  budgetCategory: text("budget_category").notNull(),
  plannedAmount:  decimal("planned_amount",{precision:18,scale:2}).notNull(),
  committedAmount: decimal("committed_amount",{precision:18,scale:2}).default("0").notNull(),
  spentAmount:        decimal("spent_amount",{precision:18,scale:2}).default("0").notNull(),
  warningThreshold:   integer("warning_threshold").default(80).notNull(),
  blockThreshold:     integer("block_threshold").default(100).notNull(),
  warning80NotifiedAt: timestamp("warning80_notified_at",{withTimezone:true}),
  warning95NotifiedAt: timestamp("warning95_notified_at",{withTimezone:true}),
},(t)=>({ grantIdx: index("budget_lines_grant_idx").on(t.grantId) }));

export const budgetAllocations = pgTable("budget_allocations",{
  ...baseColumns,
  grantId:        uuid("grant_id").references(()=>grants.id).notNull(),
  budgetLineId:   uuid("budget_line_id").references(()=>grantBudgetLines.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  referenceTable: text("reference_table").notNull(),
  referenceId:    uuid("reference_id").notNull(),
  amount:         decimal("amount",{precision:18,scale:2}).notNull(),
  allocationDate: timestamp("allocation_date",{withTimezone:true}).notNull(),
  description:    text("description"),
});
