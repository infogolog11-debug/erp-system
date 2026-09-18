import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelectGroupBy = vi.fn();
const mockItemsFindMany = vi.fn();
const mockUsersFindMany = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: (...a: any[]) => mockSelectGroupBy(...a),
        })),
      })),
    })),
    query: {
      items: { findMany: (...a: any[]) => mockItemsFindMany(...a) },
      users: { findMany: (...a: any[]) => mockUsersFindMany(...a) },
    },
  },
}));

const mockNotifyMany = vi.fn();
vi.mock("@/core/notifications/notify", () => ({
  notifyMany: (...a: any[]) => mockNotifyMany(...a),
}));

import { reconcileStockLedger } from "../reconcile-stock";

const ORG = "org-a";

beforeEach(() => {
  vi.clearAllMocks();
  mockNotifyMany.mockResolvedValue(undefined);
  mockSelectGroupBy.mockResolvedValue([]);
  mockItemsFindMany.mockResolvedValue([]);
  mockUsersFindMany.mockResolvedValue([]);
});

describe("reconcileStockLedger", () => {
  it("reports no mismatches and sends no alert when currentStock matches the ledger exactly", async () => {
    mockSelectGroupBy.mockResolvedValue([{ itemId: "item-1", ledgerBalance: "42.000" }]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: null, currentStock: "42.000" },
    ]);

    const summary = await reconcileStockLedger(ORG);

    expect(summary.totalItemsChecked).toBe(1);
    expect(summary.mismatches).toHaveLength(0);
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });

  it("ignores floating-point noise below the epsilon threshold", async () => {
    mockSelectGroupBy.mockResolvedValue([{ itemId: "item-1", ledgerBalance: "42.0001" }]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: null, currentStock: "42.000" },
    ]);

    const summary = await reconcileStockLedger(ORG);
    expect(summary.mismatches).toHaveLength(0);
  });

  it("flags a real mismatch, computes the signed difference, and alerts — without modifying any balance", async () => {
    mockSelectGroupBy.mockResolvedValue([{ itemId: "item-1", ledgerBalance: "40.000" }]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: "قطعة", currentStock: "42.500" },
    ]);
    mockUsersFindMany.mockResolvedValue([
      { id: "u-fin", role: "finance_manager" },
      { id: "u-wh", role: "warehouse_manager" },
      { id: "u-viewer", role: "viewer" },
    ]);

    const summary = await reconcileStockLedger(ORG);

    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0]).toMatchObject({
      itemId: "item-1", currentStock: 42.5, ledgerBalance: 40, difference: 2.5,
    });

    expect(mockNotifyMany).toHaveBeenCalledTimes(1);
    const [notifiedIds, params] = mockNotifyMany.mock.calls[0];
    // فقط finance_manager/warehouse_manager (وadmin/super_admin) — لا viewer
    expect(notifiedIds.sort()).toEqual(["u-fin", "u-wh"]);
    expect(params.sendEmail).toBe(true);
    expect(params.organizationId).toBe(ORG);
  });

  // الفحص الحاسم المطلوب صراحة: تسجيل وتنبيه فقط، بلا تصحيح تلقائي مباشر
  it("never calls db.update — this job only reads and alerts, it never writes", async () => {
    const { db } = await import("@/db");
    mockSelectGroupBy.mockResolvedValue([{ itemId: "item-1", ledgerBalance: "40.000" }]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: null, currentStock: "42.500" },
    ]);

    await reconcileStockLedger(ORG);

    expect((db as any).update).toBeUndefined();
  });

  it("treats an item with no ledger rows at all as a full mismatch against a nonzero currentStock", async () => {
    mockSelectGroupBy.mockResolvedValue([]); // لا حركات مسجَّلة إطلاقاً لهذا الصنف
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: null, currentStock: "10.000" },
    ]);

    const summary = await reconcileStockLedger(ORG);
    expect(summary.mismatches).toHaveLength(1);
    expect(summary.mismatches[0].ledgerBalance).toBe(0);
    expect(summary.mismatches[0].difference).toBe(10);
  });

  it("does not crash the whole run if no finance/warehouse staff exist for a mismatched organization", async () => {
    mockSelectGroupBy.mockResolvedValue([{ itemId: "item-1", ledgerBalance: "40.000" }]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: ORG, code: "ITM-1", name: "Widget", nameAr: null, currentStock: "42.500" },
    ]);
    mockUsersFindMany.mockResolvedValue([{ id: "u-viewer", role: "viewer" }]);

    const summary = await reconcileStockLedger(ORG);
    expect(summary.mismatches).toHaveLength(1);
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });

  it("groups mismatches per organization into separate alerts when scanning across all organizations", async () => {
    mockSelectGroupBy.mockResolvedValue([
      { itemId: "item-1", ledgerBalance: "40.000" },
      { itemId: "item-2", ledgerBalance: "5.000" },
    ]);
    mockItemsFindMany.mockResolvedValue([
      { id: "item-1", organizationId: "org-a", code: "A-1", name: "Widget A", nameAr: null, currentStock: "41.000" },
      { id: "item-2", organizationId: "org-b", code: "B-1", name: "Widget B", nameAr: null, currentStock: "6.000" },
    ]);
    mockUsersFindMany.mockResolvedValue([{ id: "u-fin", role: "finance_manager" }]);

    const summary = await reconcileStockLedger(); // بلا organizationId — كل المنظمات

    expect(summary.mismatches).toHaveLength(2);
    expect(mockNotifyMany).toHaveBeenCalledTimes(2); // نداء منفصل لكل منظمة
  });
});
