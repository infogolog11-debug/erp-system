import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertReturning = vi.fn();
const mockSelectWhere = vi.fn();

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: mockInsertReturning })) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: (...a: any[]) => mockSelectWhere(...a) })) })),
  },
}));

// complaintId المُرسَل من العميل يُتحقَّق الآن عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst مخصص.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requireSession: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "hr" }
      : { ok: false, error: "الجلسة غير صالحة" }
  )),
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "hr" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { createComplaint, addComplaintUpdate } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockInsertReturning.mockResolvedValue([{ id: "complaint-1", code: "CFM-2026-00001" }]);
  mockSelectWhere.mockResolvedValue([{ cnt: 0 }]);
});

describe("createComplaint", () => {
  const baseInput = {
    organizationId: ORG, channel: "hotline" as const, category: "service_quality" as const,
    isAnonymous: false, priority: "medium" as const, description: "Service was delayed by several days.",
  };

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createComplaint(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("creates successfully for a standard-sensitivity category", async () => {
    const res = await createComplaint(baseInput, "user-1");
    expect(res.success).toBe(true);
  });

  it("marks corruption complaints as sensitive automatically", async () => {
    await createComplaint({ ...baseInput, category: "corruption_fraud" }, "user-1");
    const insertMock = (await import("@/db")).db.insert as any;
    const insertedValues = insertMock.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.sensitivity).toBe("sensitive");
  });

  it("marks SGBV/protection complaints as sensitive automatically", async () => {
    await createComplaint({ ...baseInput, category: "sgbv_protection" }, "user-1");
    const insertMock = (await import("@/db")).db.insert as any;
    const insertedValues = insertMock.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.sensitivity).toBe("sensitive");
  });

  it("does not mark a routine service-quality complaint as sensitive", async () => {
    await createComplaint(baseInput, "user-1");
    const insertMock = (await import("@/db")).db.insert as any;
    const insertedValues = insertMock.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.sensitivity).toBe("standard");
  });

  it("strips complainant name and phone when the complaint is anonymous", async () => {
    await createComplaint({ ...baseInput, isAnonymous: true, complainantName: "Jane Doe", complainantPhone: "0123456789" }, "user-1");
    const insertMock = (await import("@/db")).db.insert as any;
    const insertedValues = insertMock.mock.results[0].value.values.mock.calls[0][0];
    expect(insertedValues.complainantName).toBeUndefined();
    expect(insertedValues.complainantPhone).toBeUndefined();
  });
});

// ─── إصلاح IDOR (v35): complaintId مُرسَل من العميل بلا تحقق ملكية سابقاً ──
describe("addComplaintUpdate", () => {
  it("rejects an empty update", async () => {
    const res = await addComplaintUpdate("complaint-1", ORG, "   ", "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a complaintId that doesn't exist", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addComplaintUpdate("complaint-1", ORG, "تم التواصل مع الشاكي", "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a complaintId belonging to a different organization (IDOR guard)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addComplaintUpdate("complaint-1", ORG, "تم التواصل مع الشاكي", "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("لا تتبع هذه المنظمة");
  });

  it("adds the update when the complaint belongs to the caller's organization", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(true);
    const res = await addComplaintUpdate("complaint-1", ORG, "تم التواصل مع الشاكي", "user-1");
    expect(res.success).toBe(true);
  });
});
