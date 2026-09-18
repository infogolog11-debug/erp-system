import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPoFindFirst = vi.fn();
const mockPoItemsFindMany = vi.fn();
const mockGrnInsertReturning = vi.fn();
const mockGrnItemInsert = vi.fn();
const mockPoItemUpdateWhere = vi.fn().mockResolvedValue([{ id: "po-item-updated" }]);
const mockSelectFrom = vi.fn();
const mockReceiveStock = vi.fn();
const mockIdemFindFirst = vi.fn();
const mockIdemInsertReturning = vi.fn();
const mockIdemUpdateWhere = vi.fn().mockResolvedValue(undefined);

function makeTx() {
  return {
    query: { purchaseOrderItems: { findMany: (...a: any[]) => mockPoItemsFindMany(...a) } },
    select: vi.fn(() => ({ from: (...a: any[]) => mockSelectFrom(...a) })),
    insert: vi.fn((table: any) => ({
      values: (v: any) => {
        // نميّز الجدول المستهدف حسب شكل القيم المُرسَلة بدل مطابقة اسم الجدول (mock مبسّط)
        if (v.code) return { returning: (...a: any[]) => mockGrnInsertReturning(...a) };
        mockGrnItemInsert(v);
        return Promise.resolve([v]);
      },
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => ({ returning: (...b: any[]) => mockPoItemUpdateWhere(...a, ...b) }) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: { purchaseOrders: { findFirst: (...a: any[]) => mockPoFindFirst(...a) } },
    transaction: vi.fn((cb: any) => cb(makeTx())),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: any[]) => mockIdemInsertReturning(...a) })),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockIdemUpdateWhere(...a) })) })),
  },
}));

vi.mock("@/lib/inventory/stock-movement", () => ({ receiveStock: (...a: any[]) => mockReceiveStock(...a) }));
vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/notifications/notify", () => ({ notify: vi.fn(), notifyMany: vi.fn() }));
vi.mock("@/modules/grants/actions", () => ({ checkBudgetCeiling: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db/schema", () => ({
  idempotencyKeys: {}, purchaseOrders: {}, purchaseOrderItems: {}, goodsReceiptNotes: {}, grnItems: {},
  purchaseRequests: {}, purchaseRequestItems: {}, vendorInvoices: {}, payments: {}, grantBudgetLines: {},
  journalEntries: {}, journalLines: {}, accounts: {},
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

import { createGoodsReceiptNote } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";
const PO_ID = "22222222-2222-2222-2222-222222222222";
const PO_ITEM_ID = "33333333-3333-3333-3333-333333333333";
const ITEM_ID = "44444444-4444-4444-4444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockPoFindFirst.mockResolvedValue({ id: PO_ID, organizationId: ORG, vendorId: "vendor-1", grantId: "grant-1" });
  mockPoItemsFindMany.mockResolvedValue([
    { id: PO_ITEM_ID, poId: PO_ID, itemId: ITEM_ID, itemDescription: "أكياس طحين", quantity: "100", unitPrice: "5", receivedQty: "0" },
  ]);
  mockGrnInsertReturning.mockResolvedValue([{ id: "grn-1", code: "GRN-2026-00001" }]);
  mockSelectFrom.mockResolvedValue([{ c: 0 }]);
  mockReceiveStock.mockResolvedValue({ success: true, balanceQty: 100, balanceAvgCost: 5 });
  mockIdemInsertReturning.mockResolvedValue([{ id: "idem-1" }]);
  mockIdemFindFirst.mockResolvedValue(undefined);
});

const baseInput = {
  organizationId: ORG,
  poId: PO_ID,
  items: [{ poItemId: PO_ITEM_ID, receivedQty: 60, rejectedQty: 0, condition: "good" as const }],
};

describe("createGoodsReceiptNote", () => {
  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createGoodsReceiptNote(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a PO from a different organization", async () => {
    mockPoFindFirst.mockResolvedValue({ id: PO_ID, organizationId: "other-org", vendorId: "v1" });
    const res = await createGoodsReceiptNote(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects receiving more than the ordered quantity (cumulative)", async () => {
    mockPoItemsFindMany.mockResolvedValue([
      { id: PO_ITEM_ID, poId: PO_ID, itemId: ITEM_ID, itemDescription: "أكياس طحين", quantity: "100", unitPrice: "5", receivedQty: "80" },
    ]);
    const res = await createGoodsReceiptNote({ ...baseInput, items: [{ poItemId: PO_ITEM_ID, receivedQty: 30, rejectedQty: 0, condition: "good" }] } as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("تتجاوز المطلوب");
  });

  it("calls receiveStock with the accepted quantity (received minus rejected), not the raw received quantity", async () => {
    const res = await createGoodsReceiptNote({
      ...baseInput,
      items: [{ poItemId: PO_ITEM_ID, receivedQty: 60, rejectedQty: 10, condition: "damaged" }],
    } as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockReceiveStock).toHaveBeenCalledTimes(1);
    const call = mockReceiveStock.mock.calls[0][1];
    expect(call.quantity).toBe(50); // 60 - 10
    expect(call.grantId).toBe("grant-1"); // مُمرَّر من أمر الشراء تلقائياً
  });

  it("does NOT call receiveStock for a PO line with no linked inventory item (service/one-off purchase)", async () => {
    mockPoItemsFindMany.mockResolvedValue([
      { id: PO_ITEM_ID, poId: PO_ID, itemId: null, itemDescription: "استشارة قانونية", quantity: "1", unitPrice: "500", receivedQty: "0" },
    ]);
    const res = await createGoodsReceiptNote({ ...baseInput, items: [{ poItemId: PO_ITEM_ID, receivedQty: 1, rejectedQty: 0, condition: "good" }] } as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockReceiveStock).not.toHaveBeenCalled();
  });

  it("propagates an insufficient/failed stock update from receiveStock instead of silently succeeding", async () => {
    mockReceiveStock.mockResolvedValue({ success: false, error: "الصنف غير موجود" });
    const res = await createGoodsReceiptNote(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("الصنف غير موجود");
  });

  it("updates the PO line's cumulative receivedQty", async () => {
    const res = await createGoodsReceiptNote(baseInput as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockPoItemUpdateWhere).toHaveBeenCalled();
  });

  // ─── إصلاح Race Condition (v35) ─────────────────────────────────
  it("rejects when the atomic guarded UPDATE affects zero rows — the concurrent over-receipt case the earlier in-app check alone could not catch", async () => {
    // الفحص التطبيقي المسبق (findMany ثم مقارنة JS) يمرّ بلا مشكلة هنا،
    // لكن الـUPDATE الذرّي نفسه يرجع 0 صفوف — يحاكي معاملة GRN متزامنة
    // استهلكت الكمية المتبقية بين قراءتنا وكتابتنا.
    mockPoItemUpdateWhere.mockResolvedValueOnce([]);
    const res = await createGoodsReceiptNote(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("تتجاوز المطلوب");
  });
});
