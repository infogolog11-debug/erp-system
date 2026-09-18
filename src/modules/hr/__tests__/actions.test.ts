import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunFindFirst = vi.fn();
const mockContractFindFirst = vi.fn();
const mockContractsFindMany = vi.fn();
const mockAttendanceFindMany = vi.fn();
const mockSalaryComponentsFindMany = vi.fn();
const mockGrantBudgetLinesFindMany = vi.fn();
const mockAdjustmentsFindMany = vi.fn().mockResolvedValue([]);
const mockAdjustmentFindFirst = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdateSetArgs: any[] = [];
const mockUpdateSet = vi.fn((...a: any[]) => { mockUpdateSetArgs.push(a[0]); return { where: (...b: any[]) => mockUpdateWhere(...b) }; });
const mockInsertReturning = vi.fn().mockResolvedValue([{ id: "adj-1" }]);
const mockDbInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
const mockDbInsert = vi.fn((..._a: any[]) => ({ values: mockDbInsertValues }));
const mockDbDeleteWhere = vi.fn().mockResolvedValue(undefined);
const mockDbDelete = vi.fn((..._a: any[]) => ({ where: mockDbDeleteWhere }));

// ── تعقّب استدعاءات tx.insert/tx.update داخل المعاملة (transaction) لاختبار
//    processPayroll — خصوصاً الإدراج الدفعي الجديد وتحديثات الميزانية ──
const txInsertCalls: { table: string; values: any }[] = [];
const txUpdateCalls: { table: string; values: any }[] = [];
let mockRunReturned = { id: "run-1" };

function makeTx() {
  return {
    insert: vi.fn((table: any) => ({
      values: (values: any) => {
        const tableName = table === payrollRuns ? "payrollRuns" : table === payrollLines ? "payrollLines" : "unknown";
        txInsertCalls.push({ table: tableName, values });
        return { returning: () => Promise.resolve([mockRunReturned]) };
      },
    })),
    update: vi.fn((table: any) => ({
      set: (values: any) => {
        const tableName =
          table === grantBudgetLines ? "grantBudgetLines" :
          table === payrollRuns ? "payrollRuns" :
          table === payrollAdjustments ? "payrollAdjustments" : "unknown";
        txUpdateCalls.push({ table: tableName, values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      },
    })),
  };
}

vi.mock("@/db", () => ({
  db: {
    query: {
      payrollRuns:        { findFirst: (...a: any[]) => mockRunFindFirst(...a) },
      contracts:          { findFirst: (...a: any[]) => mockContractFindFirst(...a), findMany: (...a: any[]) => mockContractsFindMany(...a) },
      attendance:         { findMany: (...a: any[]) => mockAttendanceFindMany(...a) },
      salaryComponents:   { findMany: (...a: any[]) => mockSalaryComponentsFindMany(...a) },
      grantBudgetLines:   { findMany: (...a: any[]) => mockGrantBudgetLinesFindMany(...a) },
      payrollAdjustments: { findMany: (...a: any[]) => mockAdjustmentsFindMany(...a), findFirst: (...a: any[]) => mockAdjustmentFindFirst(...a) },
    },
    update: vi.fn(() => ({ set: (...a: any[]) => mockUpdateSet(...a) })),
    insert: (...a: any[]) => mockDbInsert(...a),
    delete: (...a: any[]) => mockDbDelete(...a),
    transaction: vi.fn((cb: any) => cb(makeTx())),
  },
}));

import { payrollRuns, payrollLines, grantBudgetLines, payrollAdjustments } from "@/db/schema";

vi.mock("@/core/audit/audit-trail", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/notifications/notify", () => ({ notify: vi.fn().mockResolvedValue(undefined) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/grants/actions", () => ({ checkBudgetCeiling: vi.fn().mockResolvedValue({ canProceed: true }) }));
const mockGetPayrollSettings = vi.fn().mockResolvedValue({
  incomeTaxRate: 0.05, socialSecurityRate: 0.075, overtimeMultiplier: 1.5, taxExemptThreshold: 500,
});
vi.mock("@/lib/settings/service", () => ({ getPayrollSettings: (...a: any[]) => mockGetPayrollSettings(...a) }));

// employeeId المُرسَل من العميل يُتحقَّق الآن عبر assertOwnedByOrg الموحّدة
// (src/lib/auth/ownership.ts، عُمِّمت لهذا الموديول v38) بدل findFirst مخصص.
const mockAssertOwnedByOrg = vi.fn();
vi.mock("@/lib/auth/ownership", () => ({
  assertOwnedByOrg: (...args: any[]) => mockAssertOwnedByOrg(...args),
}));

// processPayroll مُوحَّد الآن عبر withIdempotency (v39 — راجع SECURITY_NOTES.md)
// بنفس نمط createDistribution. withIdempotency نفسها لها اختبارات مستقلة
// بـ src/lib/idempotency/__tests__/guard.test.ts؛ هنا نكتفي بمحاكاتها —
// افتراضياً تمرّر مباشرة لـfn() (نفس سلوك "بدون مفتاح" الحقيقي)، وبعض
// الاختبارات تُعيد تعريفها لمحاكاة سيناريو تكرار/تخزين مؤقت فعلي.
const { mockWithIdempotency, MockIdempotencyInProgressError } = vi.hoisted(() => {
  class MockIdempotencyInProgressError extends Error {
    constructor() { super("طلب مطابق قيد التنفيذ حالياً — أعد المحاولة خلال لحظات"); }
  }
  const mockWithIdempotency = vi.fn(
    (_organizationId: string, _key: string | undefined, _action: string, fn: () => Promise<any>) => fn(),
  );
  return { mockWithIdempotency, MockIdempotencyInProgressError };
});
vi.mock("@/lib/idempotency/guard", () => ({
  withIdempotency: (...args: any[]) => mockWithIdempotency(...(args as [any, any, any, any])),
  IdempotencyInProgressError: MockIdempotencyInProgressError,
}));

let mockSessionOk = true;
vi.mock("@/lib/auth/guard", () => ({
  requirePermission: vi.fn(() => Promise.resolve(
    mockSessionOk
      ? { ok: true, userId: "user-1", organizationId: "11111111-1111-1111-1111-111111111111", role: "hr" }
      : { ok: false, error: "ليست لديك الصلاحية الكافية لتنفيذ هذا الإجراء" }
  )),
  assertOrgMatches: (claimed: string, session: any) => claimed === session.organizationId,
}));

import { approvePayroll, markPayrollPaid, updateContractAllowances, processPayroll, addPayrollAdjustment, deletePayrollAdjustment } from "../actions";

const ORG = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mockSessionOk = true;
});

describe("approvePayroll", () => {
  it("rejects when the caller lacks approve permission", async () => {
    mockSessionOk = false;
    const res = await approvePayroll("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("returns an error when the payroll run doesn't exist", async () => {
    mockRunFindFirst.mockResolvedValue(null);
    const res = await approvePayroll("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("refuses to approve a run from a different organization", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:"other-org", status:"processing" });
    const res = await approvePayroll("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("blocks approval of a run that's already been paid", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:ORG, status:"paid" });
    const res = await approvePayroll("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("approves a run in processing status", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:ORG, status:"processing" });
    const res = await approvePayroll("run-1", "user-1", ORG);
    expect(res.success).toBe(true);
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});

describe("markPayrollPaid", () => {
  it("requires the run to be approved first", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:ORG, status:"processing" });
    const res = await markPayrollPaid("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("اعتماد الكشف أولاً");
  });

  it("refuses to mark a run from a different organization as paid", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:"other-org", status:"approved" });
    const res = await markPayrollPaid("run-1", "user-1", ORG);
    expect(res.success).toBe(false);
  });

  it("marks an approved run as paid", async () => {
    mockRunFindFirst.mockResolvedValue({ id:"run-1", organizationId:ORG, status:"approved" });
    const res = await markPayrollPaid("run-1", "user-1", ORG);
    expect(res.success).toBe(true);
  });
});

describe("updateContractAllowances", () => {
  beforeEach(() => { mockUpdateSetArgs.length = 0; });

  it("rejects when the caller lacks edit permission", async () => {
    mockSessionOk = false;
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: 100, transportAllowance: 50 });
    expect(res.success).toBe(false);
  });

  it("returns an error when the contract doesn't exist", async () => {
    mockContractFindFirst.mockResolvedValue(null);
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: 100, transportAllowance: 50 });
    expect(res.success).toBe(false);
  });

  it("refuses to update a contract from a different organization (IDOR guard)", async () => {
    mockContractFindFirst.mockResolvedValue({ id:"contract-1", organizationId:"other-org", housingAllowance:null, transportAllowance:null });
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: 100, transportAllowance: 50 });
    expect(res.success).toBe(false);
  });

  it("rejects negative values", async () => {
    mockContractFindFirst.mockResolvedValue({ id:"contract-1", organizationId:ORG, housingAllowance:null, transportAllowance:null });
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: -50, transportAllowance: 50 });
    expect(res.success).toBe(false);
  });

  it("saves a per-contract override", async () => {
    mockContractFindFirst.mockResolvedValue({ id:"contract-1", organizationId:ORG, housingAllowance:null, transportAllowance:null });
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: 450, transportAllowance: 75 });
    expect(res.success).toBe(true);
    expect(mockUpdateSetArgs[0]).toMatchObject({ housingAllowance: "450", transportAllowance: "75" });
  });

  it("clears the override back to null (falls back to catalog default) when null is passed", async () => {
    mockContractFindFirst.mockResolvedValue({ id:"contract-1", organizationId:ORG, housingAllowance:"450", transportAllowance:"75" });
    const res = await updateContractAllowances(ORG, "contract-1", "user-1", { housingAllowance: null, transportAllowance: null });
    expect(res.success).toBe(true);
    expect(mockUpdateSetArgs[0]).toMatchObject({ housingAllowance: null, transportAllowance: null });
  });
});

describe("processPayroll", () => {
  function baseContract(overrides: Partial<any> = {}) {
    return {
      id: "contract-1", employeeId: "emp-1", organizationId: ORG,
      baseSalary: "1000", housingAllowance: "0", transportAllowance: "0",
      grantId: null, budgetLineId: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    txInsertCalls.length = 0;
    txUpdateCalls.length = 0;
    mockRunReturned = { id: "run-1" };
    mockRunFindFirst.mockResolvedValue(null); // لا يوجد كشف رواتب مكرر
    mockAttendanceFindMany.mockResolvedValue([]);
    mockSalaryComponentsFindMany.mockResolvedValue([]);
    mockGrantBudgetLinesFindMany.mockResolvedValue([]);
    mockAdjustmentsFindMany.mockResolvedValue([]);
  });

  it("rejects when a payroll run already exists for the period", async () => {
    mockRunFindFirst.mockResolvedValue({ id: "existing-run" });
    mockContractsFindMany.mockResolvedValue([baseContract()]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(false);
  });

  // إصلاح v34-تتمة-2: الفحص التطبيقي وحده check-then-act بلا قفل — قيد DB
  // حقيقي أُضيف بـmigration 015. لو مرّ طلبان متزامنان الفحص التطبيقي معاً،
  // الإدراج الثاني يجب أن يفشل بخطأ postgres 23505 ويُترجَم لرسالة ودّية،
  // لا يتسرب خطأ postgres خام للمستخدم.
  it("translates a postgres unique_violation (23505) on the DB constraint into a friendly duplicate-run message", async () => {
    mockContractsFindMany.mockResolvedValue([baseContract()]);
    mockRunReturned = { id: "run-1" }; // ignored — insert throws below instead
    const pgError = Object.assign(new Error("duplicate key value violates unique constraint \"payroll_runs_org_period_uidx\""), { code: "23505" });
    const originalTx = (await import("@/db")).db.transaction as any;
    originalTx.mockImplementationOnce(() => { throw pgError; });
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toBe("كشف رواتب 1/2026 موجود بالفعل");
  });

  it("rejects when there are no active employees", async () => {
    mockContractsFindMany.mockResolvedValue([]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(false);
  });

  // ─── توحيد idempotency (v39 — راجع SECURITY_NOTES.md) ───────────
  describe("idempotency (withIdempotency)", () => {
    it("passes organizationId/idempotencyKey/action through to withIdempotency unchanged", async () => {
      mockContractsFindMany.mockResolvedValue([baseContract()]);
      await processPayroll(ORG, 1, 2026, "user-1", "client-key-123");
      expect(mockWithIdempotency).toHaveBeenCalledWith(ORG, "client-key-123", "processPayroll", expect.any(Function));
    });

    it("still runs normally (no idempotencyKey) for existing callers that don't pass one yet", async () => {
      mockContractsFindMany.mockResolvedValue([baseContract()]);
      const res = await processPayroll(ORG, 1, 2026, "user-1");
      expect(res.success).toBe(true);
      expect(mockWithIdempotency).toHaveBeenCalledWith(ORG, undefined, "processPayroll", expect.any(Function));
    });

    it("translates an in-progress duplicate (same key, concurrent request) into a friendly retry message", async () => {
      mockWithIdempotency.mockImplementationOnce(() => { throw new MockIdempotencyInProgressError(); });
      const res = await processPayroll(ORG, 1, 2026, "user-1", "client-key-123");
      expect(res.success).toBe(false);
      if (!res.success) expect(res.error).toContain("قيد التنفيذ حالياً");
    });

    // هذا هو صلب الفائدة من التوحيد: إعادة إرسال نفس الطلب (نفس المفتاح)
    // بعد نجاحه يجب أن تُعيد نفس النتيجة المخزَّنة — لا خطأ "كشف مكرر" ولا
    // تنفيذاً ثانياً لفحص التكرار (mockRunFindFirst) أو للمعاملة نفسها.
    it("returns the original cached result on retry instead of re-running the duplicate-period check", async () => {
      const cachedResult = { success:true as const, data:{ runId:"run-cached", totalNet:500 } };
      mockWithIdempotency.mockImplementationOnce(async () => cachedResult);
      const res = await processPayroll(ORG, 1, 2026, "user-1", "client-key-123");
      expect(res).toEqual(cachedResult);
      expect(mockRunFindFirst).not.toHaveBeenCalled();
    });
  });

  // إصلاح حرج v34: كان استعلام جلب العقود النشطة لا يُفلتر بـ organizationId
  // إطلاقاً — أي أن تشغيل رواتب لمنظمة واحدة كان يحسب ويُدرج رواتب موظفي
  // *كل* المنظمات الأخرى على النظام، ويخصم من ميزانياتهم كذلك. راجع الشرح
  // الكامل بـ SECURITY_NOTES.md § v34.
  it("filters active contracts and attendance by organizationId (critical cross-tenant fix)", async () => {
    mockContractsFindMany.mockResolvedValue([baseContract()]);
    await processPayroll(ORG, 1, 2026, "user-1");
    const { inspect } = await import("node:util");
    const contractsArgs = mockContractsFindMany.mock.calls[0][0];
    expect(inspect(contractsArgs, { depth: 12 })).toContain(ORG);
    expect(mockAttendanceFindMany).toHaveBeenCalled();
    const attArgs = mockAttendanceFindMany.mock.calls[0][0];
    expect(inspect(attArgs, { depth: 12 })).toContain(ORG);
  });

  it("batches all payroll lines into a single insert instead of one per employee", async () => {
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1" }),
      baseContract({ id: "c2", employeeId: "emp-2" }),
      baseContract({ id: "c3", employeeId: "emp-3" }),
    ]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(true);
    const lineInserts = txInsertCalls.filter(c => c.table === "payrollLines");
    expect(lineInserts).toHaveLength(1); // إدراج واحد فقط بغض النظر عن عدد الموظفين
    expect(lineInserts[0].values).toHaveLength(3);
  });

  it("blocks the whole run when a single employee's salary exceeds their budget line", async () => {
    mockGrantBudgetLinesFindMany.mockResolvedValue([
      { id: "bl-1", plannedAmount: "500", committedAmount: "0", spentAmount: "0" },
    ]);
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1", baseSalary: "1000", budgetLineId: "bl-1" }),
    ]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("ميزانية غير كافية");
  });

  it("catches cumulative overspend when several employees share the same budget line in one run — this is the correctness fix from batching (previously each employee was checked against the same stale DB value)", async () => {
    mockGrantBudgetLinesFindMany.mockResolvedValue([
      { id: "bl-1", plannedAmount: "1500", committedAmount: "0", spentAmount: "0" },
    ]);
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1", baseSalary: "1000", budgetLineId: "bl-1" }),
      baseContract({ id: "c2", employeeId: "emp-2", baseSalary: "1000", budgetLineId: "bl-1" }),
    ]);
    // كل موظف وحده أقل من الميزانية (1000 < 1500)، لكن مجموعهم (2000) يتجاوزها
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("ميزانية غير كافية");
    // ما لازم يصير أي إدراج لأن المعاملة كاملة لازم تفشل (rollback)
    expect(txInsertCalls.filter(c => c.table === "payrollLines")).toHaveLength(0);
  });

  it("allows several employees sharing a budget line when their combined salary fits", async () => {
    mockGrantBudgetLinesFindMany.mockResolvedValue([
      { id: "bl-1", plannedAmount: "3000", committedAmount: "0", spentAmount: "0" },
    ]);
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1", baseSalary: "1000", budgetLineId: "bl-1" }),
      baseContract({ id: "c2", employeeId: "emp-2", baseSalary: "1000", budgetLineId: "bl-1" }),
    ]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(true);
    // تحديث واحد فقط لبند الميزانية (بمجموع الاثنين) بدل تحديث لكل موظف
    const budgetUpdates = txUpdateCalls.filter(c => c.table === "grantBudgetLines");
    expect(budgetUpdates).toHaveLength(1);
  });

  it("uses the per-contract allowance override, not the org catalog default, when computing pay", async () => {
    mockSalaryComponentsFindMany.mockResolvedValue([
      { componentType: "allowance", code: "HOUSE", defaultValue: "200" },
    ]);
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1", housingAllowance: "999" }),
    ]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(true);
    const line = txInsertCalls.find(c => c.table === "payrollLines")!.values[0];
    expect(line.housingAllowance).toBe("999"); // مو "200" (قيمة الكتالوج)
  });

  it("applies the per-employee bonus/deduction adjustments entered for the period, not a flat catalog value", async () => {
    mockContractsFindMany.mockResolvedValue([
      baseContract({ id: "c1", employeeId: "emp-1" }),
      baseContract({ id: "c2", employeeId: "emp-2" }), // بدون تعديلات — يجب أن يبقى صفر
    ]);
    mockAdjustmentsFindMany.mockResolvedValue([
      { id: "adj-1", employeeId: "emp-1", adjustmentType: "bonus",     amount: "150" },
      { id: "adj-2", employeeId: "emp-1", adjustmentType: "deduction", amount: "40"  },
    ]);
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(true);
    const lines = txInsertCalls.find(c => c.table === "payrollLines")!.values;
    const emp1 = lines.find((l: any) => l.employeeId === "emp-1");
    const emp2 = lines.find((l: any) => l.employeeId === "emp-2");
    expect(emp1.performanceBonus).toBe("150");
    expect(emp1.loanDeduction).toBe("40");
    expect(emp2.performanceBonus).toBe("0");
    expect(emp2.loanDeduction).toBe("0");
  });

  it("marks consumed adjustments with the resulting run id in a single batched update", async () => {
    mockContractsFindMany.mockResolvedValue([baseContract({ id: "c1", employeeId: "emp-1" })]);
    mockAdjustmentsFindMany.mockResolvedValue([
      { id: "adj-1", employeeId: "emp-1", adjustmentType: "bonus", amount: "100" },
    ]);
    mockRunReturned = { id: "run-99" };
    const res = await processPayroll(ORG, 1, 2026, "user-1");
    expect(res.success).toBe(true);
    const adjUpdates = txUpdateCalls.filter(c => c.table === "payrollAdjustments");
    expect(adjUpdates).toHaveLength(1);
    expect(adjUpdates[0].values).toMatchObject({ consumedInRunId: "run-99" });
  });
});

describe("addPayrollAdjustment", () => {
  beforeEach(() => {
    mockRunFindFirst.mockResolvedValue(null);
    mockAssertOwnedByOrg.mockResolvedValue(true);
  });

  it("rejects when the caller lacks edit permission", async () => {
    mockSessionOk = false;
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "مكافأة أداء",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a non-positive amount", async () => {
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 0, description: "مكافأة أداء",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a description that's too short (no real justification given)", async () => {
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "ok",
    });
    expect(res.success).toBe(false);
  });

  it("refuses to add an adjustment for a period that's already been processed", async () => {
    mockRunFindFirst.mockResolvedValue({ id: "run-1" });
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "مكافأة أداء",
    });
    expect(res.success).toBe(false);
  });

  it("saves a valid adjustment", async () => {
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "مكافأة أداء Q1",
    });
    expect(res.success).toBe(true);
  });

  // ─── إصلاح IDOR (v35) ───────────────────────────────────────────
  it("refuses an employeeId belonging to a different organization", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "مكافأة أداء Q1",
    });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error).toContain("الموظف غير موجود");
  });

  it("refuses a non-existent employeeId", async () => {
    mockAssertOwnedByOrg.mockResolvedValueOnce(false);
    const res = await addPayrollAdjustment(ORG, "user-1", {
      employeeId: "11111111-1111-1111-1111-111111111112", month: 1, year: 2026,
      adjustmentType: "bonus", amount: 100, description: "مكافأة أداء Q1",
    });
    expect(res.success).toBe(false);
  });
});

describe("deletePayrollAdjustment", () => {
  it("rejects when the caller lacks edit permission", async () => {
    mockSessionOk = false;
    const res = await deletePayrollAdjustment(ORG, "user-1", "adj-1");
    expect(res.success).toBe(false);
  });

  it("returns an error when the adjustment doesn't exist", async () => {
    mockAdjustmentFindFirst.mockResolvedValue(null);
    const res = await deletePayrollAdjustment(ORG, "user-1", "adj-1");
    expect(res.success).toBe(false);
  });

  it("refuses to delete an adjustment from a different organization (IDOR guard)", async () => {
    mockAdjustmentFindFirst.mockResolvedValue({ id: "adj-1", organizationId: "other-org", consumedInRunId: null });
    const res = await deletePayrollAdjustment(ORG, "user-1", "adj-1");
    expect(res.success).toBe(false);
  });

  it("refuses to delete an adjustment already consumed by a processed payroll run", async () => {
    mockAdjustmentFindFirst.mockResolvedValue({ id: "adj-1", organizationId: ORG, consumedInRunId: "run-1" });
    const res = await deletePayrollAdjustment(ORG, "user-1", "adj-1");
    expect(res.success).toBe(false);
  });

  it("deletes a valid, unconsumed adjustment", async () => {
    mockAdjustmentFindFirst.mockResolvedValue({ id: "adj-1", organizationId: ORG, consumedInRunId: null });
    const res = await deletePayrollAdjustment(ORG, "user-1", "adj-1");
    expect(res.success).toBe(true);
  });
});
