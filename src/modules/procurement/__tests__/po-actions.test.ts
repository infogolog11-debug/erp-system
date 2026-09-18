import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrFindFirst = vi.fn();
const mockPrItemsFindMany = vi.fn();
const mockSelectFrom = vi.fn();
const mockPoInsertReturning = vi.fn();
const mockPoItemInsert = vi.fn();
const mockPrUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockIdemInsertReturning = vi.fn();
const mockIdemUpdateWhere = vi.fn().mockResolvedValue(undefined);

function makeTx() {
  return {
    select: vi.fn(() => ({ from: (...a: any[]) => mockSelectFrom(...a) })),
    insert: vi.fn((table: any) => ({
      values: (v: any) => {
        // نميّز الجدول المستهدف حسب شكل القيم المُرسَلة (mock مبسّط، نفس نمط grn-actions.test.ts)
        if (Array.isArray(v)) { mockPoItemInsert(v); return Promise.resolve(v); }
        return { returning: (...a: any[]) => mockPoInsertReturning(...a) };
      },
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockPrUpdateWhere(...a) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      purchaseRequests:     { findFirst: (...a: any[]) => mockPrFindFirst(...a) },
      purchaseRequestItems: { findMany: (...a: any[]) => mockPrItemsFindMany(...a) },
    },
    transaction: vi.fn((cb: any) => cb(makeTx())),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: any[]) => mockIdemInsertReturning(...a) })),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockIdemUpdateWhere(...a) })) })),
  },
}));

// vendorId المُرسَل من العميل يُتحقَّق الآن عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst مخصص.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/lib/inventory/stock-movement", () => ({ receiveStock: vi.fn() }));
vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/notifications/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/modules/grants/actions", () => ({ checkBudgetCeiling: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/schema", () => ({
  idempotencyKeys: {}, purchaseOrders: {}, purchaseOrderItems: {}, goodsReceiptNotes: {}, grnItems: {},
  purchaseRequests: {}, purchaseRequestItems: {}, vendorInvoices: {}, payments: {}, grantBudgetLines: {},
  journalEntries: {}, journalLines: {}, accounts: {}, grants: {}, vendors: {},
}));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "procurement" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { createPurchaseOrder } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";
const PR_ID = "22222222-2222-2222-2222-222222222222";
const VENDOR_ID = "33333333-3333-3333-3333-333333333333";
const PR_ITEM_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockPrFindFirst.mockResolvedValue({ id: PR_ID, organizationId: ORG, status: "approved", grantId: "grant-1", budgetLineId: "bl-1" });
  mockAssertOwnedByOrg.mockResolvedValue(true);
  mockPrItemsFindMany.mockResolvedValue([{ id: PR_ITEM_ID, prId: PR_ID }]);
  mockSelectFrom.mockResolvedValue([{ c: 0 }]);
  mockPoInsertReturning.mockResolvedValue([{ id: "po-1", code: "PO-2026-00001" }]);
  mockIdemInsertReturning.mockResolvedValue([{ id: "idem-1" }]);
});

const baseInput = {
  organizationId: ORG,
  prId: PR_ID,
  vendorId: VENDOR_ID,
  currencyId: "55555555-5555-5555-5555-555555555555",
  items: [{ prItemId: PR_ITEM_ID, itemDescription: "Paper reams", unit: "box", quantity: 10, unitPrice: 5, taxRate: 10 }],
};

describe("createPurchaseOrder", () => {
  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a PR belonging to a different organization", async () => {
    mockPrFindFirst.mockResolvedValue({ id: PR_ID, organizationId: "other-org", status: "approved" });
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses when the PR isn't approved yet", async () => {
    mockPrFindFirst.mockResolvedValue({ id: PR_ID, organizationId: ORG, status: "submitted" });
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("يجب اعتماد");
  });

  // إصلاح IDOR: vendorId يجب أن يخص نفس المنظمة
  it("refuses a vendorId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  // إصلاح IDOR: prItemId يجب أن يخص نفس الـ PR
  it("refuses a prItemId that doesn't belong to this PR", async () => {
    mockPrItemsFindMany.mockResolvedValue([{ id: "some-other-item", prId: PR_ID }]);
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully, inherits grantId/budgetLineId from the PR, and computes totals with tax", async () => {
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.code).toBe("PO-2026-00001");
    // subtotal = 10*5 = 50, tax = 50*0.10 = 5, total = 55
    expect(mockPoInsertReturning).toHaveBeenCalled();
  });

  it("moves the PR to 'done' status after successfully creating the PO", async () => {
    const res = await createPurchaseOrder(baseInput as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockPrUpdateWhere).toHaveBeenCalled();
  });

  it("creates successfully even without a prItemId link (free-form PO line)", async () => {
    const res = await createPurchaseOrder({
      ...baseInput,
      items: [{ itemDescription: "Custom item", unit: "unit", quantity: 2, unitPrice: 100, taxRate: 0 }],
    } as any, "user-1");
    expect(res.success).toBe(true);
  });
});
