import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db", () => ({
  db: {
    query: { idempotencyKeys: { findFirst: (...a: any[]) => mockFindFirst(...a) } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: any[]) => mockInsertReturning(...a) })),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
    delete: vi.fn(() => ({ where: (...a: any[]) => mockDeleteWhere(...a) })),
  },
}));

import { withIdempotency, IdempotencyInProgressError } from "../guard";

beforeEach(() => {
  vi.clearAllMocks();
  mockInsertReturning.mockResolvedValue([{ id: "reserved-1" }]); // الحجز ينجح افتراضياً
});

describe("withIdempotency", () => {
  it("runs fn normally when no key is given", async () => {
    const fn = vi.fn().mockResolvedValue("result");
    const res = await withIdempotency("org-1", undefined, "someAction", fn);
    expect(res).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("runs fn once and stores the result when the key is new", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const res = await withIdempotency("org-1", "key-1", "someAction", fn);
    expect(res).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockUpdateWhere).toHaveBeenCalled(); // الناتج خُزِّن
  });

  it("returns the stored result and does NOT re-run fn when a completed key repeats", async () => {
    mockInsertReturning.mockResolvedValue([]); // الحجز فشل = مفتاح موجود مسبقاً
    mockFindFirst.mockResolvedValue({ responseJson: JSON.stringify({ ok: true, from: "cache" }) });

    const fn = vi.fn().mockResolvedValue({ ok: true, from: "fresh-run" });
    const res = await withIdempotency("org-1", "key-1", "someAction", fn);

    expect(res).toEqual({ ok: true, from: "cache" });
    expect(fn).not.toHaveBeenCalled(); // هذا هو جوهر idempotency: لا تكرار تنفيذ
  });

  it("throws IdempotencyInProgressError when the key is reserved but not yet completed (true concurrent race)", async () => {
    mockInsertReturning.mockResolvedValue([]); // الحجز فشل
    mockFindFirst.mockResolvedValue({ responseJson: null }); // محجوز، لكن لم يكتمل بعد

    const fn = vi.fn().mockResolvedValue("should not run");
    await expect(withIdempotency("org-1", "key-1", "someAction", fn)).rejects.toThrow(IdempotencyInProgressError);
    expect(fn).not.toHaveBeenCalled();
  });

  // ─── إصلاح: فشل التحقق (success:false) لا يجوز أن يُخزَّن كنتيجة نهائية ───
  it("releases the key (deletes the reservation) instead of caching an explicit failure result, so a retry with the same key can succeed", async () => {
    const fn = vi.fn().mockResolvedValue({ success: false, error: "بيانات غير صحيحة" });
    const res = await withIdempotency("org-1", "key-1", "someAction", fn);

    expect(res).toEqual({ success: false, error: "بيانات غير صحيحة" });
    expect(mockDeleteWhere).toHaveBeenCalled(); // فُكّ الحجز
    expect(mockUpdateWhere).not.toHaveBeenCalled(); // لم يُخزَّن كنتيجة دائمة
  });

  it("does not treat a result without a boolean success field as a failure (still caches it normally)", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, id: "x" }); // شكل نتيجة مختلف، بلا success:false صريح
    const res = await withIdempotency("org-1", "key-1", "someAction", fn);
    expect(res).toEqual({ ok: true, id: "x" });
    expect(mockUpdateWhere).toHaveBeenCalled();
    expect(mockDeleteWhere).not.toHaveBeenCalled();
  });

  // ─── إصلاح أهم: أغلب نقاط النداء الفعلية (createDistribution،
  // createGoodsReceiptNote) لا تُرجع {success:false} — هي تَرمي استثناءً
  // من داخل transaction عند فشل تحقق عمل. بدون هذا الإصلاح كان الحجز
  // يعلق للأبد عند أي رمي كهذا ───
  it("releases the key and re-throws the original error when fn() throws (the common path for business-rule failures inside a transaction)", async () => {
    const boom = new Error("المخزون غير كافٍ");
    const fn = vi.fn().mockRejectedValue(boom);

    await expect(withIdempotency("org-1", "key-1", "someAction", fn)).rejects.toThrow("المخزون غير كافٍ");
    expect(mockDeleteWhere).toHaveBeenCalled(); // الحجز فُكّ، ما بقي عالقاً
    expect(mockUpdateWhere).not.toHaveBeenCalled();
  });

  it("allows a retry with the same key to succeed after a prior attempt threw (no stuck reservation)", async () => {
    const failingFn = vi.fn().mockRejectedValue(new Error("خطأ مؤقت"));
    await expect(withIdempotency("org-1", "key-1", "someAction", failingFn)).rejects.toThrow();

    // محاكاة إعادة المحاولة: الحجز الآن غير موجود (اتحذف)، فينجح الحجز الثاني
    mockInsertReturning.mockResolvedValue([{ id: "reserved-2" }]);
    const succeedingFn = vi.fn().mockResolvedValue({ success: true, data: "ok" });
    const res = await withIdempotency("org-1", "key-1", "someAction", succeedingFn);

    expect(res).toEqual({ success: true, data: "ok" });
    expect(succeedingFn).toHaveBeenCalledTimes(1);
  });
});
