// ═══════════════════════════════════════════════════════════════
// تشغيل الـ Migrations — npx tsx src/db/migrations/run-migrations.ts
// ═══════════════════════════════════════════════════════════════
import { readFileSync } from "fs";
import { join }        from "path";
import { Pool }        from "pg";
import { errMsg } from "@/types/db";

async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log("🚀 بدء تشغيل الـ Migrations...
");

  try {
    // إنشاء جدول تتبع الـ migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT now()
      )
    `);

    const migrations = [
      "001_initial_schema.sql",
      "002_fund_accounting.sql",
      "003_beneficiaries.sql",
      "004_donor_reporting.sql",
      "005_partners.sql",
      "006_fleet.sql",
      "007_cfm.sql",
      "008_screening.sql",
      "009_gis_mapping.sql",
      "010_performance_indexes.sql",
      "011_contract_allowances.sql",
      "012_payroll_adjustments.sql",
      "013_operational_integrity.sql",
      "014_po_item_inventory_link.sql",
      "015_payroll_run_uniqueness.sql",
      "016_budget_and_disbursement_guards.sql",
    ];

    for (const file of migrations) {
      // تحقق إذا كان المايجريشن نُفِّذ مسبقاً
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE filename = $1", [file]
      );
      if (rows.length > 0) {
        console.log(`⏭  ${file} — مُنفَّذ مسبقاً، تم التخطي`);
        continue;
      }

      // تنفيذ الـ migration
      console.log(`⚙️  تنفيذ ${file}...`);
      const sql = readFileSync(join(__dirname, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✅ ${file} — تم بنجاح
`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`فشل ${file}: ${e}`);
      }
    }

    console.log("═".repeat(50));
    console.log("✅ جميع الـ Migrations تمت بنجاح!
");
    console.log("الخطوة التالية: npx tsx src/db/seed.ts");

  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(e => {
  console.error("❌ خطأ في الـ Migration:", errMsg(e));
  process.exit(1);
});
