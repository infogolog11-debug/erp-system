import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAssetFindFirst = vi.fn();
const mockScheduleFindFirst = vi.fn();

function makeTx() {
  return {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id:"sched-1" }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      assets: { findFirst: (...a: any[]) => mockAssetFindFirst(...a) },
      depreciationSchedules: { findFirst: (...a: any[]) => mockScheduleFindFirst(...a) },
    },
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "inventory" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { runMonthlyDepreciation } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockScheduleFindFirst.mockResolvedValue(null);
});

describe("runMonthlyDepreciation", () => {
  const validAsset = {
    id: "asset-1", organizationId: ORG,
    usefulLifeYears: 5, purchaseCost: "10000", salvageValue: "1000",
    currentValue: "10000", depreciationMethod: "straight_line",
    purchaseDate: new Date("2024-01-01"),
  };

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("returns an error when the asset doesn't exist", async () => {
    mockAssetFindFirst.mockResolvedValue(null);
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("refuses to process an asset belonging to a different organization (IDOR guard)", async () => {
    mockAssetFindFirst.mockResolvedValue({ ...validAsset, organizationId: "other-org" });
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("blocks a duplicate depreciation entry for the same period", async () => {
    mockAssetFindFirst.mockResolvedValue(validAsset);
    mockScheduleFindFirst.mockResolvedValue({ id: "existing-sched" });
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مسجل مسبقاً");
  });

  it("processes successfully for a valid, complete asset", async () => {
    mockAssetFindFirst.mockResolvedValue(validAsset);
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(true);
  });

  it("rejects an asset with incomplete depreciation data", async () => {
    mockAssetFindFirst.mockResolvedValue({ ...validAsset, usefulLifeYears: null });
    const res = await runMonthlyDepreciation("asset-1", "2026-01", "user-1", ORG);
    expect(res.success).toBe(false);
  });
});
