import { relations } from "drizzle-orm";
import {
  organizations, users, costCenters, currencies, fiscalYears, fiscalPeriods,
  approvalRules, approvalDecisions, userModulePermissions,
} from "./shared";
import { donors, grants, grantBudgetLines, budgetAllocations } from "./grants";
import {
  vendors, vendorContacts, vendorCategories, tenders, tenderBids,
  vendorRatings, bidEvaluationCriteria, bidEvaluations,
} from "./vendors";
import {
  purchaseRequests, purchaseRequestItems, comparativeAnalyses, cbaVendorOffers,
  purchaseOrders, purchaseOrderItems, goodsReceiptNotes, grnItems,
  vendorInvoices, payments,
} from "./procurement";
import {
  departments, positions, employees, contracts, salaryComponents,
  payrollRuns, payrollLines, leaveRequests, attendance,
} from "./hr";
import {
  warehouses, itemCategories, items, stockMovements, assets, depreciationSchedules,
} from "./inventory";
import {
  accounts, journalEntries, journalLines, exchangeRateHistory, fxRevaluations,
} from "./accounting";
import {
  beneficiaries, householdMembers, caseRecords, caseNotes, distributions,
} from "./beneficiaries";
import {
  partners, subGrants, subGrantDisbursements, partnerReports,
} from "./partners";
import {
  vehicles, drivers, vehicleTrips, fuelLogs, maintenanceRecords,
} from "./fleet";
import {
  complaints, complaintUpdates,
} from "./cfm";
import {
  screeningRecords,
} from "./screening";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, { fields: [users.organizationId], references: [organizations.id] }),
}));

export const costCentersRelations = relations(costCenters, ({ one }) => ({
  organization: one(organizations, { fields: [costCenters.organizationId], references: [organizations.id] }),
}));

export const fiscalYearsRelations = relations(fiscalYears, ({ many }) => ({
  periods: many(fiscalPeriods),
}));

export const fiscalPeriodsRelations = relations(fiscalPeriods, ({ one }) => ({
  fiscalYear: one(fiscalYears, { fields: [fiscalPeriods.fiscalYearId], references: [fiscalYears.id] }),
}));

export const approvalRulesRelations = relations(approvalRules, ({ one }) => ({
  approverUser: one(users, { fields: [approvalRules.approverUserId], references: [users.id] }),
}));

export const approvalDecisionsRelations = relations(approvalDecisions, ({ one }) => ({
  rule:     one(approvalRules, { fields: [approvalDecisions.ruleId], references: [approvalRules.id] }),
  approver: one(users, { fields: [approvalDecisions.approverId], references: [users.id] }),
}));

export const donorsRelations = relations(donors, ({ many }) => ({
  grants: many(grants),
}));

export const grantsRelations = relations(grants, ({ one, many }) => ({
  donor:        one(donors, { fields: [grants.donorId], references: [donors.id] }),
  currency:     one(currencies, { fields: [grants.currencyId], references: [currencies.id] }),
  grantManager: one(users, { fields: [grants.grantManagerId], references: [users.id] }),
  budgetLines:  many(grantBudgetLines),
  budgetAllocations: many(budgetAllocations),
}));

export const grantBudgetLinesRelations = relations(grantBudgetLines, ({ one, many }) => ({
  grant:      one(grants, { fields: [grantBudgetLines.grantId], references: [grants.id] }),
  costCenter: one(costCenters, { fields: [grantBudgetLines.costCenterId], references: [costCenters.id] }),
  allocations: many(budgetAllocations),
}));

export const budgetAllocationsRelations = relations(budgetAllocations, ({ one }) => ({
  grant:      one(grants, { fields: [budgetAllocations.grantId], references: [grants.id] }),
  budgetLine: one(grantBudgetLines, { fields: [budgetAllocations.budgetLineId], references: [grantBudgetLines.id] }),
}));

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  preferredCurrency: one(currencies, { fields: [vendors.preferredCurrencyId], references: [currencies.id] }),
  contacts:   many(vendorContacts),
  categories: many(vendorCategories),
  bids:       many(tenderBids),
  ratings:    many(vendorRatings),
}));

export const vendorContactsRelations = relations(vendorContacts, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorContacts.vendorId], references: [vendors.id] }),
}));

export const vendorCategoriesRelations = relations(vendorCategories, ({ one }) => ({
  vendor: one(vendors, { fields: [vendorCategories.vendorId], references: [vendors.id] }),
}));

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  currency:      one(currencies, { fields: [tenders.currencyId], references: [currencies.id] }),
  awardedVendor: one(vendors, { fields: [tenders.awardedVendorId], references: [vendors.id] }),
  bids:          many(tenderBids),
  criteria:      many(bidEvaluationCriteria),
}));

export const tenderBidsRelations = relations(tenderBids, ({ one, many }) => ({
  tender:      one(tenders, { fields: [tenderBids.tenderId], references: [tenders.id] }),
  vendor:      one(vendors, { fields: [tenderBids.vendorId], references: [vendors.id] }),
  currency:    one(currencies, { fields: [tenderBids.currencyId], references: [currencies.id] }),
  evaluations: many(bidEvaluations),
}));

export const vendorRatingsRelations = relations(vendorRatings, ({ one }) => ({
  vendor:  one(vendors, { fields: [vendorRatings.vendorId], references: [vendors.id] }),
  ratedByUser: one(users, { fields: [vendorRatings.ratedBy], references: [users.id] }),
}));

export const bidEvaluationCriteriaRelations = relations(bidEvaluationCriteria, ({ one, many }) => ({
  tender:      one(tenders, { fields: [bidEvaluationCriteria.tenderId], references: [tenders.id] }),
  evaluations: many(bidEvaluations),
}));

export const bidEvaluationsRelations = relations(bidEvaluations, ({ one }) => ({
  tender:    one(tenders, { fields: [bidEvaluations.tenderId], references: [tenders.id] }),
  bid:       one(tenderBids, { fields: [bidEvaluations.bidId], references: [tenderBids.id] }),
  criteria:  one(bidEvaluationCriteria, { fields: [bidEvaluations.criteriaId], references: [bidEvaluationCriteria.id] }),
  evaluator: one(users, { fields: [bidEvaluations.evaluatorId], references: [users.id] }),
}));

export const purchaseRequestsRelations = relations(purchaseRequests, ({ one, many }) => ({
  requester:  one(users, { fields: [purchaseRequests.requestedBy], references: [users.id] }),
  department: one(costCenters, { fields: [purchaseRequests.departmentId], references: [costCenters.id] }),
  grant:      one(grants, { fields: [purchaseRequests.grantId], references: [grants.id] }),
  budgetLine: one(grantBudgetLines, { fields: [purchaseRequests.budgetLineId], references: [grantBudgetLines.id] }),
  currency:   one(currencies, { fields: [purchaseRequests.currencyId], references: [currencies.id] }),
  items:      many(purchaseRequestItems),
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseRequestItemsRelations = relations(purchaseRequestItems, ({ one }) => ({
  pr: one(purchaseRequests, { fields: [purchaseRequestItems.prId], references: [purchaseRequests.id] }),
}));

export const comparativeAnalysesRelations = relations(comparativeAnalyses, ({ one, many }) => ({
  pr:             one(purchaseRequests, { fields: [comparativeAnalyses.prId], references: [purchaseRequests.id] }),
  selectedVendor: one(vendors, { fields: [comparativeAnalyses.selectedVendorId], references: [vendors.id] }),
  offers:         many(cbaVendorOffers),
}));

export const cbaVendorOffersRelations = relations(cbaVendorOffers, ({ one }) => ({
  cba:      one(comparativeAnalyses, { fields: [cbaVendorOffers.cbaId], references: [comparativeAnalyses.id] }),
  vendor:   one(vendors, { fields: [cbaVendorOffers.vendorId], references: [vendors.id] }),
  currency: one(currencies, { fields: [cbaVendorOffers.currencyId], references: [currencies.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  pr:         one(purchaseRequests, { fields: [purchaseOrders.prId], references: [purchaseRequests.id] }),
  cba:        one(comparativeAnalyses, { fields: [purchaseOrders.cbaId], references: [comparativeAnalyses.id] }),
  vendor:     one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  grant:      one(grants, { fields: [purchaseOrders.grantId], references: [grants.id] }),
  budgetLine: one(grantBudgetLines, { fields: [purchaseOrders.budgetLineId], references: [grantBudgetLines.id] }),
  currency:   one(currencies, { fields: [purchaseOrders.currencyId], references: [currencies.id] }),
  items:      many(purchaseOrderItems),
  grns:       many(goodsReceiptNotes),
  invoices:   many(vendorInvoices),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one, many }) => ({
  po:      one(purchaseOrders, { fields: [purchaseOrderItems.poId], references: [purchaseOrders.id] }),
  prItem:  one(purchaseRequestItems, { fields: [purchaseOrderItems.prItemId], references: [purchaseRequestItems.id] }),
  grnItems: many(grnItems),
}));

export const goodsReceiptNotesRelations = relations(goodsReceiptNotes, ({ one, many }) => ({
  po:     one(purchaseOrders, { fields: [goodsReceiptNotes.poId], references: [purchaseOrders.id] }),
  vendor: one(vendors, { fields: [goodsReceiptNotes.vendorId], references: [vendors.id] }),
  receivedByUser: one(users, { fields: [goodsReceiptNotes.receivedBy], references: [users.id] }),
  items:  many(grnItems),
}));

export const grnItemsRelations = relations(grnItems, ({ one }) => ({
  grn:     one(goodsReceiptNotes, { fields: [grnItems.grnId], references: [goodsReceiptNotes.id] }),
  poItem:  one(purchaseOrderItems, { fields: [grnItems.poItemId], references: [purchaseOrderItems.id] }),
}));

export const vendorInvoicesRelations = relations(vendorInvoices, ({ one, many }) => ({
  po:       one(purchaseOrders, { fields: [vendorInvoices.poId], references: [purchaseOrders.id] }),
  grn:      one(goodsReceiptNotes, { fields: [vendorInvoices.grnId], references: [goodsReceiptNotes.id] }),
  vendor:   one(vendors, { fields: [vendorInvoices.vendorId], references: [vendors.id] }),
  grant:    one(grants, { fields: [vendorInvoices.grantId], references: [grants.id] }),
  currency: one(currencies, { fields: [vendorInvoices.currencyId], references: [currencies.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice:  one(vendorInvoices, { fields: [payments.invoiceId], references: [vendorInvoices.id] }),
  vendor:   one(vendors, { fields: [payments.vendorId], references: [vendors.id] }),
  grant:    one(grants, { fields: [payments.grantId], references: [grants.id] }),
  currency: one(currencies, { fields: [payments.currencyId], references: [currencies.id] }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, { fields: [departments.organizationId], references: [organizations.id] }),
  costCenter:   one(costCenters, { fields: [departments.costCenterId], references: [costCenters.id] }),
  positions:    many(positions),
  employees:    many(employees),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  department: one(departments, { fields: [positions.departmentId], references: [departments.id] }),
  employees:  many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  organization: one(organizations, { fields: [employees.organizationId], references: [organizations.id] }),
  user:         one(users, { fields: [employees.userId], references: [users.id] }),
  department:   one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  position:     one(positions, { fields: [employees.positionId], references: [positions.id] }),
  contracts:      many(contracts),
  leaveRequests:  many(leaveRequests),
  attendanceRecords: many(attendance),
  payrollLines:   many(payrollLines),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  employee: one(employees, { fields: [contracts.employeeId], references: [employees.id] }),
  grant:    one(grants, { fields: [contracts.grantId], references: [grants.id] }),
  budgetLine: one(grantBudgetLines, { fields: [contracts.budgetLineId], references: [grantBudgetLines.id] }),
  currency: one(currencies, { fields: [contracts.currencyId], references: [currencies.id] }),
  payrollLines: many(payrollLines),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  processedByUser: one(users, { fields: [payrollRuns.processedBy], references: [users.id] }),
  approvedByUser:  one(users, { fields: [payrollRuns.approvedBy], references: [users.id] }),
  currency: one(currencies, { fields: [payrollRuns.currencyId], references: [currencies.id] }),
  lines:    many(payrollLines),
}));

export const payrollLinesRelations = relations(payrollLines, ({ one }) => ({
  payrollRun: one(payrollRuns, { fields: [payrollLines.payrollRunId], references: [payrollRuns.id] }),
  employee:   one(employees, { fields: [payrollLines.employeeId], references: [employees.id] }),
  contract:   one(contracts, { fields: [payrollLines.contractId], references: [contracts.id] }),
  grant:      one(grants, { fields: [payrollLines.grantId], references: [grants.id] }),
  budgetLine: one(grantBudgetLines, { fields: [payrollLines.budgetLineId], references: [grantBudgetLines.id] }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
  approvedByUser: one(users, { fields: [leaveRequests.approvedBy], references: [users.id] }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, { fields: [attendance.employeeId], references: [employees.id] }),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  manager: one(users, { fields: [warehouses.managerId], references: [users.id] }),
  stockMovements: many(stockMovements),
}));

export const itemCategoriesRelations = relations(itemCategories, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  category: one(itemCategories, { fields: [items.categoryId], references: [itemCategories.id] }),
  stockMovements: many(stockMovements),
  assets: many(assets),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  item:      one(items, { fields: [stockMovements.itemId], references: [items.id] }),
  warehouse: one(warehouses, { fields: [stockMovements.warehouseId], references: [warehouses.id] }),
  grant:     one(grants, { fields: [stockMovements.grantId], references: [grants.id] }),
  performedByUser: one(users, { fields: [stockMovements.performedBy], references: [users.id] }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  item:      one(items, { fields: [assets.itemId], references: [items.id] }),
  grant:     one(grants, { fields: [assets.grantId], references: [grants.id] }),
  po:        one(purchaseOrders, { fields: [assets.poId], references: [purchaseOrders.id] }),
  assignedToUser: one(users, { fields: [assets.assignedTo], references: [users.id] }),
  warehouse: one(warehouses, { fields: [assets.warehouseId], references: [warehouses.id] }),
  depreciationSchedules: many(depreciationSchedules),
}));

export const depreciationSchedulesRelations = relations(depreciationSchedules, ({ one }) => ({
  asset: one(assets, { fields: [depreciationSchedules.assetId], references: [assets.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  currency: one(currencies, { fields: [accounts.currencyId], references: [currencies.id] }),
  journalLines: many(journalLines),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  fiscalPeriod: one(fiscalPeriods, { fields: [journalEntries.fiscalPeriodId], references: [fiscalPeriods.id] }),
  grant:        one(grants, { fields: [journalEntries.grantId], references: [grants.id] }),
  currency:     one(currencies, { fields: [journalEntries.currencyId], references: [currencies.id] }),
  lines:        many(journalLines),
}));

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, { fields: [journalLines.journalEntryId], references: [journalEntries.id] }),
  account:      one(accounts, { fields: [journalLines.accountId], references: [accounts.id] }),
  grant:        one(grants, { fields: [journalLines.grantId], references: [grants.id] }),
}));

export const exchangeRateHistoryRelations = relations(exchangeRateHistory, ({ one }) => ({
  currency: one(currencies, { fields: [exchangeRateHistory.currencyId], references: [currencies.id] }),
}));

export const fxRevaluationsRelations = relations(fxRevaluations, ({ one }) => ({
  grant:        one(grants, { fields: [fxRevaluations.grantId], references: [grants.id] }),
  account:      one(accounts, { fields: [fxRevaluations.accountId], references: [accounts.id] }),
  currency:     one(currencies, { fields: [fxRevaluations.currencyId], references: [currencies.id] }),
  journalEntry: one(journalEntries, { fields: [fxRevaluations.journalEntryId], references: [journalEntries.id] }),
}));

export const beneficiariesRelations = relations(beneficiaries, ({ one, many }) => ({
  grant:           one(grants, { fields: [beneficiaries.grantId], references: [grants.id] }),
  verifier:        one(users, { fields: [beneficiaries.verifiedBy], references: [users.id] }),
  householdMembers: many(householdMembers),
  cases:           many(caseRecords),
  distributions:   many(distributions),
}));

export const householdMembersRelations = relations(householdMembers, ({ one }) => ({
  beneficiary: one(beneficiaries, { fields: [householdMembers.beneficiaryId], references: [beneficiaries.id] }),
}));

export const caseRecordsRelations = relations(caseRecords, ({ one, many }) => ({
  beneficiary: one(beneficiaries, { fields: [caseRecords.beneficiaryId], references: [beneficiaries.id] }),
  assignee:    one(users, { fields: [caseRecords.assignedTo], references: [users.id] }),
  notes:       many(caseNotes),
}));

export const caseNotesRelations = relations(caseNotes, ({ one }) => ({
  caseRecord: one(caseRecords, { fields: [caseNotes.caseId], references: [caseRecords.id] }),
}));

export const distributionsRelations = relations(distributions, ({ one }) => ({
  beneficiary: one(beneficiaries, { fields: [distributions.beneficiaryId], references: [beneficiaries.id] }),
  grant:       one(grants, { fields: [distributions.grantId], references: [grants.id] }),
  item:        one(items, { fields: [distributions.itemId], references: [items.id] }),
  distributor: one(users, { fields: [distributions.distributedBy], references: [users.id] }),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  subGrants: many(subGrants),
}));

export const subGrantsRelations = relations(subGrants, ({ one, many }) => ({
  parentGrant: one(grants, { fields: [subGrants.parentGrantId], references: [grants.id] }),
  partner:     one(partners, { fields: [subGrants.partnerId], references: [partners.id] }),
  currency:    one(currencies, { fields: [subGrants.currencyId], references: [currencies.id] }),
  disbursements: many(subGrantDisbursements),
  reports:       many(partnerReports),
}));

export const subGrantDisbursementsRelations = relations(subGrantDisbursements, ({ one }) => ({
  subGrant: one(subGrants, { fields: [subGrantDisbursements.subGrantId], references: [subGrants.id] }),
  approver: one(users, { fields: [subGrantDisbursements.approvedBy], references: [users.id] }),
}));

export const partnerReportsRelations = relations(partnerReports, ({ one }) => ({
  subGrant: one(subGrants, { fields: [partnerReports.subGrantId], references: [subGrants.id] }),
  reviewer: one(users, { fields: [partnerReports.reviewedBy], references: [users.id] }),
}));

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  assignedDriver: one(drivers, { fields: [vehicles.assignedDriverId], references: [drivers.id] }),
  warehouse:      one(warehouses, { fields: [vehicles.warehouseId], references: [warehouses.id] }),
  trips:          many(vehicleTrips),
  fuelLogs:       many(fuelLogs),
  maintenanceRecords: many(maintenanceRecords),
}));

export const driversRelations = relations(drivers, ({ many }) => ({
  trips: many(vehicleTrips),
}));

export const vehicleTripsRelations = relations(vehicleTrips, ({ one }) => ({
  vehicle: one(vehicles, { fields: [vehicleTrips.vehicleId], references: [vehicles.id] }),
  driver:  one(drivers, { fields: [vehicleTrips.driverId], references: [drivers.id] }),
  grant:   one(grants, { fields: [vehicleTrips.grantId], references: [grants.id] }),
}));

export const fuelLogsRelations = relations(fuelLogs, ({ one }) => ({
  vehicle: one(vehicles, { fields: [fuelLogs.vehicleId], references: [vehicles.id] }),
}));

export const maintenanceRecordsRelations = relations(maintenanceRecords, ({ one }) => ({
  vehicle: one(vehicles, { fields: [maintenanceRecords.vehicleId], references: [vehicles.id] }),
  vendor:  one(vendors, { fields: [maintenanceRecords.vendorId], references: [vendors.id] }),
}));

export const complaintsRelations = relations(complaints, ({ one, many }) => ({
  beneficiary: one(beneficiaries, { fields: [complaints.beneficiaryId], references: [beneficiaries.id] }),
  grant:       one(grants, { fields: [complaints.grantId], references: [grants.id] }),
  assignee:    one(users, { fields: [complaints.assignedTo], references: [users.id] }),
  updates:     many(complaintUpdates),
}));

export const complaintUpdatesRelations = relations(complaintUpdates, ({ one }) => ({
  complaint: one(complaints, { fields: [complaintUpdates.complaintId], references: [complaints.id] }),
}));

export const screeningRecordsRelations = relations(screeningRecords, ({ one }) => ({
  screenedByUser: one(users, { fields: [screeningRecords.screenedBy], references: [users.id] }),
}));
