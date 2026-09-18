import { describe, it, expect, vi, beforeEach } from "vitest";

// سلسلة مخزَّنة في الذاكرة تحاكي جدول audit_logs مرتباً حسب createdAt،
// حتى نقدر نختبر verifyAuditChain فعلياً (يقرأ عدة سطور بالترتيب)
let rows: any[] = [];
let idCounter = 0;

vi.mock("@/db", () => ({
  db: {
    query: {
      auditLogs: {
        findFirst: vi.fn(async () => (rows.length ? rows[rows.length - 1] : undefined)),
        findMany: vi.fn(async () => [...rows]),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(async (row: any) => {
        const stored = { ...row, id: `row-${++idCounter}`, createdAt: new Date(row.createdAt) };
        rows.push(stored);
        return [stored];
      }),
    })),
  },
}));

import { createAuditLog, verifyAuditChain } from "../audit-trail";

const ORG = "org-1";

beforeEach(() => { rows = []; idCounter = 0; });

describe("createAuditLog + verifyAuditChain (hash chain)", () => {
  it("builds a valid chain across multiple sequential writes", async () => {
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "CREATE", newValues: { a: 1 } });
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "UPDATE", oldValues: { a: 1 }, newValues: { a: 2 } });
    await createAuditLog({ organizationId: ORG, userId: "u2", tableName: "items", recordId: "r1", action: "DELETE", oldValues: { a: 2 } });

    expect(rows.length).toBe(3);
    expect(rows[0].prevHash).toBeNull();
    expect(rows[1].prevHash).toBe(rows[0].hash);
    expect(rows[2].prevHash).toBe(rows[1].hash);

    const result = await verifyAuditChain(ORG);
    expect(result.valid).toBe(true);
  });

  it("detects tampering when a row's content is altered after the fact (without recomputing the hash)", async () => {
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "CREATE", newValues: { a: 1 } });
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "UPDATE", newValues: { a: 2 } });

    // محاكاة تعديل مباشر على القاعدة (UPDATE يدوي على newValues) بدون إعادة حساب الـ hash —
    // بالضبط سيناريو "من يحمي الـ Hash Chain نفسها؟" المطروح بملف الانتقاد
    rows[0].newValues = JSON.stringify({ a: 999 });

    const result = await verifyAuditChain(ORG);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.brokenAtRecordId).toBe(rows[0].id);
      expect(result.reason).toContain("لا يطابق تجزئته");
    }
  });

  it("detects a broken prevHash link if a row is deleted from the middle of the chain", async () => {
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "CREATE" });
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "UPDATE" });
    await createAuditLog({ organizationId: ORG, userId: "u1", tableName: "items", recordId: "r1", action: "DELETE" });

    rows.splice(1, 1); // حذف السطر الأوسط — يكسر تسلسل السطر الثالث

    const result = await verifyAuditChain(ORG);
    expect(result.valid).toBe(false);
  });
});
