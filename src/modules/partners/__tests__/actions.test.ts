import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertReturning = vi.fn();
const mockPartnerFindFirst = vi.fn();
const mockSubGrantFindFirst = vi.fn();
const mockSelectWhere = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockDisbUpdateGuard = vi.fn();
const mockDisbInsertReturning = vi.fn();

function makeTx() {
  return {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => ({ returning: (...b: any[]) => mockDisbUpdateGuard(...a, ...b) }) })) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: (...a: any[]) => mockDisbInsertReturning(...a) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: (...a: any[]) => mockSelectWhere(...a) })) })),
    query: {
      partners: { findFirst: (...a: any[]) => mockPartnerFindFirst(...a) },
      subGrants: { findFirst: (...a: any[]) => mockSubGrantFindFirst(...a) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "finance" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

// إصلاح IDOR (v35): createSubGrant تتحقق أن parentGrantId فعلاً تابع لنفس
// المنظمة قبل الإنشاء — عبر assertOwnedByOrg الموحّدة (src/lib/auth/ownership.ts،
// أُدخلت v37 بدل استعلام findFirst مخصص). لها اختباراتها المستقلة بـ ownership.test.ts.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

import { createPartner, updateDueDiligence, createSubGrant, createDisbursement } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockInsertReturning.mockResolvedValue([{ id: "record-1" }]);
  mockSelectWhere.mockResolvedValue([{ cnt: 0 }]);
  mockDisbUpdateGuard.mockResolvedValue([{ id: "sg-1" }]); // الحارس الذرّي ينجح افتراضياً
  mockDisbInsertReturning.mockResolvedValue([{ id: "disb-1" }]);
  // افتراضياً: المنحة الأم (parentGrantId) تابعة لنفس المنظمة
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("createPartner", () => {
  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createPartner({ organizationId: ORG, name:"Org A", partnerType:"local_ngo" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully with valid input", async () => {
    const res = await createPartner({ organizationId: ORG, name:"Org A", partnerType:"local_ngo" }, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("updateDueDiligence", () => {
  it("rejects when the claimed org doesn't match the session", async () => {
    const res = await updateDueDiligence("partner-1", "other-org", "user-1", "cleared");
    expect(res.success).toBe(false);
  });

  it("updates successfully with a matching org", async () => {
    const res = await updateDueDiligence("partner-1", ORG, "user-1", "cleared");
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("createSubGrant", () => {
  const baseInput = {
    organizationId: ORG,
    parentGrantId: "22222222-2222-2222-2222-222222222222",
    partnerId: "33333333-3333-3333-3333-333333333333",
    currencyId: "44444444-4444-4444-4444-444444444444",
    title: "Sub Grant A", totalAmount: 5000,
    startDate: "2026-01-01", endDate: "2026-06-30",
  };

  it("blocks creation when the partner failed due diligence", async () => {
    mockPartnerFindFirst.mockResolvedValue({ id:"partner-1", organizationId: ORG, dueDiligenceStatus:"rejected" });
    const res = await createSubGrant(baseInput, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مرفوض");
  });

  it("creates successfully when the partner passed due diligence", async () => {
    mockPartnerFindFirst.mockResolvedValue({ id:"partner-1", organizationId: ORG, dueDiligenceStatus:"cleared" });
    const res = await createSubGrant(baseInput, "user-1");
    expect(res.success).toBe(true);
  });

  it("returns an error when the partner doesn't exist", async () => {
    mockPartnerFindFirst.mockResolvedValue(null);
    const res = await createSubGrant(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  // ─── إصلاح IDOR (v35): partnerId/parentGrantId لم يكونا يُتحقَّق من ملكيتهما ─
  it("rejects when the partner belongs to a different organization", async () => {
    mockPartnerFindFirst.mockResolvedValue({ id:"partner-1", organizationId: "other-org", dueDiligenceStatus:"cleared" });
    const res = await createSubGrant(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects when the parent grant belongs to a different organization", async () => {
    mockPartnerFindFirst.mockResolvedValue({ id:"partner-1", organizationId: ORG, dueDiligenceStatus:"cleared" });
    mockAssertOwnedByOrg.mockResolvedValue(false);
    const res = await createSubGrant(baseInput, "user-1");
    expect(res.success).toBe(false);
  });
});

describe("createDisbursement", () => {
  const baseInput = {
    organizationId: ORG, subGrantId: "55555555-5555-5555-5555-555555555555", amount: 1000,
  };

  it("blocks a disbursement exceeding the remaining sub-grant balance", async () => {
    mockSubGrantFindFirst.mockResolvedValue({ id:"sg-1", organizationId:ORG, totalAmount:"5000", disbursedAmount:"4500" });
    const res = await createDisbursement(baseInput, "partner-1", "user-1"); // remaining = 500, amount = 1000
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("يتجاوز الرصيد المتبقي");
  });

  it("allows a disbursement within the remaining balance", async () => {
    mockSubGrantFindFirst.mockResolvedValue({ id:"sg-1", organizationId:ORG, totalAmount:"5000", disbursedAmount:"1000" });
    const res = await createDisbursement(baseInput, "partner-1", "user-1"); // remaining = 4000
    expect(res.success).toBe(true);
  });

  it("refuses a disbursement against a sub-grant from a different organization", async () => {
    mockSubGrantFindFirst.mockResolvedValue({ id:"sg-1", organizationId:"other-org", totalAmount:"5000", disbursedAmount:"0" });
    const res = await createDisbursement(baseInput, "partner-1", "user-1");
    expect(res.success).toBe(false);
  });

  // ─── إصلاح Race Condition (v35) ─────────────────────────────────
  it("rejects when the atomic guarded UPDATE affects zero rows — the concurrent-disbursement case the earlier read-then-check alone could not catch", async () => {
    mockSubGrantFindFirst.mockResolvedValue({ id:"sg-1", organizationId:ORG, totalAmount:"5000", disbursedAmount:"1000" }); // يمرّ الفحص الإرشادي (remaining=4000)
    mockDisbUpdateGuard.mockResolvedValueOnce([]); // لكن الحارس الذرّي يرفض — معاملة متزامنة استهلكت الرصيد
    const res = await createDisbursement(baseInput, "partner-1", "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("يتجاوز الرصيد المتبقي");
    expect(mockDisbInsertReturning).not.toHaveBeenCalled(); // لا يُدرَج سند صرف لو رُفض الحارس
  });
});
