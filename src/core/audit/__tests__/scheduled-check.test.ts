import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOrgsFindMany = vi.fn();
const mockUsersFindMany = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      organizations: { findMany: (...a: any[]) => mockOrgsFindMany(...a) },
      users: { findMany: (...a: any[]) => mockUsersFindMany(...a) },
    },
  },
}));

const mockVerifyAuditChain = vi.fn();
vi.mock("@/core/audit/audit-trail", () => ({
  verifyAuditChain: (...a: any[]) => mockVerifyAuditChain(...a),
}));

const mockNotifyMany = vi.fn();
vi.mock("@/core/notifications/notify", () => ({
  notifyMany: (...a: any[]) => mockNotifyMany(...a),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/email/sender", () => ({
  sendEmail: (...a: any[]) => mockSendEmail(...a),
}));

import { runScheduledAuditIntegrityCheck } from "../scheduled-check";

const ORG_A = { id: "org-a", name: "Org A", nameAr: "منظمة أ" };
const ORG_B = { id: "org-b", name: "Org B", nameAr: "منظمة ب" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SECURITY_ALERT_EMAIL;
  mockNotifyMany.mockResolvedValue(undefined);
  mockSendEmail.mockResolvedValue({ success: true });
});

describe("runScheduledAuditIntegrityCheck", () => {
  it("reports all organizations as valid and sends no alerts when every chain is intact", async () => {
    mockOrgsFindMany.mockResolvedValue([ORG_A, ORG_B]);
    mockVerifyAuditChain.mockResolvedValue({ valid: true });

    const summary = await runScheduledAuditIntegrityCheck();

    expect(summary.totalOrganizations).toBe(2);
    expect(summary.brokenCount).toBe(0);
    expect(summary.results.every((r) => r.valid)).toBe(true);
    expect(mockNotifyMany).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("alerts the organization's admins in-app/email when its chain is broken", async () => {
    mockOrgsFindMany.mockResolvedValue([ORG_A]);
    mockVerifyAuditChain.mockResolvedValue({
      valid: false,
      brokenAtRecordId: "log-42",
      reason: "محتوى السطر لا يطابق تجزئته المخزَّنة",
    });
    mockUsersFindMany.mockResolvedValue([
      { id: "u-admin", role: "admin" },
      { id: "u-super", role: "super_admin" },
      { id: "u-viewer", role: "viewer" },
    ]);

    const summary = await runScheduledAuditIntegrityCheck();

    expect(summary.brokenCount).toBe(1);
    expect(summary.results[0].brokenAtRecordId).toBe("log-42");
    expect(mockNotifyMany).toHaveBeenCalledTimes(1);
    const [notifiedIds, params] = mockNotifyMany.mock.calls[0];
    // فقط admin/super_admin يُنبَّهون — لا viewer
    expect(notifiedIds.sort()).toEqual(["u-admin", "u-super"]);
    expect(params.sendEmail).toBe(true);
    expect(params.organizationId).toBe("org-a");
  });

  it("also sends a direct security-alert email outside the user system when SECURITY_ALERT_EMAIL is set", async () => {
    process.env.SECURITY_ALERT_EMAIL = "security-ops@example.org";
    mockOrgsFindMany.mockResolvedValue([ORG_A]);
    mockVerifyAuditChain.mockResolvedValue({ valid: false, brokenAtRecordId: "log-1", reason: "prevHash mismatch" });
    mockUsersFindMany.mockResolvedValue([{ id: "u-admin", role: "admin" }]);

    await runScheduledAuditIntegrityCheck();

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "security-ops@example.org" }),
    );
  });

  it("does not send the direct security email when SECURITY_ALERT_EMAIL is unset", async () => {
    mockOrgsFindMany.mockResolvedValue([ORG_A]);
    mockVerifyAuditChain.mockResolvedValue({ valid: false, brokenAtRecordId: "log-1", reason: "x" });
    mockUsersFindMany.mockResolvedValue([{ id: "u-admin", role: "admin" }]);

    await runScheduledAuditIntegrityCheck();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("checks each organization independently — one broken chain doesn't stop the rest", async () => {
    mockOrgsFindMany.mockResolvedValue([ORG_A, ORG_B]);
    mockVerifyAuditChain
      .mockResolvedValueOnce({ valid: false, brokenAtRecordId: "log-1", reason: "x" })
      .mockResolvedValueOnce({ valid: true });
    mockUsersFindMany.mockResolvedValue([{ id: "u-admin", role: "admin" }]);

    const summary = await runScheduledAuditIntegrityCheck();

    expect(summary.totalOrganizations).toBe(2);
    expect(summary.brokenCount).toBe(1);
    expect(summary.results.find((r) => r.organizationId === "org-a")?.valid).toBe(false);
    expect(summary.results.find((r) => r.organizationId === "org-b")?.valid).toBe(true);
  });

  it("does not crash the whole run if no active admins exist for a broken organization", async () => {
    mockOrgsFindMany.mockResolvedValue([ORG_A]);
    mockVerifyAuditChain.mockResolvedValue({ valid: false, brokenAtRecordId: "log-1", reason: "x" });
    mockUsersFindMany.mockResolvedValue([{ id: "u-viewer", role: "viewer" }]);

    const summary = await runScheduledAuditIntegrityCheck();

    expect(summary.brokenCount).toBe(1);
    expect(mockNotifyMany).not.toHaveBeenCalled();
  });
});
