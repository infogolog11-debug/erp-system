// src/db/seed.ts
// تشغيله مرة واحدة فقط: npm run db:seed
import { db } from "./index";
import {
  organizations, users, currencies, fiscalYears,
  systemSettings,
  fiscalPeriods, costCenters, accounts, donors,
  // HR
  departments, positions, employees, contracts, salaryComponents,
  // Inventory / Assets
  warehouses, itemCategories, items, assets,
} from "./schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("🌱 بدء إنشاء البيانات الأولية...\n");

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
  const passwordHash = await bcrypt.hash("Admin@1234", 12);
  const [adminUser] = await db.insert(users).values({
    organizationId: org.id,
    email:          "admin@myorg.com",
    passwordHash,
    firstName:      "Admin",
    lastName:       "User",
    firstNameAr:    "المدير",
    lastNameAr:     "العام",
    role:           "super_admin",
    isActive:       true,
    createdBy:      "00000000-0000-0000-0000-000000000000",
  }).returning();
  console.log(`   ✓ ${adminUser.email} / كلمة المرور: Admin@1234\n`);

  // ─── 3. مستخدمون تجريبيون ─────────────────
  console.log("3️⃣  إنشاء مستخدمين تجريبيين...");
  const demoUsers = [
    { email:"finance@myorg.com", firstName:"Sara",    lastName:"Finance",  firstNameAr:"سارة",   lastNameAr:"المالية",   role:"finance_manager"     },
    { email:"pm@myorg.com",      firstName:"Ahmed",   lastName:"Programs", firstNameAr:"أحمد",   lastNameAr:"البرامج",   role:"program_manager"     },
    { email:"hr@myorg.com",      firstName:"Lina",    lastName:"HR",       firstNameAr:"لينا",   lastNameAr:"الموارد",   role:"hr_manager"          },
    { email:"proc@myorg.com",    firstName:"Khalid",  lastName:"Proc",     firstNameAr:"خالد",   lastNameAr:"المشتريات", role:"procurement_officer" },
  ] as const;
  for (const u of demoUsers) {
    await db.insert(users).values({
      organizationId: org.id,
      passwordHash:   await bcrypt.hash("Demo@1234", 10),
      isActive:       true,
      createdBy:      adminUser.id,
      ...u,
    });
    console.log(`   ✓ ${u.email} (${u.role})`);
  }
  console.log();

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

  // ─── 8. مانحون تجريبيون ───────────────────
  console.log("8️⃣  إنشاء مانحين تجريبيين...");
  const donorsData = [
    { code:"USAID",  name:"USAID",                         nameAr:"الوكالة الأمريكية للتنمية", donorType:"bilateral",    country:"USA"     },
    { code:"EU",     name:"European Union",                nameAr:"الاتحاد الأوروبي",         donorType:"multilateral", country:"Belgium" },
    { code:"UNICEF", name:"UNICEF",                        nameAr:"يونيسف",                    donorType:"multilateral", country:"USA"     },
    { code:"GIZ",    name:"Deutsche Gesellschaft (GIZ)",   nameAr:"الوكالة الألمانية GIZ",    donorType:"bilateral",    country:"Germany" },
  ];
  for (const d of donorsData) {
    await db.insert(donors).values({
      ...d, organizationId:org.id, isActive:true, createdBy:adminUser.id,
    });
    console.log(`   ✓ ${d.name}`);
  }


  // ─── 9. الأقسام الوظيفية (مدمج من nexus-erp) ─────────────────────────
  console.log("9️⃣  إنشاء الأقسام الوظيفية...");
  const deptData = [
    { code:"ADM", name:"Administration",    nameAr:"الإدارة العامة"      },
    { code:"FIN", name:"Finance",           nameAr:"الإدارة المالية"     },
    { code:"PRG", name:"Programs",          nameAr:"إدارة البرامج"       },
    { code:"HR",  name:"Human Resources",   nameAr:"الموارد البشرية"     },
    { code:"LOG", name:"Logistics",         nameAr:"اللوجستيات والمشتريات" },
    { code:"IT",  name:"Information Technology", nameAr:"تقنية المعلومات" },
  ];
  const insertedDepts: Record<string,string> = {};
  for (const d of deptData) {
    const [dept] = await db.insert(departments).values({
      ...d, organizationId:org.id, isActive:true, createdBy:adminUser.id,
    }).returning();
    insertedDepts[d.code] = dept.id;
    console.log(`   ✓ ${d.code} — ${d.nameAr}`);
  }
  console.log();

  // ─── 10. المسميات الوظيفية ────────────────────────────────────────────
  console.log("🔟 إنشاء المسميات الوظيفية...");
  const posData = [
    { code:"DRG", title:"Director General",     titleAr:"المدير العام",         deptCode:"ADM", gradeLevel:10, minSalary:"3000", maxSalary:"5000" },
    { code:"CFO", title:"Finance Manager",      titleAr:"المدير المالي",        deptCode:"FIN", gradeLevel:8,  minSalary:"2200", maxSalary:"3500" },
    { code:"ACT", title:"Accountant",           titleAr:"محاسب",               deptCode:"FIN", gradeLevel:5,  minSalary:"1000", maxSalary:"1800" },
    { code:"HRM", title:"HR Manager",           titleAr:"مدير الموارد البشرية", deptCode:"HR",  gradeLevel:8,  minSalary:"2000", maxSalary:"3200" },
    { code:"HRO", title:"HR Officer",           titleAr:"موظف موارد بشرية",    deptCode:"HR",  gradeLevel:5,  minSalary:"900",  maxSalary:"1600" },
    { code:"PMG", title:"Program Manager",      titleAr:"مدير برامج",           deptCode:"PRG", gradeLevel:8,  minSalary:"2000", maxSalary:"3500" },
    { code:"PCO", title:"Procurement Officer",  titleAr:"مسؤول مشتريات",       deptCode:"LOG", gradeLevel:5,  minSalary:"900",  maxSalary:"1600" },
  ];
  const insertedPos: Record<string,string> = {};
  for (const p of posData) {
    const [pos] = await db.insert(positions).values({
      ...p,
      departmentId:   insertedDepts[p.deptCode],
      organizationId: org.id,
      isActive:       true,
      createdBy:      adminUser.id,
    }).returning();
    insertedPos[p.code] = pos.id;
    console.log(`   ✓ ${p.titleAr}`);
  }
  console.log();

  // ─── 11. الموظفون (6 موظفين) ─────────────────────────────────────────
  console.log("1️⃣1️⃣ إنشاء الموظفين...");
  type EmpInput = {
    empCode:string; firstName:string; lastName:string;
    firstNameAr:string; lastNameAr:string;
    email:string; phone:string;
    gender:"male"|"female";
    departmentCode:string; positionCode:string;
    hireDate:string; nationality:string;
    baseSalary:string; housing:string; transport:string;
  };
  const empData: EmpInput[] = [
    { empCode:"EMP001", firstName:"Mohammed", lastName:"Al-Hassan",  firstNameAr:"محمد",   lastNameAr:"الحسن",    email:"m.hassan@myorg.com",   phone:"+962791000001", gender:"male",   departmentCode:"ADM", positionCode:"DRG", hireDate:"2022-01-01", nationality:"Jordanian", baseSalary:"4000", housing:"800",  transport:"200" },
    { empCode:"EMP002", firstName:"Sara",     lastName:"Nasser",     firstNameAr:"سارة",   lastNameAr:"ناصر",     email:"s.nasser@myorg.com",   phone:"+962791000002", gender:"female", departmentCode:"FIN", positionCode:"CFO", hireDate:"2022-03-15", nationality:"Jordanian", baseSalary:"2800", housing:"600",  transport:"150" },
    { empCode:"EMP003", firstName:"Ahmed",    lastName:"Khalil",     firstNameAr:"أحمد",   lastNameAr:"خليل",     email:"a.khalil@myorg.com",   phone:"+962791000003", gender:"male",   departmentCode:"FIN", positionCode:"ACT", hireDate:"2023-06-01", nationality:"Jordanian", baseSalary:"1200", housing:"300",  transport:"100" },
    { empCode:"EMP004", firstName:"Lina",     lastName:"Ibrahim",    firstNameAr:"لينا",   lastNameAr:"إبراهيم",  email:"l.ibrahim@myorg.com",  phone:"+962791000004", gender:"female", departmentCode:"HR",  positionCode:"HRM", hireDate:"2022-09-01", nationality:"Jordanian", baseSalary:"2200", housing:"500",  transport:"150" },
    { empCode:"EMP005", firstName:"Khalid",   lastName:"Mansour",    firstNameAr:"خالد",   lastNameAr:"منصور",    email:"k.mansour@myorg.com",  phone:"+962791000005", gender:"male",   departmentCode:"LOG", positionCode:"PCO", hireDate:"2023-01-15", nationality:"Jordanian", baseSalary:"1100", housing:"250",  transport:"100" },
    { empCode:"EMP006", firstName:"Rania",    lastName:"Yousef",     firstNameAr:"رانيا",  lastNameAr:"يوسف",     email:"r.yousef@myorg.com",   phone:"+962791000006", gender:"female", departmentCode:"PRG", positionCode:"PMG", hireDate:"2022-06-01", nationality:"Jordanian", baseSalary:"2500", housing:"550",  transport:"150" },
  ];
  const insertedEmps: Record<string,string> = {};
  for (const e of empData) {
    const [emp] = await db.insert(employees).values({
      code:           e.empCode,
      organizationId: org.id,
      departmentId:   insertedDepts[e.departmentCode],
      positionId:     insertedPos[e.positionCode],
      firstName:      e.firstName,    lastName:       e.lastName,
      firstNameAr:    e.firstNameAr,  lastNameAr:     e.lastNameAr,
      email:          e.email,        phone:          e.phone,
      gender:         e.gender,
      hireDate:       new Date(e.hireDate),
      nationality:    e.nationality,
      isActive:       true,
      createdBy:      adminUser.id,
    }).returning();
    insertedEmps[e.empCode] = emp.id;

    // عقد العمل
    await db.insert(contracts).values({
      organizationId: org.id,
      employeeId:     emp.id,
      contractType:   "full_time",
      baseSalary:     e.baseSalary,
      currencyId:     usdId,
      startDate:      new Date(e.hireDate),
      workingHours:   40,
      isCurrent:      true,
      createdBy:      adminUser.id,
    });

    console.log(`   ✓ ${e.firstNameAr} ${e.lastNameAr} — ${e.empCode}`);
  }
  console.log();

  // ─── مكونات الراتب (كتالوج تعريفات، وليست سجلات لكل موظف) ─────
  await db.insert(salaryComponents).values([
    {
      organizationId: org.id,
      code:           "HOUSE",
      name:           "Housing Allowance",
      nameAr:         "بدل سكن",
      componentType:  "allowance",
      calculationMethod: "fixed",
      isTaxable:      false,
      isActive:       true,
      createdBy:      adminUser.id,
    },
    {
      organizationId: org.id,
      code:           "TRANS",
      name:           "Transport Allowance",
      nameAr:         "بدل مواصلات",
      componentType:  "allowance",
      calculationMethod: "fixed",
      isTaxable:      false,
      isActive:       true,
      createdBy:      adminUser.id,
    },
  ]);

  // ─── 12. المستودعات والفئات والأصول (مدمج من nexus-erp) ──────────────
  console.log("1️⃣2️⃣ إنشاء المستودعات وفئات الأصناف...");
  const warehouseData = [
    { code:"WH-MAIN", name:"Main Warehouse",    nameAr:"المستودع الرئيسي", location:"Amman HQ",   isDefault:true  },
    { code:"WH-FLD",  name:"Field Warehouse",   nameAr:"مستودع الميدان",   location:"Field Office",isDefault:false },
  ];
  const insertedWH: Record<string,string> = {};
  for (const w of warehouseData) {
    const [wh] = await db.insert(warehouses).values({
      ...w, organizationId:org.id, isActive:true, createdBy:adminUser.id,
    }).returning();
    insertedWH[w.code] = wh.id;
    console.log(`   ✓ ${w.nameAr}`);
  }

  const catData = [
    { code:"IT",  name:"IT Equipment",    nameAr:"أجهزة تقنية المعلومات" },
    { code:"FRN", name:"Furniture",       nameAr:"الأثاث والمفروشات"     },
    { code:"VEH", name:"Vehicles",        nameAr:"المركبات"              },
    { code:"OFF", name:"Office Supplies", nameAr:"مستلزمات مكتبية"       },
  ];
  const insertedCat: Record<string,string> = {};
  for (const c of catData) {
    const [cat] = await db.insert(itemCategories).values({
      code:c.code, name:c.name, nameAr:c.nameAr,
      organizationId:org.id, createdBy:adminUser.id,
    }).returning();
    insertedCat[c.code] = cat.id;
    console.log(`   ✓ ${c.nameAr}`);
  }
  console.log();

  // ─── 13. الأصول الثابتة مع جداول استهلاك (مدمج من nexus-erp) ─────────
  console.log("1️⃣3️⃣ إنشاء الأصول الثابتة...");
  const assetData = [
    { code:"AST-001", name:"Laptop Dell XPS",    nameAr:"لابتوب ديل XPS",  categoryCode:"IT",  purchaseValue:"1200", salvageValue:"120", usefulLifeYears:5,  depreciationMethod:"straight_line"    as const, purchaseDate:"2023-01-15" },
    { code:"AST-002", name:"Toyota Hilux 2022",  nameAr:"تويوتا هايلوكس",  categoryCode:"VEH", purchaseValue:"35000",salvageValue:"7000",usefulLifeYears:10, depreciationMethod:"declining_balance" as const, purchaseDate:"2022-06-01" },
    { code:"AST-003", name:"Office Projector",   nameAr:"بروجكتر المؤتمرات",categoryCode:"IT",  purchaseValue:"800",  salvageValue:"80",  usefulLifeYears:5,  depreciationMethod:"straight_line"    as const, purchaseDate:"2023-09-01" },
    { code:"AST-004", name:"Office Furniture Set",nameAr:"طقم أثاث مكتبي", categoryCode:"FRN", purchaseValue:"4500", salvageValue:"500", usefulLifeYears:10, depreciationMethod:"straight_line"    as const, purchaseDate:"2022-01-01" },
  ];
  for (const a of assetData) {
    await db.insert(assets).values({
      code:               a.code,
      name:               a.name,
      organizationId:     org.id,
      warehouseId:        insertedWH["WH-MAIN"],
      purchaseCost:       a.purchaseValue,
      currentValue:       a.purchaseValue,
      salvageValue:       a.salvageValue,
      usefulLifeYears:    a.usefulLifeYears,
      depreciationMethod: a.depreciationMethod,
      purchaseDate:       new Date(a.purchaseDate),
      assetCondition:     "good",
      createdBy:          adminUser.id,
    });
    console.log(`   ✓ ${a.nameAr} — ${a.code}`);
  }
  console.log();
  console.log("\n" + "═".repeat(50));
  console.log("✅ تم إنشاء البيانات الأولية بنجاح!\n");
  console.log("📌 بيانات الدخول:");
  console.log("   الموقع:      http://localhost:3000");
  console.log("   البريد:      admin@myorg.com");
  console.log("   كلمة المرور: Admin@1234");
  console.log("\n📌 مستخدمون تجريبيون (كلمة المرور: Demo@1234):");
  console.log("   finance@myorg.com  — مدير مالي");
  console.log("   pm@myorg.com       — مدير برامج");
  console.log("   hr@myorg.com       — مدير HR");
  console.log("   proc@myorg.com     — مسؤول مشتريات");
  // ─── إعدادات النظام الديناميكية ────────────────────────────────────────
  console.log("📋 إنشاء إعدادات النظام الديناميكية...");
  const settingsData = [
    // ── الرواتب ──
    { category:"payroll", settingKey:"income_tax_rate",         value:"5",    valueType:"number",  label:"Income Tax Rate",         labelAr:"نسبة ضريبة الدخل",         unit:"%",          minValue:"0", maxValue:"50"  },
    { category:"payroll", settingKey:"social_security_rate",    value:"7.5",  valueType:"number",  label:"Social Security Rate",    labelAr:"نسبة الضمان الاجتماعي",    unit:"%",          minValue:"0", maxValue:"30"  },
    { category:"payroll", settingKey:"overtime_multiplier",     value:"1.5",  valueType:"number",  label:"Overtime Multiplier",     labelAr:"معامل الأوفرتايم",          unit:"multiplier", minValue:"1", maxValue:"3"   },
    { category:"payroll", settingKey:"working_days_per_month",  value:"22",   valueType:"number",  label:"Working Days/Month",      labelAr:"أيام العمل في الشهر",       unit:"days",       minValue:"18",maxValue:"26"  },
    { category:"payroll", settingKey:"tax_exempt_threshold",    value:"500",  valueType:"number",  label:"Tax Exempt Threshold",    labelAr:"حد الإعفاء الضريبي",        unit:"USD",        minValue:"0", maxValue:"5000"},
    { category:"payroll", settingKey:"weekend_days",            value:"5,6",  valueType:"string",  label:"Weekend Days",            labelAr:"أيام العطلة الأسبوعية",     unit:"",           minValue:null,maxValue:null  },
    // ── الميزانية ──
    { category:"budget",  settingKey:"warning_threshold",       value:"80",   valueType:"number",  label:"Budget Warning Threshold",labelAr:"عتبة تحذير الميزانية",      unit:"%",          minValue:"50",maxValue:"95"  },
    { category:"budget",  settingKey:"critical_threshold",      value:"95",   valueType:"number",  label:"Critical Threshold",      labelAr:"عتبة الخطر",                unit:"%",          minValue:"80",maxValue:"99"  },
    { category:"budget",  settingKey:"block_threshold",         value:"100",  valueType:"number",  label:"Block Threshold",         labelAr:"عتبة الحجب",                unit:"%",          minValue:"95",maxValue:"110" },
    { category:"budget",  settingKey:"notify_cooldown_hours",   value:"24",   valueType:"number",  label:"Notification Cooldown",   labelAr:"فترة التهدئة بين الإشعارات",unit:"hours",      minValue:"1", maxValue:"168" },
    // ── المشتريات ──
    { category:"procurement", settingKey:"matching_tolerance_pct", value:"2", valueType:"number",  label:"3-Way Match Tolerance",   labelAr:"هامش تسامح المطابقة",       unit:"%",          minValue:"0", maxValue:"10"  },
    { category:"procurement", settingKey:"emergency_review_days",  value:"30",valueType:"number",  label:"Emergency Review Period", labelAr:"مدة مراجعة الطوارئ",        unit:"days",       minValue:"7", maxValue:"90"  },
    { category:"procurement", settingKey:"approval_sla_hours",     value:"48",valueType:"number",  label:"Approval SLA",            labelAr:"مهلة الموافقة",             unit:"hours",      minValue:"4", maxValue:"240" },
    { category:"procurement", settingKey:"rfq_min_vendors",        value:"3", valueType:"number",  label:"Min Vendors per RFQ",     labelAr:"الحد الأدنى للموردين في RFQ",unit:"",          minValue:"1", maxValue:"10"  },
    // ── الأصول ──
    { category:"assets",  settingKey:"default_depreciation_method",value:"straight_line",valueType:"string",label:"Default Depreciation Method",labelAr:"طريقة الاستهلاك الافتراضية",unit:"",minValue:null,maxValue:null},
    { category:"assets",  settingKey:"it_depreciation_rate",    value:"20",   valueType:"number",  label:"IT Equipment Depreciation",labelAr:"معدل استهلاك أجهزة IT",     unit:"%",          minValue:"5", maxValue:"50"  },
    { category:"assets",  settingKey:"vehicle_depreciation_rate",value:"15",  valueType:"number",  label:"Vehicle Depreciation",    labelAr:"معدل استهلاك المركبات",     unit:"%",          minValue:"5", maxValue:"40"  },
    { category:"assets",  settingKey:"furniture_depreciation_rate",value:"10",valueType:"number",  label:"Furniture Depreciation",  labelAr:"معدل استهلاك الأثاث",       unit:"%",          minValue:"5", maxValue:"30"  },
    // ── الإشعارات ──
    { category:"notifications", settingKey:"payroll_notify_day", value:"25",  valueType:"number",  label:"Payroll Reminder Day",    labelAr:"يوم تذكير الرواتب",         unit:"day",        minValue:"1", maxValue:"28"  },
    { category:"notifications", settingKey:"budget_alert_emails",value:"",    valueType:"string",  label:"Budget Alert Emails",     labelAr:"إيميلات تنبيه الميزانية",   unit:"",           minValue:null,maxValue:null  },
    { category:"notifications", settingKey:"approval_reminder_hours",value:"24",valueType:"number",label:"Approval Reminder",      labelAr:"تذكير الموافقة المعلقة",     unit:"hours",      minValue:"1", maxValue:"72"  },
    // ── HR ──
    { category:"hr",      settingKey:"annual_leave_days",        value:"21",  valueType:"number",  label:"Annual Leave Days",       labelAr:"أيام الإجازة السنوية",      unit:"days",       minValue:"14",maxValue:"60"  },
    { category:"hr",      settingKey:"sick_leave_days",          value:"14",  valueType:"number",  label:"Sick Leave Days",         labelAr:"أيام الإجازة المرضية",      unit:"days",       minValue:"7", maxValue:"30"  },
    { category:"hr",      settingKey:"probation_months",         value:"3",   valueType:"number",  label:"Probation Period",        labelAr:"مدة الاختبار",              unit:"months",     minValue:"1", maxValue:"6"   },
  ];
  for (const s of settingsData) {
    await db.insert(systemSettings).values({
      organizationId: org.id,
      category:       s.category,
      settingKey:     s.settingKey,
      value:          s.value,
      valueType:      s.valueType,
      label:          s.label,
      labelAr:        s.labelAr,
      unit:           s.unit || null,
      minValue:       s.minValue || null,
      maxValue:       s.maxValue || null,
      updatedBy:      adminUser.id,
    }).onConflictDoNothing();
  }
  console.log(`   ✓ ${settingsData.length} إعداد ديناميكي جاهز`);
  console.log();

  console.log("\n📌 بيانات HR التجريبية:");
  console.log("   6 موظفين بعقود وبدلات كاملة");
  console.log("   مستودعان + 4 أصناف + 4 أصول ثابتة");
  console.log("   ادخل /hr/payroll لتوليد كشف رواتب اول");
  console.log("═".repeat(50));

  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ خطأ في الـ Seed:", e);
  process.exit(1);
});
