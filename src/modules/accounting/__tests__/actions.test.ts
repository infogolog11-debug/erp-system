import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPeriodFindFirst = vi.fn();
const mockEntryFindFirst = vi.fn();
const mockSelectFrom = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockIdemFindFirst = vi.fn();
const mockIdemInsertReturning = vi.fn();
const mockAccountsFindMany = vi.fn();

function makeTx() {
  return {
    query: {
      fiscalPeriods: { findFirst: (...a: any[]) => mockPeriodFindFirst(...a) },
    },
    select: vi.fn(() => ({ from: (...a: any[]) => mockSelectFrom(...a) })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id:"entry-1", code:"JE-REV-2026-000001" }]) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      fiscalPeriods: { findFirst: (...a: any[]) => mockPeriodFindFirst(...a) },
      journalEntries: { findFirst: (...a: any[]) => mockEntryFindFirst(...a) },
      idempotencyKeys: { findFirst: (...a: any[]) => mockIdemFindFirst(...a) },
      accounts: { findMany: (...a: any[]) => mockAccountsFindMany(...a) },
    },
    select: vi.fn(() => ({ from: (...a: any[]) => mockSelectFrom(...a) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: (...a: any[]) => mockUpdateWhere(...a) })) })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({ returning: (...a: any[]) => mockIdemInsertReturning(...a) })),
        returning: vi.fn().mockResolvedValue([{ id:"entry-1" }]),
      })),
    })),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
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

import { createJournalEntry, postJournalEntry, reverseJournalEntry } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
  mockSelectFrom.mockResolvedValue([{ c: 0 }]);
  mockIdemInsertReturning.mockResolvedValue([{ id: "idem-1" }]); // الحجز ينجح افتراضياً (لا تكرار)
  mockIdemFindFirst.mockResolvedValue(undefined);
  // افتراضياً: كل الحسابات المطلوبة موجودة وتتبع نفس منظمة المستدعي —
  // الاختبارات التي تريد محاكاة حساب أجنبي تُعيد كتابة هذا صراحةً.
  mockAccountsFindMany.mockImplementation(() => Promise.resolve(
    [{ id:"a1", organizationId:ORG }, { id:"a2", organizationId:ORG }]
  ));
});

describe("createJournalEntry", () => {
  const baseParams = {
    organizationId: ORG, fiscalPeriodId: "period-1",
    description: "Test entry", entryType: "manual", currencyId: "currency-1",
    userId: "user-1",
  };

  it("rejects when the caller lacks permission", async () => {
    mockSessionOk = false;
    const res = await createJournalEntry({ ...baseParams, lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }] } as any);
    expect(res.success).toBe(false);
  });

  it("rejects an unbalanced entry (debit ≠ credit)", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:50 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير متوازن");
  });

  it("rejects an entry against a closed fiscal period", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:true, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مغلقة");
  });

  it("creates successfully when balanced and the period is open", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);
    expect(res.success).toBe(true);
  });

  it("returns the stored result instead of re-running when the same idempotency key repeats", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    mockIdemFindFirst.mockResolvedValue({ responseJson: JSON.stringify({ success:true, data:{ id:"already-created", code:"JE-2026-000001" } }) });
    mockIdemInsertReturning.mockResolvedValue([]); // الحجز فشل = المفتاح موجود مسبقاً

    const res = await createJournalEntry({
      ...baseParams, idempotencyKey: "dup-key",
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);

    expect(res.success).toBe(true);
    if (res.success) expect(res.data.id).toBe("already-created"); // لم يُنشئ قيداً جديداً
  });

  // ─── إصلاح مطابقة الطبقات: كانت هذه القيود موجودة فقط بـ CHECK
  // constraint بقاعدة البيانات (v32) بدون رسالة عربية واضحة بالتطبيق ───
  it("rejects a line with both debit and credit non-zero at once (app-level, before it hits the DB CHECK constraint)", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:50, creditAmount:50 }, { accountId:"a2", debitAmount:0, creditAmount:50 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مدين ودائن معاً");
  });

  it("rejects a negative debit or credit amount", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:-10, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:-10 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("سالباً");
  });

  it("rejects a line with neither debit nor credit set (an empty line)", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:0, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:0 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("فارغاً");
  });

  it("rejects an entryType outside the allowed set", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await createJournalEntry({
      ...baseParams, entryType: "not_a_real_type",
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("نوع القيد");
  });

  // ─── إصلاحات IDOR (v35) ───────────────────────────────────────
  it("rejects a fiscal period belonging to a different organization", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:"other-org" });
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير موجودة"); // نفس رسالة "غير موجودة" — لا تمييز يسمح بـenumeration
  });

  it("rejects a journal line referencing an account belonging to a different organization", async () => {
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    mockAccountsFindMany.mockResolvedValue([{ id:"a1", organizationId:ORG }]); // a2 مفقود من نتيجة المنظمة
    const res = await createJournalEntry({
      ...baseParams,
      lines: [{ accountId:"a1", debitAmount:100, creditAmount:0 }, { accountId:"a2", debitAmount:0, creditAmount:100 }],
    } as any);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("الحسابات المحاسبية");
  });
});

describe("postJournalEntry", () => {
  it("rejects when the caller lacks approve permission", async () => {
    mockSessionOk = false;
    const res = await postJournalEntry("entry-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("refuses to post an entry belonging to a different organization", async () => {
    mockEntryFindFirst.mockResolvedValue({ id:"entry-1", organizationId:"other-org", isPosted:false, lines:[] });
    const res = await postJournalEntry("entry-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("blocks posting an already-posted entry", async () => {
    mockEntryFindFirst.mockResolvedValue({ id:"entry-1", organizationId:ORG, isPosted:true, lines:[] });
    const res = await postJournalEntry("entry-1", "user-1", ORG);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مرحَّل بالفعل");
  });

  it("blocks posting into a fiscal period that was closed after the entry was created (the bug this fixes)", async () => {
    mockEntryFindFirst.mockResolvedValue({
      id:"entry-1", organizationId:ORG, isPosted:false, fiscalPeriodId:"period-1",
      lines:[{ accountId:"a1", debitAmount:"100", creditAmount:"0" }],
    });
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:true, organizationId:ORG }); // أُقفلت بعد الإنشاء
    const res = await postJournalEntry("entry-1", "user-1", ORG);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مغلقة");
  });

  it("posts successfully for a valid, unposted entry in an open period", async () => {
    mockEntryFindFirst.mockResolvedValue({
      id:"entry-1", organizationId:ORG, isPosted:false, fiscalPeriodId:"period-1",
      lines:[{ accountId:"a1", debitAmount:"100", creditAmount:"0" }],
    });
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await postJournalEntry("entry-1", "user-1", ORG);
    expect(res.success).toBe(true);
  });
});

describe("reverseJournalEntry", () => {
  const postedEntry = {
    id:"entry-1", organizationId:ORG, isPosted:true, isReversed:false,
    fiscalPeriodId:"period-1", code:"JE-2026-000001", grantId:undefined,
    totalDebit:"100", totalCredit:"100", currencyId:"currency-1",
    lines: [{ accountId:"a1", debitAmount:"100", creditAmount:"0", grantId:undefined, description:"" }],
  };

  it("requires a reason", async () => {
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("سبب");
  });

  it("refuses to reverse an entry that was never posted", async () => {
    mockEntryFindFirst.mockResolvedValue({ ...postedEntry, isPosted:false });
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "تصحيح خطأ");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير مرحَّل");
  });

  it("refuses to reverse an entry that is already reversed", async () => {
    mockEntryFindFirst.mockResolvedValue({ ...postedEntry, isReversed:true });
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "تصحيح خطأ");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("معكوس بالفعل");
  });

  it("refuses to book the reversal into a closed period", async () => {
    mockEntryFindFirst.mockResolvedValue(postedEntry);
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:true, organizationId:ORG });
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "تصحيح خطأ");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("مغلقة");
  });

  it("creates a reversal entry with debit/credit flipped, and marks the original as reversed", async () => {
    mockEntryFindFirst.mockResolvedValue(postedEntry);
    mockPeriodFindFirst.mockResolvedValue({ id:"period-1", isClosed:false, organizationId:ORG });
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "تصحيح خطأ إدخال");
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("refuses to book the reversal into a fiscal period belonging to another organization (targetFiscalPeriodId IDOR)", async () => {
    mockEntryFindFirst.mockResolvedValue(postedEntry);
    mockPeriodFindFirst.mockResolvedValue({ id:"foreign-period", isClosed:false, organizationId:"other-org" });
    const res = await reverseJournalEntry("entry-1", "user-1", ORG, "تصحيح خطأ", "foreign-period");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("غير موجودة");
  });
});
