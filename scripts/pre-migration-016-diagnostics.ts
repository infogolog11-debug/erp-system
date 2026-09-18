/**
 * ═══════════════════════════════════════════════════════════════
 * فحص تشخيصي قبل تنفيذ migration 016 على بيئة إنتاج فيها بيانات
 * ═══════════════════════════════════════════════════════════════
 * التشغيل:
 *   npx tsx --env-file=.env.production scripts/pre-migration-016-diagnostics.ts
 * (أو أي ملف env يحتوي DATABASE_URL الخاص ببيئة الإنتاج فعلياً — لا تشغّله
 * بالخطأ ضد قاعدة تطوير فارغة وتظن أنه فحص حقيقي).
 *
 * لماذا هذا الملف ضروري قبل أي نشر:
 * migration 016 (src/db/migrations/016_budget_and_disbursement_guards.sql)
 * يضيف CHECK constraints بصيغة ADD CONSTRAINT ... CHECK (بدون NOT VALID).
 * PostgreSQL يفحص *كل صف موجود فعلياً* بالجدول وقت تنفيذ هذا الأمر، ويرفض
 * الـmigration بالكامل (ROLLBACK تلقائي عبر run-migrations.ts) لو وُجد صف
 * واحد مخالف. بما أن SECURITY_NOTES.md وثّق أن ثغرات (budget ceiling race،
 * GRN over-receipt، disbursement race) كانت موجودة فعلياً بالتطبيق قبل
 * إصلاحات actions.ts، فأي بيئة استُخدم فيها الكود القديم *قبل* هذا الإصلاح
 * قد يكون لديها بيانات تاريخية مخالفة فعلاً — ولن تعرف ذلك إلا بتشغيل هذا
 * الفحص، لأن تجربته محلياً على قاعدة تطوير نظيفة لن يكتشف شيئاً.
 *
 * هذا السكريبت للقراءة فقط (SELECT فقط) — لا يُعدّل أي بيانات ولا يُشغّل
 * أي migration. آمن للتشغيل على الإنتاج في أي وقت.
 */
import { Pool } from "pg";

type Check = {
  label: string;
  table: string;
  sql: string;
  sampleColumns: string[];
};

const CHECKS: Check[] = [
  {
    label: "grant_budget_lines — الملتزم + المصروف يتجاوز المخطَّط، أو قيمة سالبة",
    table: "grant_budget_lines",
    sql: `
      SELECT id, planned_amount, committed_amount, spent_amount
      FROM grant_budget_lines
      WHERE committed_amount + spent_amount > planned_amount
         OR committed_amount < 0
         OR spent_amount < 0
    `,
    sampleColumns: ["id", "planned_amount", "committed_amount", "spent_amount"],
  },
  {
    label: "sub_grants — المصروف يتجاوز إجمالي المنحة الفرعية، أو قيمة سالبة",
    table: "sub_grants",
    sql: `
      SELECT id, total_amount, disbursed_amount
      FROM sub_grants
      WHERE disbursed_amount > total_amount
         OR disbursed_amount < 0
    `,
    sampleColumns: ["id", "total_amount", "disbursed_amount"],
  },
  {
    label: "purchase_order_items — الكمية المستلمة تتجاوز المطلوبة، أو قيمة سالبة",
    table: "purchase_order_items",
    sql: `
      SELECT id, quantity, received_qty
      FROM purchase_order_items
      WHERE received_qty > quantity
         OR received_qty < 0
    `,
    sampleColumns: ["id", "quantity", "received_qty"],
  },
];

const SAMPLE_LIMIT = 10;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL غير مُعرَّف — مرّر ملف env الصحيح عبر --env-file");
    process.exit(2);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log("🔍 فحص تشخيصي قبل migration 016 (CHECK constraints)\n");
  console.log(`قاعدة البيانات: ${maskConnectionString(process.env.DATABASE_URL)}\n`);
  console.log("═".repeat(70));

  let totalViolations = 0;
  const violatedChecks: Check[] = [];

  try {
    for (const check of CHECKS) {
      process.stdout.write(`\n📋 ${check.label}\n   الجدول: ${check.table}\n`);

      let countResult;
      try {
        countResult = await client.query(`SELECT COUNT(*)::int AS n FROM (${check.sql}) sub`);
      } catch (e) {
        // الجدول أو الأعمدة غير موجودة بعد (مثلاً بيئة لم تُشغَّل عليها
        // migrations سابقة) — هذا فشل إعداد، وليس نتيجة فحص، فيوقف السكريبت
        // كاملاً بدل طباعة "0 مخالفة" مضللة.
        console.error(`   ❌ فشل الاستعلام (هل شُغِّلت migrations السابقة؟): ${errMsg(e)}`);
        process.exit(2);
      }

      const n = countResult.rows[0]?.n ?? 0;
      if (n === 0) {
        console.log(`   ✅ لا توجد صفوف مخالفة`);
        continue;
      }

      totalViolations += n;
      violatedChecks.push(check);
      console.log(`   🔴 ${n} صف مخالف — سيفشل migration 016 لو نُفِّذ الآن`);

      const sample = await client.query(`${check.sql} LIMIT ${SAMPLE_LIMIT}`);
      console.log(`   عيّنة (حتى ${SAMPLE_LIMIT} صفوف):`);
      for (const row of sample.rows) {
        console.log(
          "     - " +
            check.sampleColumns.map((c) => `${c}=${row[c]}`).join(", "),
        );
      }
    }

    console.log("\n" + "═".repeat(70));

    if (totalViolations === 0) {
      console.log("✅ لا توجد أي صفوف مخالفة بأي من الجداول الثلاثة.");
      console.log("   يمكن تنفيذ migration 016 مباشرة بالصيغة الحالية (npm run db:migrate).");
      process.exit(0);
    }

    console.log(`🔴 إجمالي الصفوف المخالفة: ${totalViolations} عبر ${violatedChecks.length} جدول/جداول.`);
    console.log("\n⚠️  خطة المعالجة الموصى بها قبل أي نشر:");
    console.log("   1) صحّح البيانات المخالفة أعلاه يدوياً (أو بسكريبت تصحيح مخصص)");
    console.log("      حسب السياق التشغيلي الفعلي لكل صف — لا يوجد تصحيح آلي عام آمن");
    console.log("      لأن سبب المخالفة (تجاوز ميزانية، استلام زائد...) يحتاج قراراً بشرياً.");
    console.log("   2) إن تعذّر التصحيح الفوري لكل الصفوف (مثلاً بيانات تاريخية قديمة");
    console.log("      لا يمكن الرجوع لتصحيحها بدقة)، استخدم migration بديلة بصيغة");
    console.log("      NOT VALID ثم VALIDATE CONSTRAINT لاحقاً بدل الصيغة الحالية —");
    console.log("      راجع scripts/016_budget_and_disbursement_guards_not_valid.sql");
    console.log("      المرفق: NOT VALID لا يفحص الصفوف الموجودة عند الإضافة (لا يفشل");
    console.log("      ولا يقفل الجدول)، ويبدأ إنفاذ القيد على أي كتابة جديدة فوراً؛");
    console.log("      VALIDATE CONSTRAINT اللاحقة تفحص الصفوف القديمة بقفل أخف");
    console.log("      (SHARE UPDATE EXCLUSIVE بدل ACCESS EXCLUSIVE) لا يمنع القراءة/الكتابة");
    console.log("      العادية أثناء الفحص — مناسبة لتشغيلها بعد تصحيح تدريجي للبيانات.");
    console.log("   3) أعد تشغيل هذا السكريبت بعد كل دفعة تصحيح للتأكد من الوصول لصفر.");
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

function maskConnectionString(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(تعذّر تحليل رابط الاتصال لعرضه بأمان)";
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

main().catch((e) => {
  console.error("❌ خطأ غير متوقع بالسكريبت التشخيصي:", errMsg(e));
  process.exit(2);
});
