import { describe, it, expect, vi, beforeEach } from "vitest";
import { beneficiaries, householdMembers, caseNotes } from "@/db/schema";

// ── Mocks ──────────────────────────────────────────────────
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockSelectWhere = vi.fn();
const mockBeneficiaryReturning = vi.fn();
const mockHouseholdValues = vi.fn().mockResolvedValue(undefined);
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockCaseNoteInsert = vi.fn();

vi.mock("@/db", () => {
  return {
    db: {
      query: {
        beneficiaries: {
          findMany: (...args: any[]) => mockFindMany(...args),
          findFirst: (...args: any[]) => mockFindFirst(...args),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: (...args: any[]) => mockSelectWhere(...args),
        })),
      })),
      insert: vi.fn((table: any) => {
        if (table === beneficiaries) {
          return { values: vi.fn(() => ({ returning: mockBeneficiaryReturning })) };
        }
        if (table === householdMembers) {
          return { values: (...args: any[]) => mockHouseholdValues(...args) };
        }
        if (table === caseNotes) {
          return { values: (...args: any[]) => ({ returning: () => mockCaseNoteInsert(...args) }) };
        }
        return { values: vi.fn().mockResolvedValue(undefined) };
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: (...args: any[]) => mockUpdateWhere(...args),
        })),
      })),
    },
  };
});

// beneficiaryId (verifyBeneficiary) وcaseId (addCaseNote) يُتحقَّقان الآن عبر
// assertOwnedByOrg الموحّدة (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38)
// بدل findFirst مخصص لكل حقل.
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

import { checkDuplicates, createBeneficiary, verifyBeneficiary, addCaseNote } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockSelectWhere.mockResolvedValue([{ cnt: 0 }]);
  mockBeneficiaryReturning.mockResolvedValue([{ id: "ben-1" }]);
  mockCaseNoteInsert.mockResolvedValue([{ id: "case-note-1" }]);
});

describe("checkDuplicates", () => {
  it("returns an empty list when no matches exist", async () => {
    const res = await checkDuplicates(ORG, "Ahmad", "Ali");
    expect(res).toEqual([]);
  });

  it("computes similarity for returned matches", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "existing-1", code: "BEN-2026-000001", firstName: "Ahmad", lastName: "Ali", verificationStatus: "verified" },
    ]);
    const res = await checkDuplicates(ORG, "Ahmad", "Ali");
    expect(res).toHaveLength(1);
    expect(res[0].similarity).toBe(100);
  });
});

describe("createBeneficiary", () => {
  const baseInput = {
    organizationId: ORG,
    firstName: "Sara",
    lastName: "Khaled",
    gender: "female" as const,
    householdSize: 1,
    vulnerabilityCategory: "none" as const,
    vulnerabilityScore: 0,
    householdMembers: [],
  };

  it("rejects invalid input via zod", async () => {
    const res = await createBeneficiary({ ...baseInput, gender: "invalid" as any }, "user-1");
    expect(res.success).toBe(false);
  });

  it("registers successfully when there are no duplicates", async () => {
    const res = await createBeneficiary(baseInput, "user-1");
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.code).toMatch(/^BEN-\d{4}-000001$/);
      expect(res.data.duplicatesFound).toBe(0);
    }
  });

  it("blocks registration on a strong duplicate match unless explicitly overridden", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "existing-1", code: "BEN-2026-000001", firstName: "Sara", lastName: "Khaled", verificationStatus: "verified" },
    ]);
    const res = await createBeneficiary(baseInput, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("راجع قبل المتابعة");
  });

  it("allows registration through a strong duplicate match when explicitly overridden", async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: "existing-1", code: "BEN-2026-000001", firstName: "Sara", lastName: "Khaled", verificationStatus: "verified" },
    ]);
    const res = await createBeneficiary({ ...baseInput, overrideDuplicateWarning: true }, "user-1");
    expect(res.success).toBe(true);
  });

  it("strips HTML tags from free-text fields before storing (XSS protection)", async () => {
    let capturedValues: any = null;
    mockBeneficiaryReturning.mockImplementationOnce(() => Promise.resolve([{ id: "ben-1" }]));
    const insertMock = (await import("@/db")).db.insert as any;
    insertMock.mockImplementationOnce((table: any) => ({
      values: (v: any) => { capturedValues = v; return { returning: mockBeneficiaryReturning }; },
    }));
    await createBeneficiary({ ...baseInput, firstName: "<script>alert(1)</script>Sara" }, "user-1");
    expect(capturedValues.firstName).not.toContain("<script>");
    expect(capturedValues.firstName).toContain("Sara");
  });

  it("inserts household members when provided", async () => {
    await createBeneficiary({
      ...baseInput,
      householdMembers: [{ fullName: "Child One", relationship: "ابن/ابنة", isVulnerable: false }],
    }, "user-1");
    expect(mockHouseholdValues).toHaveBeenCalled();
  });
});

describe("verifyBeneficiary", () => {
  it("returns an error when the beneficiary does not exist", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await verifyBeneficiary("ben-1", "user-1", ORG, "verified");
    expect(res.success).toBe(false);
  });

  it("verifies successfully and scopes the update to the caller's organization", async () => {
    mockFindFirst.mockResolvedValue({ id: "ben-1", organizationId: ORG, verificationStatus: "pending" });
    const res = await verifyBeneficiary("ben-1", "user-1", ORG, "verified");
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("refuses to verify a beneficiary belonging to a different organization (IDOR guard)", async () => {
    mockFindFirst.mockResolvedValue({ id: "ben-1", organizationId: "other-org-id", verificationStatus: "pending" });
    const res = await verifyBeneficiary("ben-1", "user-1", ORG, "verified");
    expect(res.success).toBe(false);
  });
});

// ─── إصلاح IDOR (v35): caseId مُرسَل من العميل بلا تحقق ملكية سابقاً ──
describe("addCaseNote", () => {
  it("rejects an empty note", async () => {
    const res = await addCaseNote("case-1", ORG, "ben-1", "   ", "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a caseId that doesn't exist", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addCaseNote("case-1", ORG, "ben-1", "ملاحظة متابعة", "user-1");
    expect(res.success).toBe(false);
    expect(mockCaseNoteInsert).not.toHaveBeenCalled();
  });

  it("refuses a caseId belonging to a different organization (IDOR guard)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addCaseNote("case-1", ORG, "ben-1", "ملاحظة متابعة", "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("لا تتبع هذه المنظمة");
    expect(mockCaseNoteInsert).not.toHaveBeenCalled();
  });

  it("adds the note when the case belongs to the caller's organization", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(true);
    const res = await addCaseNote("case-1", ORG, "ben-1", "ملاحظة متابعة", "user-1");
    expect(res.success).toBe(true);
    expect(mockCaseNoteInsert).toHaveBeenCalled();
  });
});
