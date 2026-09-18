const { Pool } = require("pg");
require("dotenv").config({ path: ".env.production" });

const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@myorg.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "Admin@1234";

function errMsg(e, fallback = "Unknown error") {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return fallback;
}

async function seedProduction() {
  console.log("Production Seed starting...\n");
  console.log("DATABASE_URL:", process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 40) + "..." : "NOT SET");
  console.log("SEED_ADMIN_EMAIL:", ADMIN_EMAIL);
  console.log("");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // Enable pgcrypto for bcrypt hashing via PostgreSQL
    console.log("[0/7] Enabling pgcrypto extension...");
    await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    console.log("   OK");

    // ─── 1. Organization ──────────────────
    console.log("\n[1/7] Creating organization...");
    const orgRes = await client.query(`
      INSERT INTO organizations (name, name_ar, code, email, is_active, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name
    `, ["My Organization", "مؤسستي", "ORG-001", "info@myorg.com", true, SYSTEM_UUID]);
    const orgId = orgRes.rows[0].id;
    console.log("   OK:", orgRes.rows[0].name, "(" + orgId + ")");

    // ─── 2. Admin User ──────────────────
    console.log("\n[2/7] Creating super_admin user...");
    const adminRes = await client.query(`
      INSERT INTO users (
        organization_id, email, password_hash,
        first_name, last_name, first_name_ar, last_name_ar,
        role, is_active, created_by
      ) VALUES (
        $1, $2,
        crypt($3::text, gen_salt('bf', 12)),
        $4, $5, $6, $7,
        $8::user_role, $9, $10
      )
      RETURNING id, email
    `, [
      orgId, ADMIN_EMAIL, ADMIN_PASSWORD,
      "Admin", "User", "المدير", "العام",
      "super_admin", true, SYSTEM_UUID
    ]);
    const adminUserId = adminRes.rows[0].id;
    console.log("   OK:", adminRes.rows[0].email, "(" + adminUserId + ")");
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log("   WARNING: Using default password! Set SEED_ADMIN_PASSWORD before production.");
    }

    // ─── 3. Currencies ──────────────────
    console.log("\n[3/7] Creating currencies...");
    const currencyData = [
      { code:"USD", name:"US Dollar",         nameAr:"دولار أمريكي",  symbol:"$",   exchangeRate:"1",    isBase:true  },
      { code:"EUR", name:"Euro",              nameAr:"يورو",           symbol:"€",   exchangeRate:"0.92", isBase:false },
      { code:"JOD", name:"Jordanian Dinar",   nameAr:"دينار أردني",    symbol:"JD",  exchangeRate:"0.71", isBase:false },
      { code:"SAR", name:"Saudi Riyal",       nameAr:"ريال سعودي",     symbol:"SR",  exchangeRate:"3.75", isBase:false },
      { code:"AED", name:"UAE Dirham",        nameAr:"درهم إماراتي",   symbol:"AED", exchangeRate:"3.67", isBase:false },
    ];
    const insertedCurrencies = {};
    for (const c of currencyData) {
      const res = await client.query(`
        INSERT INTO currencies (code, name, name_ar, symbol, exchange_rate, is_base, is_active)
        VALUES ($1, $2, $3, $4, $5::decimal, $6, $7)
        RETURNING id, code
      `, [c.code, c.name, c.nameAr, c.symbol, c.exchangeRate, c.isBase, true]);
      insertedCurrencies[c.code] = res.rows[0].id;
      console.log("   OK:", c.code, "—", c.nameAr);
    }
    const usdId = insertedCurrencies["USD"];

    // ─── 4. Cost Centers ──────────────────
    console.log("\n[4/7] Creating cost centers...");
    const ccData = [
      { code:"ADM", name:"Administration",  nameAr:"الإدارة" },
      { code:"PRG", name:"Programs",        nameAr:"البرامج" },
      { code:"FIN", name:"Finance",         nameAr:"المالية" },
      { code:"HR",  name:"Human Resources", nameAr:"الموارد البشرية" },
      { code:"LOG", name:"Logistics",       nameAr:"اللوجستيات" },
    ];
    const insertedCC = {};
    for (const cc of ccData) {
      const res = await client.query(`
        INSERT INTO cost_centers (organization_id, code, name, name_ar, is_active, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, code
      `, [orgId, cc.code, cc.name, cc.nameAr, true, adminUserId]);
      insertedCC[cc.code] = res.rows[0].id;
      console.log("   OK:", cc.code, "—", cc.nameAr);
    }

    // ─── 5. Fiscal Year & Periods ──────────────────
    console.log("\n[5/7] Creating fiscal year 2025 with 12 periods...");
    const fyRes = await client.query(`
      INSERT INTO fiscal_years (organization_id, name, start_date, end_date, is_closed, created_by)
      VALUES ($1, $2, $3::timestamptz, $4::timestamptz, $5, $6)
      RETURNING id, name
    `, [orgId, "2025", "2025-01-01", "2025-12-31", false, adminUserId]);
    const fyId = fyRes.rows[0].id;

    const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(2025, m, 1));
      const end = new Date(Date.UTC(2025, m + 1, 0, 23, 59, 59));
      await client.query(`
        INSERT INTO fiscal_periods (
          organization_id, fiscal_year_id, name, period_number,
          start_date, end_date, is_closed, created_by
        ) VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8)
      `, [
        orgId, fyId, MONTHS_AR[m] + " 2025", m + 1,
        start.toISOString(), end.toISOString(),
        false, adminUserId
      ]);
    }
    console.log("   OK: Fiscal year 2025 with 12 monthly periods");

    // ─── 6. Chart of Accounts ──────────────────
    console.log("\n[6/7] Creating chart of accounts...");
    const accountsData = [
      // Assets
      { code:"1000", name:"Current Assets",      nameAr:"الأصول المتداولة",    accountType:"asset",     isControl:true  },
      { code:"1100", name:"Cash",                nameAr:"النقدية",              accountType:"asset",     isControl:false },
      { code:"1200", name:"Bank Accounts",       nameAr:"الحسابات البنكية",     accountType:"asset",     isControl:false },
      { code:"1300", name:"Accounts Receivable", nameAr:"المدينون",             accountType:"asset",     isControl:false },
      { code:"1500", name:"Fixed Assets",        nameAr:"الأصول الثابتة",       accountType:"asset",     isControl:true  },
      { code:"1510", name:"Equipment",           nameAr:"الأجهزة والمعدات",     accountType:"asset",     isControl:false },
      { code:"1520", name:"Vehicles",            nameAr:"المركبات",             accountType:"asset",     isControl:false },
      // Liabilities
      { code:"2000", name:"Current Liabilities", nameAr:"الخصوم المتداولة",     accountType:"liability", isControl:true  },
      { code:"2100", name:"Accounts Payable",    nameAr:"الدائنون",             accountType:"liability", isControl:false },
      { code:"2200", name:"Accrued Expenses",    nameAr:"المصاريف المستحقة",    accountType:"liability", isControl:false },
      // Equity
      { code:"3000", name:"Equity",              nameAr:"حقوق الملكية",         accountType:"equity",    isControl:true  },
      { code:"3100", name:"Retained Earnings",   nameAr:"الأرباح المبقاة",      accountType:"equity",    isControl:false },
      // Revenue
      { code:"4000", name:"Revenue",             nameAr:"الإيرادات",            accountType:"revenue",   isControl:true  },
      { code:"4100", name:"Grant Revenue",       nameAr:"إيرادات المنح",        accountType:"revenue",   isControl:false },
      { code:"4200", name:"Other Revenue",       nameAr:"إيرادات أخرى",         accountType:"revenue",   isControl:false },
      // Expenses
      { code:"5000", name:"Expenses",            nameAr:"المصاريف",              accountType:"expense",   isControl:true  },
      { code:"5100", name:"Staff Costs",         nameAr:"تكاليف الموظفين",      accountType:"expense",   isControl:false },
      { code:"5200", name:"Program Expenses",    nameAr:"مصاريف البرامج",       accountType:"expense",   isControl:false },
      { code:"5300", name:"Admin Expenses",      nameAr:"المصاريف الإدارية",    accountType:"expense",   isControl:false },
      { code:"5400", name:"Travel Expenses",     nameAr:"مصاريف السفر",         accountType:"expense",   isControl:false },
      { code:"5500", name:"Procurement Expenses",nameAr:"مصاريف المشتريات",     accountType:"expense",   isControl:false },
    ];
    for (const acc of accountsData) {
      await client.query(`
        INSERT INTO accounts (
          organization_id, code, name, name_ar,
          account_type, is_control, currency_id,
          current_balance, is_active, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5::account_type, $6, $7,
          $8::decimal, $9, $10
        )
      `, [
        orgId, acc.code, acc.name, acc.nameAr,
        acc.accountType, acc.isControl, usdId,
        "0", true, adminUserId
      ]);
    }
    console.log("   OK:", accountsData.length, "accounts created");

    // ─── Summary ──────────────────
    console.log("\n" + "=".repeat(50));
    console.log("PRODUCTION SEED COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(50));
    console.log("Organization: My Organization (مؤسستي) — ID:", orgId);
    console.log("Admin User:", ADMIN_EMAIL, "— ID:", adminUserId);
    console.log("Admin Role: super_admin");
    console.log("Currencies:", Object.keys(insertedCurrencies).length, " (USD as base)");
    console.log("Cost Centers:", Object.keys(insertedCC).length, " (ADM, PRG, FIN, HR, LOG)");
    console.log("Fiscal Year: 2025 (12 monthly periods)");
    console.log("Chart of Accounts:", accountsData.length, "accounts");
    console.log("=".repeat(50));
    console.log("\nYou can now log in with:");
    console.log("  Email:    " + ADMIN_EMAIL);
    console.log("  Password: " + (process.env.SEED_ADMIN_PASSWORD ? "(value from SEED_ADMIN_PASSWORD)" : "Admin@1234 (DEFAULT!)"));
    console.log("");

  } finally {
    client.release();
    await pool.end();
  }
}

seedProduction()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\nFATAL seed error:", errMsg(e));
    if (e && e.stack) console.error(e.stack);
    process.exit(1);
  });
