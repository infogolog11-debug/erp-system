import { describe, it, expect, vi, beforeEach } from "vitest";
import { grants } from "@/db/schema";

const mockInsertReturning = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateWhere = vi.fn();
const mockBudgetLineFindFirst = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    query: {
      grants: { findFirst: (...a: any[]) => mockFindFirst(...a) },
      grantBudgetLines: { findFirst: (...a: any[]) => mockBudgetLineFindFirst(...a) },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
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

import { createGrant, approveGrant, checkBudgetCeiling } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockInsertReturning.mockResolvedValue([{ id: "grant-1" }]);
});

describe("createGrant", () => {
  const baseInput = {
    organizationId: ORG,
    donorId: "22222222-2222-2222-2222-222222222222",
    currencyId: "33333333-3333-3333-3333-333333333333",
    code: "G-2026-001",
    name: "Test Grant",
    totalAmount: 100000,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  };

  it("rejects invalid input", async () => {
    const res = await createGrant({ ...baseInput, totalAmount: -5 }, "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createGrant(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects when the claimed organizationId doesn't match the session", async () => {
    const res = await createGrant({ ...baseInput, organizationId: "other-org" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully with valid input and matching org", async () => {
    const res = await createGrant(baseInput, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("approveGrant", () => {
  it("rejects when the caller lacks approve permission", async () => {
    mockSessionOk = false;
    const res = await approveGrant("grant-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("returns an error when the grant doesn't exist", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await approveGrant("grant-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("refuses to approve a grant belonging to a different organization", async () => {
    mockFindFirst.mockResolvedValue({ id:"grant-1", organizationId:"other-org", status:"submitted", name:"X" });
    const res = await approveGrant("grant-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("approves successfully when the grant is in a valid transition state", async () => {
    mockFindFirst.mockResolvedValue({ id:"grant-1", organizationId:ORG, status:"submitted", name:"X", grantManagerId:null });
    const res = await approveGrant("grant-1", "user-1", ORG);
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("checkBudgetCeiling", () => {
  it("blocks a request exceeding the available budget", async () => {
    mockBudgetLineFindFirst.mockResolvedValue({ organizationId:ORG, plannedAmount:"1000", committedAmount:"200", spentAmount:"300" });
    const res = await checkBudgetCeiling(ORG, "line-1", 600);
    expect(res.canProceed).toBe(false);
    expect(res.available).toBe(500);
  });

  it("allows a request within the available budget", async () => {
    mockBudgetLineFindFirst.mockResolvedValue({ organizationId:ORG, plannedAmount:"1000", committedAmount:"200", spentAmount:"300" });
    const res = await checkBudgetCeiling(ORG, "line-1", 400);
    expect(res.canProceed).toBe(true);
  });

  it("returns an error when the budget line doesn't exist", async () => {
    mockBudgetLineFindFirst.mockResolvedValue(null);
    const res = await checkBudgetCeiling(ORG, "line-1", 100);
    expect(res.canProceed).toBe(false);
  });

  // إصلاح IDOR: بند ميزانية موجود فعلاً لكنه يخص منظمة أخرى يجب أن يُرفض
  // بنفس رسالة "غير موجود" — لا يجوز لمنظمة A رؤية أو التأثير على أرقام
  // ميزانية منظمة B عبر تخمين/تسريب معرّف بند تابع لها.
  it("refuses a budget line belonging to a different organization, same as not-found", async () => {
    mockBudgetLineFindFirst.mockResolvedValue({ organizationId:"other-org", plannedAmount:"1000", committedAmount:"0", spentAmount:"0" });
    const res = await checkBudgetCeiling(ORG, "line-1", 100);
    expect(res.canProceed).toBe(false);
    expect(res.available).toBe(0);
  });
});
