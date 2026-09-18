import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => mockAuth() }));

const mockGetUserPermission = vi.fn();
vi.mock("@/lib/permissions/service", async () => {
  const actual = await vi.importActual<any>("@/lib/permissions/service");
  return {
    ...actual,
    getUserPermission: (...args: any[]) => mockGetUserPermission(...args),
  };
});

import { requireSession, requirePermission, assertOrgMatches } from "../guard";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireSession", () => {
  it("fails when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await requireSession();
    expect(res.ok).toBe(false);
  });

  it("returns verified identity from a real session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", organizationId: "org1", role: "finance" } });
    const res = await requireSession();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.userId).toBe("u1");
      expect(res.organizationId).toBe("org1");
      expect(res.role).toBe("finance");
    }
  });
});

describe("requirePermission", () => {
  it("fails when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await requirePermission("grants", "create");
    expect(res.ok).toBe(false);
  });

  it("fails when the user's permission level is below the required minimum", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", organizationId: "org1", role: "viewer" } });
    mockGetUserPermission.mockResolvedValue("view");
    const res = await requirePermission("grants", "approve");
    expect(res.ok).toBe(false);
  });

  it("succeeds when the user's permission level meets the required minimum", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", organizationId: "org1", role: "finance" } });
    mockGetUserPermission.mockResolvedValue("approve");
    const res = await requirePermission("grants", "approve");
    expect(res.ok).toBe(true);
  });

  it("succeeds for super_admin regardless of the stored permission record", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", organizationId: "org1", role: "super_admin" } });
    mockGetUserPermission.mockResolvedValue("admin");
    const res = await requirePermission("settings", "admin");
    expect(res.ok).toBe(true);
  });
});

describe("assertOrgMatches", () => {
  it("returns true when the claimed org matches the session org", () => {
    const session = { ok: true as const, userId: "u1", organizationId: "org1", role: "finance" };
    expect(assertOrgMatches("org1", session)).toBe(true);
  });

  it("returns false when the claimed org does not match the session org (spoofing attempt)", () => {
    const session = { ok: true as const, userId: "u1", organizationId: "org1", role: "finance" };
    expect(assertOrgMatches("someone-elses-org", session)).toBe(false);
  });
});
