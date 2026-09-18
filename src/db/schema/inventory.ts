import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations,users,costCenters } from "./shared";
import { grants } from "./grants";
import { purchaseOrders,grnItems } from "./procurement";

export const assetConditionEnum = pgEnum("asset_condition",["new","good","fair","poor","disposed"]);

export const warehouses = pgTable("warehouses",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  code:           text("code").notNull(),
  location:       text("location"),
  latitude:       decimal("latitude",{precision:10,scale:7}),
  longitude:      decimal("longitude",{precision:10,scale:7}),
  managerId:      uuid("manager_id").references(()=>users.id),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("warehouses_org_idx").on(t.organizationId) }));

export const itemCategories = pgTable("item_categories",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  code:           text("code").notNull(),
  parentId:       uuid("parent_id"),
});

export const items = pgTable("items",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  categoryId:     uuid("category_id").references(()=>itemCategories.id),
  code:           text("code").notNull(),
  name:           text("name").notNull(),
  nameAr:         text("name_ar"),
  description:    text("description"),
  unit:           text("unit").notNull(),
  itemType:       text("item_type").notNull(), // consumable | asset | service
  minStock:       decimal("min_stock",{precision:18,scale:3}).default("0"),
  currentStock:   decimal("current_stock",{precision:18,scale:3}).default("0"),
  unitCost:       decimal("unit_cost",{precision:18,scale:2}),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("items_org_idx").on(t.organizationId) }));

export const stockMovements = pgTable("stock_movements",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  itemId:          uuid("item_id").references(()=>items.id).notNull(),
  warehouseId:     uuid("warehouse_id").references(()=>warehouses.id).notNull(),
  movementType:    text("movement_type").notNull(), // in|out|transfer|adjustment
  quantity:        decimal("quantity",{precision:18,scale:3}).notNull(),
  unitCost:        decimal("unit_cost",{precision:18,scale:2}),
  totalCost:       decimal("total_cost",{precision:18,scale:2}),
  referenceTable:  text("reference_table"), // grn | issue | adjustment
  referenceId:     uuid("reference_id"),
  grantId:         uuid("grant_id").references(()=>grants.id),
  movementDate:    timestamp("movement_date",{withTimezone:true}).default(sql`now()`).notNull(),
  performedBy:     uuid("performed_by").references(()=>users.id).notNull(),
  journalEntryId:  uuid("journal_entry_id"),
  // ─── أُضيف v32: كانت هذه أعمدة جدول موازٍ منفصل (stock_ledger) أنشأناه
  // بالخطأ بجولة سابقة دون الانتباه لوجود هذا الجدول أصلاً غير مُستخدَم.
  // دُمجت هنا بدل الإبقاء على جدولين متوازيين لنفس الغرض.
  balanceQty:      decimal("balance_qty",{precision:18,scale:3}),      // الرصيد بعد هذه الحركة (AVCO)
  balanceAvgCost:  decimal("balance_avg_cost",{precision:18,scale:4}), // المتوسط المرجح بعد الحركة
  idempotencyKey:  text("idempotency_key"), // نفس المفتاح لا يُنفَّذ مرتين لنفس الصنف
},(t)=>({
  itemIdx:  index("stock_item_idx").on(t.itemId),
  dateIdx:  index("stock_date_idx").on(t.movementDate),
  orgIdx:   index("stock_org_idx").on(t.organizationId),
  refIdx:   index("stock_ref_idx").on(t.referenceTable,t.referenceId),
}));

export const assets = pgTable("assets",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  itemId:          uuid("item_id").references(()=>items.id),
  grantId:         uuid("grant_id").references(()=>grants.id),
  poId:            uuid("po_id").references(()=>purchaseOrders.id),
  code:            text("code").unique().notNull(),
  name:            text("name").notNull(),
  serialNumber:    text("serial_number"),
  purchaseDate:    timestamp("purchase_date",{withTimezone:true}).notNull(),
  purchaseCost:    decimal("purchase_cost",{precision:18,scale:2}).notNull(),
  currentValue:    decimal("current_value",{precision:18,scale:2}),
  salvageValue:    decimal("salvage_value",{precision:18,scale:2}).default("0"),
  usefulLifeYears: integer("useful_life_years"),
  depreciationMethod: text("depreciation_method").default("straight_line"),
  // straight_line | declining_balance
  assetCondition:  assetConditionEnum("asset_condition").default("new").notNull(),
  location:        text("location"),
  assignedTo:      uuid("assigned_to").references(()=>users.id),
  warehouseId:     uuid("warehouse_id").references(()=>warehouses.id),
  disposalDate:    timestamp("disposal_date",{withTimezone:true}),
  disposalReason:  text("disposal_reason"),
},(t)=>({ orgIdx: index("assets_org_idx").on(t.organizationId) }));

export const depreciationSchedules = pgTable("depreciation_schedules",{
  ...baseColumns,
  assetId:         uuid("asset_id").references(()=>assets.id).notNull(),
  organizationId:  uuid("organization_id").notNull(),
  periodDate:      text("period_date").notNull(),
  openingValue:    decimal("opening_value",{precision:18,scale:2}).notNull(),
  depreciationAmt: decimal("depreciation_amount",{precision:18,scale:2}).notNull(),
  closingValue:    decimal("closing_value",{precision:18,scale:2}).notNull(),
  isPosted:        boolean("is_posted").default(false).notNull(),
  journalEntryId:  uuid("journal_entry_id"),
});
