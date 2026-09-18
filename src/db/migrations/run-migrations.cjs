// ═══════════════════════════════════════════════════════════════
// Run Migrations — CJS version (Pure pg + fs, no @/alias or TS deps)
// Usage: node src/db/migrations/run-migrations.cjs
// ═══════════════════════════════════════════════════════════════
const { readFileSync } = require("fs");
const { join, dirname }  = require("path");
const { Pool }        = require("pg");
const { fileURLToPath } = require("url");

function errMsg(e) {
  if (!e) return String(e);
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  if (e.detail) return e.detail;
  return String(e);
}

const __dirname__ = dirname(__filename);

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL غير معرف في متغيرات البيئة");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : false,
  });
  const client = await pool.connect();

  console.log("🚀 بدء تشغيل الـ Migrations...\n");

  try {
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
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE filename = $1", [file]
      );
      if (rows.length > 0) {
        console.log(`⏭  ${file} — مُنفَّذ مسبقاً، تم التخطي`);
        continue;
      }

      console.log(`⚙️  تنفيذ ${file}...`);
      const sql = readFileSync(join(__dirname__, file), "utf-8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✅ ${file} — تم بنجاح\n`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`فشل ${file}: ${errMsg(e)}`);
      }
    }

    console.log("═".repeat(50));
    console.log("✅ جميع الـ Migrations تمت بنجاح!\n");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch(e => {
  console.error("❌ خطأ في الـ Migration:", errMsg(e));
  process.exit(1);
});
