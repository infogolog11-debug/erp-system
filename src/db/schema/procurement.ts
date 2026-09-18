import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum,jsonb
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations,users,currencies,costCenters } from "./shared";
import { grants,grantBudgetLines } from "./grants";
import { vendors } from "./vendors";
import { items } from "./inventory";

export const priorityEnum = pgEnum("priority",["low","medium","high","urgent"]);

export const purchaseRequests = pgTable("purchase_requests",{
  ...baseColumns,
  organizationId:  uuid("organization_id").references(()=>organizations.id).notNull(),
  code:            text("code").unique().notNull(),
  title:           text("title").notNull(),
  requestedBy:     uuid("requested_by").references(()=>users.id).notNull(),
  departmentId:    uuid("department_id").references(()=>costCenters.id),
  grantId:         uuid("grant_id").references(()=>grants.id),
  budgetLineId:    uuid("budget_line_id").references(()=>grantBudgetLines.id),
  priority:        priorityEnum("priority").default("medium").notNull(),
  requiredDate:    timestamp("required_date",{withTimezone:true}),
  estimatedTotal:  decimal("estimated_total",{precision:18,scale:2}),
  currencyId:      uuid("currency_id").references(()=>currencies.id),
  justification:   text("justification"),
  budgetAvailable: decimal("budget_available",{precision:18,scale:2}),
  budgetStatus:    text("budget_status"),
  isEmergency:              boolean("is_emergency").default(false).notNull(),
  emergencyReason:          text("emergency_reason"),
  emergencyAuthorizedBy:    uuid("emergency_authorized_by").references(()=>users.id),
  emergencyReviewDue:       timestamp("emergency_review_due",{withTimezone:true}),
  emergencyReviewedAt:      timestamp("emergency_reviewed_at",{withTimezone:true}),
  emergencyReviewNotes:     text("emergency_review_notes"),
},(t)=>({ orgIdx: index("pr_org_idx").on(t.organizationId) }));

export const purchaseRequestItems = pgTable("purchase_request_items",{
  ...baseColumns,
  prId:           uuid("pr_id").references(()=>purchaseRequests.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  itemDescription: text("item_description").notNull(),
  unit:            text("unit").notNull(),
  quantity:        decimal("quantity",{precision:18,scale:3}).notNull(),
  estimatedUnitPrice: decimal("estimated_unit_price",{precision:18,scale:2}),
  estimatedTotal:  decimal("estimated_total",{precision:18,scale:2}),
  specifications:  text("specifications"),
});

export const comparativeAnalyses = pgTable("comparative_analyses",{
  ...baseColumns,
  prId:           uuid("pr_id").references(()=>purchaseRequests.id).notNull(),
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").unique().notNull(),
  title:          text("title").notNull(),
  totalBudget:    decimal("total_budget",{precision:18,scale:2}),
  selectedVendorId: uuid("selected_vendor_id").references(()=>vendors.id),
  selectionReason:  text("selection_reason"),
});

export const cbaVendorOffers = pgTable("cba_vendor_offers",{
  ...baseColumns,
  cbaId:          uuid("cba_id").references(()=>comparativeAnalyses.id).notNull(),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  deliveryDays:   integer("delivery_days"),
  technicalScore: decimal("technical_score",{precision:5,scale:2}),
  financialScore: decimal("financial_score",{precision:5,scale:2}),
  isRecommended:  boolean("is_recommended").default(false).notNull(),
  notes:          text("notes"),
});

export const purchaseOrders = pgTable("purchase_orders",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  prId:           uuid("pr_id").references(()=>purchaseRequests.id),
  cbaId:          uuid("cba_id").references(()=>comparativeAnalyses.id),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id),
  budgetLineId:   uuid("budget_line_id").references(()=>grantBudgetLines.id),
  code:           text("code").unique().notNull(),
  orderDate:      timestamp("order_date",{withTimezone:true}).default(sql`now()`).notNull(),
  deliveryDate:   timestamp("delivery_date",{withTimezone:true}),
  deliveryAddress: text("delivery_address"),
  subtotal:       decimal("subtotal",{precision:18,scale:2}).notNull(),
  taxAmount:      decimal("tax_amount",{precision:18,scale:2}).default("0").notNull(),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  exchangeRate:   decimal("exchange_rate",{precision:18,scale:6}).default("1").notNull(),
  paymentTerms:   text("payment_terms"),
  termsConditions: text("terms_conditions"),
},(t)=>({
  orgIdx:    index("po_org_idx").on(t.organizationId),
  vendorIdx: index("po_vendor_idx").on(t.vendorId),
  grantIdx:  index("po_grant_idx").on(t.grantId),
}));

export const purchaseOrderItems = pgTable("purchase_order_items",{
  ...baseColumns,
  poId:           uuid("po_id").references(()=>purchaseOrders.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  prItemId:       uuid("pr_item_id").references(()=>purchaseRequestItems.id),
  itemId:         uuid("item_id").references(()=>items.id),
  itemDescription: text("item_description").notNull(),
  unit:           text("unit").notNull(),
  quantity:       decimal("quantity",{precision:18,scale:3}).notNull(),
  unitPrice:      decimal("unit_price",{precision:18,scale:2}).notNull(),
  taxRate:        decimal("tax_rate",{precision:5,scale:2}).default("0"),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  receivedQty:    decimal("received_qty",{precision:18,scale:3}).default("0"),
});

export const goodsReceiptNotes = pgTable("goods_receipt_notes",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  poId:           uuid("po_id").references(()=>purchaseOrders.id).notNull(),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  code:           text("code").unique().notNull(),
  receiptDate:    timestamp("receipt_date",{withTimezone:true}).default(sql`now()`).notNull(),
  receivedBy:     uuid("received_by").references(()=>users.id).notNull(),
  deliveryNote:   text("delivery_note"),
  warehouseId:    uuid("warehouse_id"),
  remarks:        text("remarks"),
});

export const grnItems = pgTable("grn_items",{
  ...baseColumns,
  grnId:          uuid("grn_id").references(()=>goodsReceiptNotes.id).notNull(),
  poItemId:       uuid("po_item_id").references(()=>purchaseOrderItems.id).notNull(),
  organizationId: uuid("organization_id").notNull(),
  orderedQty:     decimal("ordered_qty",{precision:18,scale:3}).notNull(),
  receivedQty:    decimal("received_qty",{precision:18,scale:3}).notNull(),
  rejectedQty:    decimal("rejected_qty",{precision:18,scale:3}).default("0"),
  rejectionReason: text("rejection_reason"),
  condition:      text("condition").default("good"),
});

export const vendorInvoices = pgTable("vendor_invoices",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  poId:           uuid("po_id").references(()=>purchaseOrders.id).notNull(),
  grnId:          uuid("grn_id").references(()=>goodsReceiptNotes.id),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id),
  code:           text("code").unique().notNull(),
  vendorInvoiceNo: text("vendor_invoice_no").notNull(),
  invoiceDate:    timestamp("invoice_date",{withTimezone:true}).notNull(),
  dueDate:        timestamp("due_date",{withTimezone:true}),
  subtotal:       decimal("subtotal",{precision:18,scale:2}).notNull(),
  taxAmount:      decimal("tax_amount",{precision:18,scale:2}).default("0"),
  totalAmount:    decimal("total_amount",{precision:18,scale:2}).notNull(),
  paidAmount:     decimal("paid_amount",{precision:18,scale:2}).default("0"),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  journalEntryId: uuid("journal_entry_id"),
  matchingStatus:     text("matching_status").default("pending").notNull(),
  matchingCheckedAt:  timestamp("matching_checked_at",{withTimezone:true}),
  matchingCheckedBy:  uuid("matching_checked_by"),
  poVarianceAmt:      decimal("po_variance_amt",{precision:18,scale:2}),
  grnVarianceAmt:     decimal("grn_variance_amt",{precision:18,scale:2}),
  discrepancyNotes:   text("discrepancy_notes"),
  overrideReason:     text("override_reason"),
});

export const payments = pgTable("payments",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  invoiceId:      uuid("invoice_id").references(()=>vendorInvoices.id).notNull(),
  vendorId:       uuid("vendor_id").references(()=>vendors.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id),
  code:           text("code").unique().notNull(),
  paymentDate:    timestamp("payment_date",{withTimezone:true}).notNull(),
  amount:         decimal("amount",{precision:18,scale:2}).notNull(),
  currencyId:     uuid("currency_id").references(()=>currencies.id).notNull(),
  paymentMethod:  text("payment_method").notNull(),
  referenceNo:    text("reference_no"),
  journalEntryId: uuid("journal_entry_id"),
});
