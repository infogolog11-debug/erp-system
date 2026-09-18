import { describe, it, expect, vi, beforeEach } from "vitest";

const ORG = "11111111-1111-1111-1111-111111111111";

// ── Mocks ──────────────────────────────────────────────────
const mockInsertReturning = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/db", () => {
  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: mockInsertReturning,
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: mockUpdateWhere,
        })),
      })),
    },
  };
});

// إصلاح IDOR (v35): recordScreening تتحقق أن الكيان المُشار إليه (entityId)
// فعلاً تابع لنفس المنظمة قبل الإدراج — عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، أُدخلت v37 بدل أربع استعلامات findFirst منفصلة).
// الدالة نفسها لها اختباراتها المستقلة بـ ownership.test.ts؛ هنا نكتفي بمحاكاتها
// كـ true/false حسب سيناريو كل اختبار.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/core/audit/audit-trail", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/guard", () => ({
  requireSession: vi.fn().mockResolvedValue({ ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "super_admin" }),
  requirePermission: vi.fn().mockResolvedValue({ ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "super_admin" }),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { recordScreening } from "../actions";
import { db } from "@/db";

const baseInput = {
  organizationId: ORG,
  entityType: "partner" as const,
  entityId: "22222222-2222-2222-2222-222222222222",
  entityNameSnapshot: "Test Partner Org",
  screenedAgainst: "un_consolidated_list" as const,
  result: "clear" as const,
  referenceNumber: "REF-001",
  screeningNotes: "checked manually",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertReturning.mockResolvedValue([{ id: "screening-record-1" }]);
  mockUpdateWhere.mockResolvedValue(undefined);
  // افتراضياً: الكيان المُشار إليه (أياً كان نوعه) تابع لنفس المنظمة
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("recordScreening — validation", () => {
  it("rejects an invalid organizationId", async () => {
    const res = await recordScreening({ ...baseInput, organizationId: "not-a-uuid" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects an empty entity name", async () => {
    const res = await recordScreening({ ...baseInput, entityNameSnapshot: "" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("strips HTML tags from the entity name snapshot (XSS protection)", async () => {
    const res = await recordScreening(
      { ...baseInput, entityNameSnapshot: "<script>alert(1)</script>Evil Org" },
      "user-1"
    );
    expect(res.success).toBe(true);
    const insertedValues = (db.insert as any).mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.entityNameSnapshot).not.toContain("<script>");
  });
});

describe("recordScreening — due-diligence linkage for partners", () => {
  it("marks a partner as rejected on a confirmed match", async () => {
    const res = await recordScreening({ ...baseInput, result: "confirmed_match" }, "user-1");
    expect(res.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("marks a partner as cleared on a clear result", async () => {
    const res = await recordScreening({ ...baseInput, result: "clear" }, "user-1");
    expect(res.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("marks a partner as flagged on a potential match", async () => {
    const res = await recordScreening({ ...baseInput, result: "potential_match" }, "user-1");
    expect(res.success).toBe(true);
    expect(db.update).toHaveBeenCalled();
  });

  it("does not touch partner due-diligence status for non-partner entities", async () => {
    const res = await recordScreening({ ...baseInput, entityType: "vendor", entityId: "33333333-3333-3333-3333-333333333333" }, "user-1");
    expect(res.success).toBe(true);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("recordScreening — IDOR: entity ownership check (v35, unified v37)", () => {
  it("rejects when the referenced entity belongs to a different organization", async () => {
    mockAssertOwnedByOrg.mockResolvedValue(false);
    const res = await recordScreening(baseInput, "user-1");
    expect(res.success).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("rejects when the referenced entity does not exist at all", async () => {
    mockAssertOwnedByOrg.mockResolvedValue(false);
    const res = await recordScreening(baseInput, "user-1");
    expect(res.success).toBe(false);
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("passes the entity's own table (not always partners) to the shared ownership check", async () => {
    mockAssertOwnedByOrg.mockResolvedValue(true);
    await recordScreening({ ...baseInput, entityType: "vendor", entityId: "33333333-3333-3333-3333-333333333333" }, "user-1");
    expect(mockAssertOwnedByOrg).toHaveBeenCalledWith(expect.anything(), "33333333-3333-3333-3333-333333333333", ORG);
  });
});

describe("recordScreening — error handling", () => {
  it("returns a generic error message if the insert throws", async () => {
    mockInsertReturning.mockRejectedValue(new Error("db down"));
    const res = await recordScreening(baseInput, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("حدث خطأ غير متوقع");
  });
});
