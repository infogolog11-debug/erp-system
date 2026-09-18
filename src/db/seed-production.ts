// src/db/seed-production.ts
// بذر بيانات الإنتاج الأساسية فقط — بدون أي بيانات تجريبية (موظفين/موردين/منح وهمية)
// التشغيل: npm run db:seed:prod
// آمن للتشغيل على قاعدة بيانات إنتاج فارغة. لا يُنشئ سوى: المؤسسة، حساب المدير الأول،
// العملات المرجعية، مراكز التكلفة الافتراضية، السنة المالية الحالية، وشجرة الحسابات الأساسية.
import { db } from "./index";
import {
  organizations, users, currencies,
  fiscalYears, fiscalPeriods, costCenters, accounts,
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seedProduction() {
  console.log("🌱 بذر بيانات الإنتاج الأساسية...\n");


  // ─── 1. المؤسسة ──────────────────────────
  console.log("1️⃣  إنشاء المؤسسة...");
  const [org] = await db.insert(organizations).values({
    name:      "My Organization",
    nameAr:    "مؤسستي",
    code:      "ORG-001",
    email:     "info@myorg.com",
    isActive:  true,
    createdBy: "00000000-0000-0000-0000-000000000000",
  }).returning();
  console.log(`   ✓ ${org.name} (${org.id})\n`);

  // ─── 2. المستخدم الرئيسي ──────────────────
  console.log("2️⃣  إنشاء مستخدم super_admin...");
  const adminEmail    = process.env.SEED_ADMIN_EMAIL    ?? "admin@myorg.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234";
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn("   ⚠️  تحذير: تستخدم كلمة مرور افتراضية! عرّف SEED_ADMIN_PASSWORD قبل النشر الحقيقي.");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const [adminUser] = await db.insert(users).values({
    organizationId: org.id,
    email:          adminEmail,
    passwordHash,
    firstName:      "Admin",
    lastName:       "User",
    firstNameAr:    "المدير",
    lastNameAr:     "العام",
    role:           "super_admin",
    isActive:       true,
    createdBy:      "00000000-0000-0000-0000-000000000000",
  }).returning();
  console.log(`   ✓ ${adminUser.email} أُنشئ بنجاح\n`);

  // ─── 4. العملات ───────────────────────────
  console.log("4️⃣  إنشاء العملات...");
  const currencyData = [
    { code:"USD", name:"US Dollar",     nameAr:"دولار أمريكي", symbol:"$",  exchangeRate:"1",      isBase:true  },
    { code:"EUR", name:"Euro",          nameAr:"يورو",         symbol:"€",  exchangeRate:"0.92",   isBase:false },
    { code:"JOD", name:"Jordanian Dinar",nameAr:"دينار أردني", symbol:"JD", exchangeRate:"0.71",   isBase:false },
    { code:"SAR", name:"Saudi Riyal",   nameAr:"ريال سعودي",  symbol:"SR", exchangeRate:"3.75",   isBase:false },
    { code:"AED", name:"UAE Dirham",    nameAr:"درهم إماراتي",symbol:"AED",exchangeRate:"3.67",   isBase:false },
  ];
  const insertedCurrencies: Record<string,string> = {};
  for (const c of currencyData) {
    const [cur] = await db.insert(currencies).values(c).returning();
    insertedCurrencies[c.code] = cur.id;
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
  const insertedCC: Record<string,string> = {};
  for (const cc of ccData) {
    const [c] = await db.insert(costCenters).values({
      ...cc, organizationId:org.id, isActive:true, createdBy:adminUser.id,
    }).returning();
    insertedCC[cc.code] = c.id;
    console.log(`   ✓ ${cc.code} — ${cc.nameAr}`);
  }
  console.log();

  // ─── 6. السنة المالية والفترات ───────────────
  console.log("6️⃣  إنشاء السنة المالية 2025...");
  const [fy] = await db.insert(fiscalYears).values({
    organizationId: org.id,
    name:           "2025",
    startDate:      new Date("2025-01-01"),
    endDate:        new Date("2025-12-31"),
    isClosed:       false,
    createdBy:      adminUser.id,
  }).returning();

  const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const MONTHS_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  for (let m = 0; m < 12; m++) {
    const start = new Date(2025, m, 1);
    const end   = new Date(2025, m + 1, 0);
    await db.insert(fiscalPeriods).values({
      organizationId: org.id,
      fiscalYearId:   fy.id,
      name:           `${MONTHS_AR[m]} 2025`,
      periodNumber:   m + 1,
      startDate:      start,
      endDate:        end,
      isClosed:       false,
      createdBy:      adminUser.id,
    });
  }
  console.log(`   ✓ السنة المالية 2025 مع 12 فترة شهرية\n`);

  // ─── 7. شجرة الحسابات الأساسية ───────────────
  console.log("7️⃣  إنشاء شجرة الحسابات...");
  const accountsData = [
    // الأصول
    { code:"1000", name:"Current Assets",      nameAr:"الأصول المتداولة",    accountType:"asset",     isControl:true  },
    { code:"1100", name:"Cash",                nameAr:"النقدية",              accountType:"asset",     isControl:false },
    { code:"1200", name:"Bank Accounts",       nameAr:"الحسابات البنكية",     accountType:"asset",     isControl:false },
    { code:"1300", name:"Accounts Receivable", nameAr:"المدينون",             accountType:"asset",     isControl:false },
    { code:"1500", name:"Fixed Assets",        nameAr:"الأصول الثابتة",       accountType:"asset",     isControl:true  },
    { code:"1510", name:"Equipment",           nameAr:"الأجهزة والمعدات",     accountType:"asset",     isControl:false },
    { code:"1520", name:"Vehicles",            nameAr:"المركبات",             accountType:"asset",     isControl:false },
    // الخصوم
    { code:"2000", name:"Current Liabilities", nameAr:"الخصوم المتداولة",    accountType:"liability",  isControl:true  },
    { code:"2100", name:"Accounts Payable",    nameAr:"الدائنون",             accountType:"liability",  isControl:false },
    { code:"2200", name:"Accrued Expenses",    nameAr:"المصاريف المستحقة",   accountType:"liability",  isControl:false },
    // حقوق الملكية
    { code:"3000", name:"Equity",              nameAr:"حقوق الملكية",         accountType:"equity",    isControl:true  },
    { code:"3100", name:"Retained Earnings",   nameAr:"الأرباح المبقاة",      accountType:"equity",    isControl:false },
    // الإيرادات
    { code:"4000", name:"Revenue",             nameAr:"الإيرادات",            accountType:"revenue",   isControl:true  },
    { code:"4100", name:"Grant Revenue",       nameAr:"إيرادات المنح",        accountType:"revenue",   isControl:false },
    { code:"4200", name:"Other Revenue",       nameAr:"إيرادات أخرى",         accountType:"revenue",   isControl:false },
    // المصروفات
    { code:"5000", name:"Expenses",            nameAr:"المصروفات",            accountType:"expense",   isControl:true  },
    { code:"5100", name:"Staff Costs",         nameAr:"تكاليف الموظفين",      accountType:"expense",   isControl:false },
    { code:"5200", name:"Program Expenses",    nameAr:"مصاريف البرامج",       accountType:"expense",   isControl:false },
    { code:"5300", name:"Admin Expenses",      nameAr:"المصاريف الإدارية",    accountType:"expense",   isControl:false },
    { code:"5400", name:"Travel Expenses",     nameAr:"مصاريف السفر",         accountType:"expense",   isControl:false },
    { code:"5500", name:"Procurement Expenses",nameAr:"مصاريف المشتريات",     accountType:"expense",   isControl:false },
  ] as const;
  for (const acc of accountsData) {
    await db.insert(accounts).values({
      ...acc,
      organizationId: org.id,
      currencyId:     usdId,
      currentBalance: "0",
      isActive:       true,
      createdBy:      adminUser.id,
    });
  }
  console.log(`   ✓ ${accountsData.length} حساب محاسبي\n`);


  console.log("\n══════════════════════════════════════════════════");
  console.log("✅ تم إعداد بيانات الإنتاج الأساسية بنجاح!\n");
  console.log(`📌 بيانات الدخول الأولى: ${adminEmail}`);
  console.log("   (استخدمت كلمة المرور من SEED_ADMIN_PASSWORD إن وُجدت، وإلا القيمة الافتراضية)");
  console.log("══════════════════════════════════════════════════");
}

seedProduction()
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌ خطأ في بذر بيانات الإنتاج:", e); process.exit(1); });
