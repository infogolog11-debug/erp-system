import { describe, it, expect, vi, beforeEach } from "vitest";

// ملف اختبار مستقل عمداً (بدل الدمج بـactions.test.ts): submitBidScore لم
// يكن له أي تغطية اختبارية سابقاً على الإطلاق (v38 وما قبلها) — تحقّقنا من
// هذا صراحة قبل البدء. mock db منفصل هنا أبسط وأوضح من محاولة توحيده مع
// mock الموجود أصلاً بـactions.test.ts الذي بُني حول جداول مختلفة تماماً
// (vendors/vendorRatings)، وvitest يعزل سجل الموديولات بين ملفات الاختبار
// فلا تعارض بينهما.

import { tenderBids, bidEvaluations } from "@/db/schema";

const mockCriteriaFindFirst = vi.fn();
const mockBidFindFirst = vi.fn();
const mockEvalFindFirst = vi.fn();
const mockEvalInsertValues = vi.fn().mockResolvedValue(undefined);
const mockEvalUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockBidUpdateReturning = vi.fn();
const mockBidUpdateWhere = vi.fn();

// نميّز بين tx.update(bidEvaluations) (تحديث تقييم فردي — بلا returning)
// وtx.update(tenderBids) (التحديث الذرّي لـtotalScore — مع returning) عبر
// مقارنة هوية الكائن الحقيقي المستورَد من @/db/schema (غير مُموَّه هنا) —
// نفس الكائن الذي يستورده actions.ts، فالمقارنة بـ=== موثوقة.
function makeTx() {
  return {
    insert: vi.fn((_table: any) => ({
      values: (v: any) => { mockEvalInsertValues(v); return Promise.resolve(undefined); },
    })),
    update: vi.fn((table: any) => {
      if (table === tenderBids) {
        return {
          set: vi.fn(() => ({
            where: (...a: any[]) => {
              mockBidUpdateWhere(...a);
              return { returning: (...b: any[]) => mockBidUpdateReturning(...b) };
            },
          })),
        };
      }
      return {
        set: vi.fn(() => ({
          where: (...a: any[]) => { mockEvalUpdateWhere(...a); return Promise.resolve(undefined); },
        })),
      };
    }),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      bidEvaluationCriteria: { findFirst: (...a: any[]) => mockCriteriaFindFirst(...a) },
      tenderBids:            { findFirst: (...a: any[]) => mockBidFindFirst(...a) },
      bidEvaluations:        { findFirst: (...a: any[]) => mockEvalFindFirst(...a) },
    },
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "eval-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "procurement" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { submitBidScore } from "../actions";

const ORG      = "11111111-1111-1111-1111-111111111111";
const TENDER   = "22222222-2222-2222-2222-222222222222";
const BID      = "33333333-3333-3333-3333-333333333333";
const CRITERIA = "44444444-4444-4444-4444-444444444444";
const EVALUATOR = "eval-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockCriteriaFindFirst.mockResolvedValue({
    id: CRITERIA, organizationId: ORG, tenderId: TENDER, maxScore: 10, weight: 30,
  });
  mockBidFindFirst.mockResolvedValue({ id: BID, tenderId: TENDER });
  mockEvalFindFirst.mockResolvedValue(undefined); // لا يوجد تقييم سابق (مسار الإدراج)
  mockBidUpdateReturning.mockResolvedValue([{ totalScore: "24.00" }]);
});

describe("submitBidScore", () => {
  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 8);
    expect(res.success).toBe(false);
  });

  it("refuses a criteria belonging to a different organization (IDOR)", async () => {
    mockCriteriaFindFirst.mockResolvedValue({ id: CRITERIA, organizationId: "other-org", tenderId: TENDER, maxScore: 10, weight: 30 });
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 8);
    expect(res.success).toBe(false);
  });

  it("refuses a score outside the valid range for the criteria's maxScore", async () => {
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 15);
    expect(res.success).toBe(false);
  });

  it("refuses to modify a locked existing evaluation", async () => {
    mockEvalFindFirst.mockResolvedValue({ id: "eval-row-1", isLocked: true });
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 8);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("إقفال");
    expect(mockEvalInsertValues).not.toHaveBeenCalled();
    expect(mockEvalUpdateWhere).not.toHaveBeenCalled();
    expect(mockBidUpdateWhere).not.toHaveBeenCalled();
  });

  it("inserts a new evaluation when none exists yet, then atomically updates the bid's totalScore", async () => {
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 8);
    expect(res.success).toBe(true);
    expect(mockEvalInsertValues).toHaveBeenCalled();
    expect(mockEvalUpdateWhere).not.toHaveBeenCalled();
    // القيمة تأتي من الـUPDATE الذرّي (المحاكى) مباشرة، لا من حساب JS محلي
    if (res.success) expect(res.data.finalScore).toBeCloseTo(24.00, 2);
  });

  it("updates the existing evaluation in place when one already exists (not locked)", async () => {
    mockEvalFindFirst.mockResolvedValue({ id: "eval-row-1", isLocked: false, organizationId: ORG });
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 9);
    expect(res.success).toBe(true);
    expect(mockEvalUpdateWhere).toHaveBeenCalled();
    expect(mockEvalInsertValues).not.toHaveBeenCalled();
  });

  // إصلاح (v39 — راجع SECURITY_NOTES.md): الفحص الحاسم — لا قراءة لكل
  // صفوف bidEvaluations إلى الذاكرة إطلاقاً؛ totalScore يُحسَب بالكامل
  // داخل تحديث SQL واحد (SUM/COUNT DISTINCT عبر subquery)، والقيمة
  // المُعادة من ذلك التحديث تُستخدَم كما هي بلا أي حسبة JS إضافية عليها.
  it("computes totalScore via a single atomic SQL aggregate update — not a read-all-then-average-in-memory pass", async () => {
    mockBidUpdateReturning.mockResolvedValue([{ totalScore: "17.50" }]);
    const res = await submitBidScore(TENDER, BID, CRITERIA, EVALUATOR, ORG, 8);
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.finalScore).toBeCloseTo(17.50, 2);
    expect(mockBidUpdateWhere).toHaveBeenCalled();
  });
});
