import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRatingReturning = vi.fn();
const mockVendorUpdateReturning = vi.fn();
const mockTxUpdateWhere = vi.fn();
const mockTxInsert = vi.fn((_table: any) => ({ values: vi.fn(() => ({ returning: mockRatingReturning })) }));
const mockTxUpdate = vi.fn((_table: any) => ({
  set: vi.fn((_setArgs: any) => ({
    where: (...whereArgs: any[]) => {
      mockTxUpdateWhere(...whereArgs);
      return { returning: (...a: any[]) => mockVendorUpdateReturning(...a) };
    },
  })),
}));
function makeTx() {
  return { insert: mockTxInsert, update: mockTxUpdate };
}

// flagEmergencyProcurement لا يستخدم معاملة (transaction) — تحديث مباشر
// عبر db.update بمستوى الجذر، منفصل تماماً عن مسار submitVendorRating أدناه.
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db", () => ({
  db: {
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

// vendorId/relatedPoId/relatedGrnId (submitVendorRating) وprId
// (flagEmergencyProcurement) يُتحقَّقون الآن عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst مخصص
// لكل حقل. بترتيب استدعاءات الكود: vendor ثم po (إن وُجد) ثم grn (إن وُجد).
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
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

import { submitVendorRating, flagEmergencyProcurement } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";
const VENDOR = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockRatingReturning.mockResolvedValue([{ id: "rating-1" }]);
  mockVendorUpdateReturning.mockResolvedValue([{ overallScore: "4.10" }]);
  mockAssertOwnedByOrg.mockResolvedValue(true);
});

describe("submitVendorRating", () => {
  const baseInput = {
    organizationId: ORG, vendorId: VENDOR,
    qualityScore: 4, deliveryScore: 5, complianceScore: 3,
  };

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await submitVendorRating(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("computes the weighted average using 40/35/25% quality/delivery/compliance weights", async () => {
    const res = await submitVendorRating(baseInput, "user-1");
    expect(res.success).toBe(true);
    // 4*0.40 + 5*0.35 + 3*0.25 = 1.6 + 1.75 + 0.75 = 4.10
    if (res.success) expect(res.data.weightedAverage).toBeCloseTo(4.10, 2);
  });

  // إصلاح (v39 — راجع SECURITY_NOTES.md): المعدل التراكمي newVendorAverage
  // يُحسَب الآن بالكامل داخل postgres عبر subquery AVG ذرّي (نفس معاملة
  // الإدراج)، لا بقراءة كل السجلات للذاكرة ثم الحساب هناك. هنا نتحقق أن
  // القيمة التي يُرجعها الـUPDATE (المحاكى) تنتقل كما هي لناتج الدالة —
  // وأن التحديث يستهدف المورد/المنظمة الصحيحين ضمن نفس المعاملة (لا db.update
  // منفصل خارجها).
  it("propagates the atomically-computed overall average from the DB update, scoped to the correct vendor/organization", async () => {
    mockVendorUpdateReturning.mockResolvedValue([{ overallScore: "3.55" }]);
    const res = await submitVendorRating(baseInput, "user-1");
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.newVendorAverage).toBeCloseTo(3.55, 2);
    expect(mockTxInsert).toHaveBeenCalled();
    expect(mockTxUpdate).toHaveBeenCalled();
    // الفحص الحاسم: التحديث تم *داخل* المعاملة (tx.update)، لا عبر
    // db.update بمستوى الجذر (ذاك مُخصَّص لـflagEmergencyProcurement فقط) —
    // يضمن أن الإدراج والتحديث الذرّي ينفّذان سويةً أو يتراجعان سويةً.
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("rejects a score outside the valid 0-5 range", async () => {
    const res = await submitVendorRating({ ...baseInput, qualityScore: 7 }, "user-1");
    expect(res.success).toBe(false);
  });

  // إصلاح IDOR v34: vendorId يجب أن يخص نفس المنظمة
  it("refuses a vendorId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await submitVendorRating(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses when the vendor doesn't exist", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await submitVendorRating(baseInput, "user-1");
    expect(res.success).toBe(false);
  });

  // إصلاح IDOR v34-تتمة-2: relatedPoId/relatedGrnId اختياريان، يجب التحقق
  // من ملكيتهما للمنظمة لو أُرسلا
  it("refuses a relatedPoId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // vendor: ok, po: IDOR
    const res = await submitVendorRating({ ...baseInput, relatedPoId: "33333333-3333-3333-3333-333333333333" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("refuses a relatedGrnId belonging to a different organization (IDOR)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(true).mockResolvedValueOnce(false); // vendor: ok, grn: IDOR
    const res = await submitVendorRating({ ...baseInput, relatedGrnId: "33333333-3333-3333-3333-333333333333" }, "user-1");
    expect(res.success).toBe(false);
  });

  it("accepts a relatedPoId/relatedGrnId that belong to the same organization", async () => {
    const res = await submitVendorRating({
      ...baseInput,
      relatedPoId: "33333333-3333-3333-3333-333333333333",
      relatedGrnId: "44444444-4444-4444-4444-444444444444",
    }, "user-1");
    expect(res.success).toBe(true);
  });
});

describe("flagEmergencyProcurement", () => {
  it("rejects when the caller lacks approve permission", async () => {
    mockSessionOk = false;
    const res = await flagEmergencyProcurement("pr-1", "Urgent medical shipment", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("flags successfully and sets a 30-day mandatory review date", async () => {
    const before = new Date();
    const res = await flagEmergencyProcurement("pr-1", "Urgent medical shipment", "user-1", ORG);
    expect(res.success).toBe(true);
    const setCallArgs = ((await import("@/db")).db.update as any).mock.results[0].value.set.mock.calls[0][0];
    const reviewDue = setCallArgs.emergencyReviewDue as Date;
    const diffDays = (reviewDue.getTime() - before.getTime()) / (1000*60*60*24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });

  // إصلاح v34-تتمة-2: لا تُنشئ سجل تدقيق مضلِّل لعملية no-op على PR غير موجود
  // أو تابع لمنظمة أخرى
  it("refuses when the PR doesn't exist, without touching the DB", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await flagEmergencyProcurement("pr-1", "Urgent medical shipment", "user-1", ORG);
    expect(res.success).toBe(false);
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("refuses a PR belonging to a different organization (no misleading audit log)", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await flagEmergencyProcurement("pr-1", "Urgent medical shipment", "user-1", ORG);
    expect(res.success).toBe(false);
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });
});
