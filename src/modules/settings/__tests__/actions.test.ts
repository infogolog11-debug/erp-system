import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db", () => ({
  db: {
    query: { systemSettings: { findFirst: (...a: any[]) => mockFindFirst(...a) } },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "super_admin" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { updateSetting, updateSettingsBatch } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
});

describe("updateSetting", () => {
  it("rejects when the caller lacks admin permission", async () => {
    mockSessionOk = false;
    const res = await updateSetting(ORG, "budget", "warning_threshold", "80", "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects when the claimed org doesn't match the session", async () => {
    const res = await updateSetting("other-org", "budget", "warning_threshold", "80", "user-1");
    expect(res.success).toBe(false);
  });

  it("returns an error when the setting doesn't exist", async () => {
    mockFindFirst.mockResolvedValue(null);
    const res = await updateSetting(ORG, "budget", "warning_threshold", "80", "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects a non-numeric value for a number-type setting", async () => {
    mockFindFirst.mockResolvedValue({ id:"s1", valueType:"number", value:"75", minValue:null, maxValue:null });
    const res = await updateSetting(ORG, "budget", "warning_threshold", "not-a-number", "user-1");
    expect(res.success).toBe(false);
  });

  it("rejects a value below the configured minimum", async () => {
    mockFindFirst.mockResolvedValue({ id:"s1", valueType:"number", value:"75", minValue:"10", maxValue:"100" });
    const res = await updateSetting(ORG, "budget", "warning_threshold", "5", "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("الحد الأدنى");
  });

  it("rejects a value above the configured maximum", async () => {
    mockFindFirst.mockResolvedValue({ id:"s1", valueType:"number", value:"75", minValue:"10", maxValue:"100" });
    const res = await updateSetting(ORG, "budget", "warning_threshold", "150", "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("الحد الأعلى");
  });

  it("updates successfully within valid bounds", async () => {
    mockFindFirst.mockResolvedValue({ id:"s1", valueType:"number", value:"75", minValue:"10", maxValue:"100" });
    const res = await updateSetting(ORG, "budget", "warning_threshold", "85", "user-1");
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("updateSettingsBatch", () => {
  it("counts only successfully saved settings", async () => {
    mockFindFirst
      .mockResolvedValueOnce({ id:"s1", valueType:"text", value:"a" })
      .mockResolvedValueOnce(null) // second setting doesn't exist -> fails
      .mockResolvedValueOnce({ id:"s3", valueType:"text", value:"c" });

    const res = await updateSettingsBatch(ORG, [
      { category:"c", key:"k1", value:"v1" },
      { category:"c", key:"k2", value:"v2" },
      { category:"c", key:"k3", value:"v3" },
    ], "user-1");

    expect(res.success).toBe(true);
    if (res.success) expect(res.data.saved).toBe(2);
  });
});
