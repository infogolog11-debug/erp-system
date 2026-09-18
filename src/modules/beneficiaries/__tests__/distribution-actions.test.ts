import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIssueStock = vi.fn();
const mockDistInsertReturning = vi.fn();
const mockIdemInsertReturning = vi.fn();
const mockIdemFindFirst = vi.fn();
const mockIdemUpdateWhere = vi.fn().mockResolvedValue(undefined);

function makeTx() {
  return {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: (...a: any[]) => mockDistInsertReturning(...a) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      idempotencyKeys: { findFirst: (...a: any[]) => mockIdemFindFirst(...a) },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: any[]) => mockIdemInsertReturning(...a) })),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockIdemUpdateWhere(...a) })) })),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

// beneficiaryId/grantId المُرسَلان من العميل يُتحقَّقان الآن عبر assertOwnedByOrg
// الموحّدة (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst
// مخصص لكل حقل. استدعاءان منفصلان بنفس ترتيب الكود (المستفيد أولاً، ثم المنحة).
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/lib/inventory/stock-movement", () => ({
  issueStock: (...a: any[]) => mockIssueStock(...a),
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/guard", () => ({
  requireSession: vi.fn().mockResolvedValue({ ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "super_admin" }),
  requirePermission: vi.fn().mockResolvedValue({ ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "super_admin" }),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { createDistribution } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";
const baseInput = {
  organizationId: ORG,
  beneficiaryId: "22222222-2222-2222-2222-222222222222",
  grantId: "33333333-3333-3333-3333-333333333333",
  itemId: "44444444-4444-4444-4444-444444444444",
  distributionType: "in_kind" as const,
  quantity: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIssueStock.mockResolvedValue({ success: true, balanceQty: 5, balanceAvgCost: 10 });
  mockDistInsertReturning.mockResolvedValue([{ id: "dist-1" }]);
  mockIdemInsertReturning.mockResolvedValue([{ id: "idem-1" }]);
  mockIdemFindFirst.mockResolvedValue(undefined);
  // افتراضياً: المستفيد والمنحة تابعان لنفس منظمة الطلب
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("createDistribution", () => {
  it("rejects an in-kind distribution without an item", async () => {
    const res = await createDistribution({ ...baseInput, itemId: undefined } as any, "user-1");
    expect(res.success).toBe(false);
  });

  it("propagates the insufficient-stock error from issueStock instead of a generic failure", async () => {
    mockIssueStock.mockResolvedValue({ success: false, error: "المخزون غير كافٍ — المتاح 2" });
    const res = await createDistribution(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير كافٍ");
    // لا يُنشأ سجل توزيع إذا فشل خصم المخزون (كلاهما بنفس المعاملة)
    expect(mockDistInsertReturning).not.toHaveBeenCalled();
  });

  it("creates the distribution after a successful atomic stock issue", async () => {
    const res = await createDistribution(baseInput as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockIssueStock).toHaveBeenCalledTimes(1);
    expect(mockDistInsertReturning).toHaveBeenCalledTimes(1);
  });

  it("does not touch stock at all for a pure cash distribution", async () => {
    const res = await createDistribution({ ...baseInput, itemId: undefined, quantity: undefined, distributionType: "cash", cashAmount: 100 } as any, "user-1");
    expect(res.success).toBe(true);
    expect(mockIssueStock).not.toHaveBeenCalled();
  });

  // ─── IDOR: تحقق أن المستفيد/المنحة فعلاً يتبعان نفس المنظمة ───
  // هذا الفحص كان غائباً تماماً قبل هذا الإصلاح — assertOrgMatches كانت
  // تتحقق فقط من organizationId المُرسَل، لا من ملكية السجلات المرتبطة.
  it("rejects when the beneficiary belongs to a different organization (cross-tenant IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false); // beneficiary check (first call)
    const res = await createDistribution(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("لا يتبع هذه المنظمة");
    expect(mockDistInsertReturning).not.toHaveBeenCalled();
  });

  it("rejects when the grant belongs to a different organization (cross-tenant IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // beneficiary: ok, grant: IDOR
    const res = await createDistribution(baseInput as any, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("لا تتبع هذه المنظمة");
    expect(mockDistInsertReturning).not.toHaveBeenCalled();
  });

  it("rejects when the beneficiary id does not exist at all", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false); // beneficiary check (first call)
    const res = await createDistribution(baseInput as any, "user-1");
    expect(res.success).toBe(false);
  });
});
