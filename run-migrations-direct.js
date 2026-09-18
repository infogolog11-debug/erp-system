const { readFileSync } = require("fs");
const { join } = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: ".env.production" });

const MIGRATIONS = [
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

function errMsg(e, fallback = "Unknown error") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

async function runMigrations() {
  console.log("Migration runner starting...\n");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) + "..." : "NOT SET");
  console.log("");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log("Connected to database. Starting migrations 001 -> 016\n");

  const results = { succeeded: [], skipped: [], failed: [] };

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id         SERIAL PRIMARY KEY,
        filename   TEXT UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT now()
      )
    `);
    console.log("_migrations table ready\n");

    const migrationsDir = join(__dirname, "src", "db", "migrations");

    for (const file of MIGRATIONS) {
      const { rows } = await client.query(
        "SELECT id FROM _migrations WHERE filename = $1", [file]
      );
      if (rows.length > 0) {
        console.log("[SKIP]    " + file + " — already applied");
        results.skipped.push(file);
        continue;
      }

      console.log("[RUNNING] " + file + "...");
      const sqlPath = join(migrationsDir, file);
      let sql;
      try {
        sql = readFileSync(sqlPath, "utf-8");
      } catch (readErr) {
        console.log("[FAIL]    Cannot read file: " + errMsg(readErr));
        results.failed.push({ file, error: errMsg(readErr) });
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log("[OK]      " + file + " — applied successfully");
        results.succeeded.push(file);
      } catch (e) {
        await client.query("ROLLBACK");
        const msg = errMsg(e);
        console.log("[FAIL]    " + file + ": " + msg);
        results.failed.push({ file, error: msg });
        break;
      }
      console.log("");
    }

  } finally {
    client.release();
    await pool.end();
  }

  console.log("\n==================================================");
  console.log("MIGRATION SUMMARY");
  console.log("==================================================");
  console.log("Total migrations list: " + MIGRATIONS.length);
  console.log("Succeeded:  " + results.succeeded.length + " -> [" + results.succeeded.join(", ") + "]");
  console.log("Skipped:    " + results.skipped.length + " -> [" + results.skipped.join(", ") + "]");
  console.log("Failed:     " + results.failed.length);
  if (results.failed.length > 0) {
    results.failed.forEach(f => console.log("  - " + f.file + ": " + f.error));
  }
  console.log("==================================================");

  if (results.failed.length > 0) {
    process.exit(1);
  }
  console.log("\nAll migrations completed successfully!");
}

runMigrations().catch(e => {
  console.error("FATAL migration error:", errMsg(e));
  process.exit(1);
});
