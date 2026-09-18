import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTxInsertReturning = vi.fn();
const mockTxInsertValues = vi.fn();
const mockSelectFrom = vi.fn();
const mockPrFindFirst = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);

function makeTx() {
  return {
    insert: vi.fn(() => ({
      values: (v: any) => { mockTxInsertValues(v); return { returning: mockTxInsertReturning }; },
    })),
  };
}

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({ from: (...a: any[]) => mockSelectFrom(...a) })),
    query: {
      purchaseRequests: { findFirst: (...a: any[]) => mockPrFindFirst(...a) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

// grantId المُرسَل من العميل يُتحقَّق الآن عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst مخصص.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/modules/grants/actions", () => ({
  checkBudgetCeiling: vi.fn(),
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined), notifyMany: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "procurement" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { createPurchaseRequest } from "../actions";
import { checkBudgetCeiling } from "@/modules/grants/actions";

const ORG = "11111111-1111-1111-1111-111111111111";
const mockCheckBudgetCeiling = checkBudgetCeiling as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockTxInsertReturning.mockResolvedValue([{ id: "pr-1" }]);
  mockSelectFrom.mockResolvedValue([{ c: 0 }]);
  mockCheckBudgetCeiling.mockResolvedValue({ canProceed: true });
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("createPurchaseRequest", () => {
  const baseInput = {
    organizationId: ORG,
    title: "Office supplies",
    requestedBy: "22222222-2222-2222-2222-222222222222", priority: "medium" as const,
    items: [{ itemDescription: "Paper reams", unit: "box", quantity: 10 }],
  };

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createPurchaseRequest(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("blocks creation when the budget ceiling check fails", async () => {
    mockCheckBudgetCeiling.mockResolvedValue({ canProceed: false, message: "تجاوز الحد المتاح" });
    const res = await createPurchaseRequest({
      ...baseInput, budgetLineId: "33333333-3333-3333-3333-333333333333", estimatedTotal: 5000,
    }, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("تجاوز الميزانية");
  });

  it("creates successfully when within the budget ceiling", async () => {
    mockCheckBudgetCeiling.mockResolvedValue({ canProceed: true });
    const res = await createPurchaseRequest({
      ...baseInput, budgetLineId: "33333333-3333-3333-3333-333333333333", estimatedTotal: 500,
    }, "user-1");
    expect(res.success).toBe(true);
  });

  it("creates successfully without a budget line (no ceiling check needed)", async () => {
    const res = await createPurchaseRequest(baseInput, "user-1");
    expect(res.success).toBe(true);
    expect(mockCheckBudgetCeiling).not.toHaveBeenCalled();
  });

  it("rejects when the claimed org doesn't match the session", async () => {
    const res = await createPurchaseRequest({ ...baseInput, organizationId: "other-org" }, "user-1");
    expect(res.success).toBe(false);
  });

  // إصلاح IDOR: grantId مُرسَل من العميل يجب أن يخص نفس المنظمة، وإلا يُرفض
  // قبل أي كتابة — راجع الشرح الكامل في src/modules/procurement/actions.ts
  it("rejects a grantId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await createPurchaseRequest({
      ...baseInput, grantId: "44444444-4444-4444-4444-444444444444",
    }, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("المنحة");
    expect(mockTxInsertValues).not.toHaveBeenCalled();
  });

  it("rejects when the grantId doesn't exist at all", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await createPurchaseRequest({
      ...baseInput, grantId: "44444444-4444-4444-4444-444444444444",
    }, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully with a grantId that belongs to the same organization", async () => {
    const res = await createPurchaseRequest({
      ...baseInput, grantId: "44444444-4444-4444-4444-444444444444",
    }, "user-1");
    expect(res.success).toBe(true);
  });
});
