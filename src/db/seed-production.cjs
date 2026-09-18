// ═══════════════════════════════════════════════════════════════
// Seed Production — CJS version (Pure pg + bcryptjs, no Drizzle/TS alias)
// Usage: node src/db/seed-production.cjs
// Safe to re-run (ON CONFLICT DO NOTHING / idempotent checks)
// ═══════════════════════════════════════════════════════════════
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

function errMsg(e) {
  if (!e) return String(e);
  if (typeof e === "string") return e;
  if (e.message) return e.message;
  if (e.detail) return e.detail;
  return String(e);
}

async function seedProduction() {
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

  console.log("🌱 بذر بيانات الإنتاج الأساسية...\n");

  try {
    await client.query("BEGIN");

    // ─── 1. المؤسسة ──────────────────────────
    console.log("1️⃣  إنشاء المؤسسة...");
    let orgRes = await client.query(
      "SELECT id FROM organizations WHERE code = $1", ["ORG-001"]
    );
    let orgId;
    if (orgRes.rows.length > 0) {
      orgId = orgRes.rows[0].id;
      console.log(`   ✓ المؤسسة موجودة مسبقاً (${orgId})`);
    } else {
      const ins = await client.query(`
        INSERT INTO organizations
          (name, "nameAr", code, email, "isActive", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, name`,
        ["My Organization", "مؤسستي", "ORG-001", "info@myorg.com", true, "00000000-0000-0000-0000-000000000000"]
      );
      orgId = ins.rows[0].id;
      console.log(`   ✓ ${ins.rows[0].name} (${orgId})`);
    }
    console.log();

    // ─── 2. المستخدم الرئيسي ──────────────────
    console.log("2️⃣  إنشاء مستخدم super_admin...");
    const adminEmail    = process.env.SEED_ADMIN_EMAIL    ?? "admin@myorg.com";
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234";
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.warn("   ⚠️  تحذير: تستخدم كلمة مرور افتراضية!");
    }
    let usrRes = await client.query(
      'SELECT id FROM users WHERE email = $1 AND "organizationId" = $2',
      [adminEmail, orgId]
    );
    let adminUserId;
    if (usrRes.rows.length > 0) {
      adminUserId = usrRes.rows[0].id;
      console.log(`   ✓ ${adminEmail} موجود مسبقاً (${adminUserId})`);
    } else {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const ins = await client.query(`
        INSERT INTO users
          ("organizationId", email, "passwordHash", "firstName", "lastName",
           "firstNameAr", "lastNameAr", role, "isActive", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, email`,
        [orgId, adminEmail, passwordHash, "Admin", "User",
         "المدير", "العام", "super_admin", true, "00000000-0000-0000-0000-000000000000"]
      );
      adminUserId = ins.rows[0].id;
      console.log(`   ✓ ${ins.rows[0].email} أُنشئ بنجاح`);
    }
    console.log();

    // ─── 4. العملات ───────────────────────────
    console.log("4️⃣  إنشاء العملات...");
    const currencyData = [
      { code:"USD", name:"US Dollar",        nameAr:"دولار أمريكي",   symbol:"$",   exchangeRate:"1",    isBase:true  },
      { code:"EUR", name:"Euro",             nameAr:"يورو",            symbol:"€",   exchangeRate:"0.92", isBase:false },
      { code:"JOD", name:"Jordanian Dinar",  nameAr:"دينار أردني",     symbol:"JD",  exchangeRate:"0.71", isBase:false },
      { code:"SAR", name:"Saudi Riyal",      nameAr:"ريال سعودي",      symbol:"SR",  exchangeRate:"3.75", isBase:false },
      { code:"AED", name:"UAE Dirham",       nameAr:"درهم إماراتي",    symbol:"AED", exchangeRate:"3.67", isBase:false },
    ];
    const insertedCurrencies = {};
    for (const c of currencyData) {
      const ex = await client.query(
        'SELECT id FROM currencies WHERE code = $1 AND "organizationId" = $2',
        [c.code, orgId]
      );
      if (ex.rows.length > 0) {
        insertedCurrencies[c.code] = ex.rows[0].id;
        console.log(`   ⏭  ${c.code} موجود مسبقاً`);
        continue;
      }
      const ins = await client.query(`
        INSERT INTO currencies
          (code, name, "nameAr", symbol, "exchangeRate", "isBase",
           "organizationId", "isActive", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id, code`,
        [c.code, c.name, c.nameAr, c.symbol, c.exchangeRate, c.isBase,
         orgId, true, adminUserId]
      );
      insertedCurrencies[c.code] = ins.rows[0].id;
      console.log(`   ✓ ${c.code} — ${c.nameAr}`);
    }
    const usdId = insertedCurrencies["USD"];
    console.log();

    // ─── 5. مراكز التكلفة ─────────────────────
    console.log("5️⃣  إنشاء مراكز التكلفة...");
    const ccData = [
      { code:"ADM", name:"Administration",  nameAr:"الإدارة"         },
      { code:"PRG", name:"Programs",        nameAr:"البرامج"         },
      { code:"FIN", name:"Finance",         nameAr:"المالية"         },
      { code:"HR",  name:"Human Resources", nameAr:"الموارد البشرية" },
      { code:"LOG", name:"Logistics",       nameAr:"اللوجستيات"      },
    ];
    const insertedCC = {};
    for (const cc of ccData) {
      const ex = await client.query(
        'SELECT id FROM "costCenters" WHERE code = $1 AND "organizationId" = $2',
        [cc.code, orgId]
      );
      if (ex.rows.length > 0) {
        insertedCC[cc.code] = ex.rows[0].id;
        console.log(`   ⏭  ${cc.code} موجود مسبقاً`);
        continue;
      }
      const ins = await client.query(`
        INSERT INTO "costCenters"
          (code, name, "nameAr", "organizationId", "isActive", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, code`,
        [cc.code, cc.name, cc.nameAr, orgId, true, adminUserId]
      );
      insertedCC[cc.code] = ins.rows[0].id;
      console.log(`   ✓ ${cc.code} — ${cc.nameAr}`);
    }
    console.log();

    // ─── 6. السنة المالية والفترات ───────────────
    console.log("6️⃣  إنشاء السنة المالية 2025...");
    let fyRes = await client.query(
      'SELECT id FROM "fiscalYears" WHERE name = $1 AND "organizationId" = $2',
      ["2025", orgId]
    );
    let fyId;
    if (fyRes.rows.length > 0) {
      fyId = fyRes.rows[0].id;
      console.log(`   ⏭  السنة المالية 2025 موجودة مسبقاً`);
    } else {
      const ins = await client.query(`
        INSERT INTO "fiscalYears"
          ("organizationId", name, "startDate", "endDate", "isClosed", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id`,
        [orgId, "2025", new Date("2025-01-01"), new Date("2025-12-31"), false, adminUserId]
      );
      fyId = ins.rows[0].id;
      const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      for (let m = 0; m < 12; m++) {
        const start = new Date(2025, m, 1);
        const end   = new Date(2025, m + 1, 0);
        await client.query(`
          INSERT INTO "fiscalPeriods"
            ("organizationId", "fiscalYearId", name, "periodNumber",
             "startDate", "endDate", "isClosed", "createdBy")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orgId, fyId, `${MONTHS_AR[m]} 2025`, m + 1, start, end, false, adminUserId]
        );
      }
      console.log(`   ✓ السنة المالية 2025 مع 12 فترة شهرية`);
    }
    console.log();

    // ─── 7. شجرة الحسابات الأساسية ───────────────
    console.log("7️⃣  إنشاء شجرة الحسابات...");
    const accountsData = [
      { code:"1000", name:"Current Assets",      nameAr:"الأصول المتداولة",     accountType:"asset",     isControl:true  },
      { code:"1100", name:"Cash",                nameAr:"النقدية",               accountType:"asset",     isControl:false },
      { code:"1200", name:"Bank Accounts",       nameAr:"الحسابات البنكية",      accountType:"asset",     isControl:false },
      { code:"1300", name:"Accounts Receivable", nameAr:"المدينون",              accountType:"asset",     isControl:false },
      { code:"1500", name:"Fixed Assets",        nameAr:"الأصول الثابتة",        accountType:"asset",     isControl:true  },
      { code:"1510", name:"Equipment",           nameAr:"الأجهزة والمعدات",      accountType:"asset",     isControl:false },
      { code:"1520", name:"Vehicles",            nameAr:"المركبات",              accountType:"asset",     isControl:false },
      { code:"2000", name:"Current Liabilities", nameAr:"الخصوم المتداولة",      accountType:"liability", isControl:true  },
      { code:"2100", name:"Accounts Payable",    nameAr:"الدائنون",              accountType:"liability", isControl:false },
      { code:"2200", name:"Accrued Expenses",    nameAr:"المصاريف المستحقة",     accountType:"liability", isControl:false },
      { code:"3000", name:"Equity",              nameAr:"حقوق الملكية",          accountType:"equity",    isControl:true  },
      { code:"3100", name:"Retained Earnings",   nameAr:"الأرباح المبقاة",       accountType:"equity",    isControl:false },
      { code:"4000", name:"Revenue",             nameAr:"الإيرادات",             accountType:"revenue",   isControl:true  },
      { code:"4100", name:"Grant Revenue",       nameAr:"إيرادات المنح",         accountType:"revenue",   isControl:false },
      { code:"4200", name:"Other Revenue",       nameAr:"إيرادات أخرى",          accountType:"revenue",   isControl:false },
      { code:"5000", name:"Expenses",            nameAr:"المصروفات",             accountType:"expense",   isControl:true  },
      { code:"5100", name:"Staff Costs",         nameAr:"تكاليف الموظفين",       accountType:"expense",   isControl:false },
      { code:"5200", name:"Program Expenses",    nameAr:"مصاريف البرامج",        accountType:"expense",   isControl:false },
      { code:"5300", name:"Admin Expenses",      nameAr:"المصاريف الإدارية",     accountType:"expense",   isControl:false },
      { code:"5400", name:"Travel Expenses",     nameAr:"مصاريف السفر",          accountType:"expense",   isControl:false },
      { code:"5500", name:"Procurement Expenses",nameAr:"مصاريف المشتريات",      accountType:"expense",   isControl:false },
    ];
    let accCount = 0;
    for (const acc of accountsData) {
      const ex = await client.query(
        'SELECT id FROM accounts WHERE code = $1 AND "organizationId" = $2',
        [acc.code, orgId]
      );
      if (ex.rows.length > 0) { continue; }
      await client.query(`
        INSERT INTO accounts
          (code, name, "nameAr", "accountType", "isControl",
           "organizationId", "currencyId", "currentBalance", "isActive", "createdBy")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [acc.code, acc.name, acc.nameAr, acc.accountType, acc.isControl,
         orgId, usdId, "0", true, adminUserId]
      );
      accCount++;
    }
    console.log(`   ✓ تم إنشاء ${accCount} من أصل ${accountsData.length} حساب محاسبي (الباقي موجود مسبقاً)\n`);

    await client.query("COMMIT");

    console.log("\n══════════════════════════════════════════════════");
    console.log("✅ تم إعداد بيانات الإنتاج الأساسية بنجاح!\n");
    console.log(`📌 بيانات الدخول الأولى: ${adminEmail}`);
    console.log("   (استخدمت كلمة المرور من SEED_ADMIN_PASSWORD إن وُجدت، وإلا القيمة الافتراضية)");
    console.log("══════════════════════════════════════════════════");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seedProduction()
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌ خطأ في بذر بيانات الإنتاج:", errMsg(e)); process.exit(1); });
