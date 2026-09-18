import { describe, it, expect, beforeEach } from "vitest";

// ════════════════════════════════════════════════════════════════
// ملاحظة صادقة عن حدود هذا الاختبار: منطق issueStock/receiveStock
// الفعلي (src/lib/inventory/stock-movement.ts) يعتمد على أن Postgres
// نفسه ينفّذ UPDATE ... WHERE current_stock >= qty كعبارة SQL واحدة
// ذرّية — وهي الخاصية التي تحل Race Condition، ولا يمكن محاكاتها بصدق
// عبر mock لمكتبة drizzle (أي محاكاة كهذه ستفترض الذرّية بدل اختبارها).
// الاختبار الحقيقي لهذه الخاصية يحتاج Postgres فعلي (راجع البند "لم
// يُختبر بعد" بـ final-checklist.md لاختبار تكامل ضد قاعدة حقيقية).
//
// ما نختبره هنا بصدق: أن *خوارزمية* الشرط (check-and-decrement بعبارة
// واحدة، لا قراءة ثم كتابة منفصلتين) تعطي النتيجة الصحيحة رياضياً تحت
// تنفيذ متزامن — أي أن التصميم نفسه سليم، حتى لو أثبات الذرّية الفعلية
// على القرص يبقى مسؤولية Postgres وليس هذا الاختبار.
// ════════════════════════════════════════════════════════════════

let balance: number;

// نفس شرط عبارة UPDATE الموجودة فعلياً في stock-movement.ts، بلا نافذة
// زمنية بين الفحص والخصم (سطر واحد، لا await بينهما)
function atomicIssue(qty: number): { success: boolean; error?: string } {
  if (balance < qty) return { success: false, error: `المخزون غير كافٍ — المتاح ${balance}` };
  balance -= qty;
  return { success: true };
}

beforeEach(() => { balance = 10; });

describe("atomic issue condition (matches the WHERE clause in stock-movement.ts)", () => {
  it("never allows the balance to go negative when two concurrent issues exceed available stock", async () => {
    const [r1, r2] = await Promise.all([
      Promise.resolve(atomicIssue(7)),
      Promise.resolve(atomicIssue(7)),
    ]);
    const successes = [r1, r2].filter((r) => r.success);
    expect(successes.length).toBe(1);
    expect(balance).toBeGreaterThanOrEqual(0);
    expect(balance).toBe(3);
  });

  it("allows both when combined quantity fits within balance", async () => {
    const [r1, r2] = await Promise.all([
      Promise.resolve(atomicIssue(4)),
      Promise.resolve(atomicIssue(4)),
    ]);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(balance).toBe(2);
  });

  it("rejects a single request exceeding the available balance with a clear message", () => {
    const res = atomicIssue(999);
    expect(res.success).toBe(false);
    expect(res.error).toContain("غير كافٍ");
  });
});
