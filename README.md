# نظام ERP الإنساني — v19

نظام إدارة موارد مؤسسي متكامل للمنظمات الإنسانية، مبني على Next.js 15 + Drizzle ORM + PostgreSQL.
يغطي **العمود الفقري المالي/الإداري** بالإضافة إلى **الوحدات المتخصصة بالقطاع الإنساني الكاملة** حسب معايير المانحين الدوليين (USAID, ECHO, UNHCR, UN).

---

## 🚀 التثبيت السريع

### 1. المتطلبات
- Node.js 20+
- PostgreSQL 15+
- npm

### 2. التثبيت
```bash
npm install
```

### 3. إعداد البيئة
```bash
cp .env.example .env.local
# عدّل القيم: DATABASE_URL, AUTH_SECRET (openssl rand -base64 32), NEXTAUTH_URL
```

### 4. تهيئة قاعدة البيانات
```bash
npm run db:setup   # يشغّل db:migrate (9 ملفات SQL) ثم db:seed معاً
```

### 5. تشغيل المشروع
```bash
npm run dev
# افتح: http://localhost:3000
```

### 6. بيانات الدخول
| الإيميل | كلمة المرور | الدور |
|---------|-------------|-------|
| admin@myorg.com | Admin@1234 | مدير النظام (super_admin) |
| finance@myorg.com | Demo@1234 | مدير مالي |
| pm@myorg.com | Demo@1234 | مدير برامج |
| hr@myorg.com | Demo@1234 | موارد بشرية |
| proc@myorg.com | Demo@1234 | مسؤول مشتريات |

⚠️ **ملاحظة:** `db:seed` لا ينشئ منحاً تجريبية افتراضياً — يلزم إنشاء أول منحة يدوياً من `/grants/new` قبل اختبار وحدات المستفيدين/التقارير/الشركاء المرتبطة بمنحة.

---

## 📁 هيكل المشروع (الوحدات)

```
src/app/(dashboard)/
├── grants/                 # المنح وخطوط الميزانية
├── beneficiaries/          # 🆕 إدارة المستفيدين (تسجيل، كشف ازدواجية، حالات، توزيعات)
├── partners/                # 🆕 الشركاء المنفّذون والمنح الفرعية (فحص مسبق، صرفيات)
├── logistics/fleet/        # 🆕 إدارة الأسطول (مركبات، سائقون، بوليصة شحن، وقود، صيانة)
├── cfm/                     # 🆕 آلية الشكاوى والتغذية الراجعة (SLA، حساسية مقيَّدة)
├── procurement/             # المشتريات PR → PO → GRN → Invoice
├── vendors/                  # الموردين + مناقصات + عروض أسعار
├── hr/payroll/               # الموارد البشرية والرواتب
├── inventory/                 # المخزون والأصول الثابتة
├── accounting/                 # المحاسبة وشجرة الحسابات
├── reports/
│   ├── page.tsx                    # BI Dashboard
│   ├── budget-vs-actual/           # 🆕 الميزانية مقابل الفعلي حسب المانح
│   ├── donor/[grantId]/            # 🆕 تقارير المانحين (SF-425/ECHO/UNHCR)
│   └── gis-map/                    # 🆕 الخريطة الجغرافية (Leaflet + OSM)
├── notifications/
└── settings/                        # Admin Panel (صلاحيات، بيانات أساسية، مستخدمون)
```

**وحدات مدمجة داخل صفحات أخرى (وليست مسارات مستقلة):**
- **Anti-Terrorism Screening** 🆕 — لوحة مدمجة داخل `/partners/[id]` (`ScreeningPanel`)
- **Offline Mobile (PWA)** 🆕 — `public/manifest.json` + `public/service-worker.js` + طابور IndexedDB مدمج في نموذج تسجيل المستفيدين

```
src/db/
├── schema/           # 15 ملف schema (57+ جدول) — Drizzle ORM
├── migrations/       # 9 ملفات SQL مرقّمة (001 → 009)، تُشغَّل بالترتيب تلقائياً
├── seed.ts           # بيانات تجريبية
└── index.ts

src/lib/              # منطق الأعمال القابل للاختبار بمعزل (unit-tested)
├── beneficiaries/duplicate-detection.ts   # كشف الازدواجية (hash + تشابه)
├── donor-reports/templates.ts             # حسابات SF-425 / ECHO / UNHCR IPR
├── fleet/calculations.ts                  # كفاءة الوقود، تكلفة/كم، استحقاق الصيانة
├── cfm/sla.ts                              # مواعيد استجابة الشكاوى
├── screening/due-date.ts                   # جدولة إعادة الفحص المسبق
└── offline/queue-logic.ts                  # منطق طابور المزامنة (بدون IndexedDB)
```

---

## ✅ الميزات الكاملة (خارطة الطريق الإنسانية — منجزة بالكامل)

### 🔴 حرج
- **Fund Accounting الكامل** — fund-based accounting، تتبع سعر صرف تاريخي (`exchange_rate_history`)، فروقات القطع (`fx_revaluations`)
- **Beneficiary Management** — تسجيل، تحقق، كشف ازدواجية (hash على نص عربي مُطبَّع)، Case Management، Distribution Management
- **Donor Reporting** — قوالب USAID SF-425، ECHO Single Form، UNHCR IPR، جاهزة لكل منحة
- **Partner/Sub-grant Management** — فحص مسبق (Due Diligence)، اتفاقيات، صرفيات، تقارير الشريك

### 🟠 مهم
- **Logistics/Fleet** — مركبات، سائقون، بوليصة شحن (Waybill)، وقود، صيانة مع تنبيهات استحقاق
- **CFM** — استقبال شكاوى متعدد القنوات، SLA حسب الأولوية، تقييد وصول للحالات الحساسة (فساد/حماية)

### 🟡 مفيد
- **Anti-Terrorism Screening** — توثيق فحص يدوي حقيقي ضد قوائم UN/OFAC/EU (**ليس اتصالاً آلياً حياً** — يتطلب اشتراكاً فعلياً غير متوفر هنا)
- **GIS Mapping** — خريطة تفاعلية حقيقية عبر Leaflet + OpenStreetMap (بدون مفتاح API مدفوع)
- **Offline Mobile** — PWA قابل للتثبيت، تسجيل المستفيدين يعمل بدون اتصال ويُزامَن تلقائياً

### الطبقة الأساسية والامتثال (من الإصدارات السابقة)
المنح، المشتريات (PR→PO→GRN→Invoice)، الموردين، HR والرواتب، المخزون والأصول، المحاسبة، مصفوفة التواقيع، المطابقة الثلاثية، تحذير الميزانية، Vendor Scorecard، مسار الطوارئ، Admin Panel كامل، إشعارات وEmail، BI Dashboard.

---

## 🧪 الاختبار والتحقق

```bash
npm run build       # بناء الإنتاج + فحص TypeScript
npx tsc --noEmit     # فحص TypeScript فقط
npx vitest run       # 81 اختبار وحدة (duplicate-detection, donor-reports, fleet, CFM SLA, screening, offline queue...)
```

**آخر تحقق فعلي (v19):** تم تثبيت PostgreSQL محلياً، تشغيل الـ9 migrations، تسجيل دخول حقيقي عبر NextAuth، وفحص كل صفحة جديدة (200 OK بدون أخطاء خادم) ببيانات مُدرجة يدوياً. راجع `final-checklist.md` قبل أي نشر فعلي.

---

## 🔧 أوامر مفيدة

```bash
npm run dev            # تطوير
npm run build           # بناء للإنتاج
npm run db:migrate       # تنفيذ كل الـ migrations (9 ملفات) بالترتيب
npm run db:seed           # بيانات تجريبية
npm run db:setup           # migrate + seed معاً
npm run db:studio           # Drizzle Studio (واجهة DB)
```

---

## 🌐 النشر

راجع `deployment-guide.md` لدليل خطوة بخطوة على Render (أو Vercel + Neon بنفس المبدأ).

---

## 📋 سجل الإصدارات (مختصر)

| الإصدار | المحتوى |
|---------|---------|
| v1–v14 | الأساس المالي/الإداري + طبقة الامتثال + Admin Panel + إشعارات |
| v15 | أول تحقق فعلي ضد PostgreSQL حقيقي (إصلاح `relations.ts`، migrations، NextAuth) |
| v16 | Fund Accounting الكامل (FX) + تقرير Budget vs Actual by Donor |
| v17 | Beneficiary Management + Donor Reporting + Partner/Sub-grant Management (نهاية المرحلة الحرجة) |
| v18 | Logistics/Fleet + CFM (نهاية المرحلة المهمة) |
| **v19** | **Anti-Terrorism Screening + GIS Mapping + Offline Mobile (نهاية خارطة الطريق بالكامل) + تحقق فعلي ضد DB حقيقية** |

---

## ⚠️ قيود معروفة (بصراحة، بدون تجميل)

- **Anti-Terrorism Screening**: توثيق يدوي فقط، لا اتصال حي بقاعدة عقوبات — يحتاج اشتراكاً فعلياً لو أردتم فحصاً آلياً حقيقياً.
- **GIS Mapping**: يعرض فقط السجلات ذات إحداثيات مُدخَلة يدوياً (حقول اختيارية، لا يوجد geocoding تلقائي من العنوان النصي).
- **Offline Mobile**: PWA داخل نفس تطبيق الويب — ليس تطبيق موبايل React Native منفصل. مُفعَّل حالياً لنموذج تسجيل المستفيدين فقط كنموذج أولي (proof of concept)، وليس لكل النماذج.
- **seed.ts** لا يُنشئ منحاً تجريبية بشكل افتراضي.
- **v31 — إصلاحات صحة تشغيلية**: تم إصلاح Race Condition بالمخزون، غياب idempotency، غياب محرك reversal محاسبي، غياب دفتر مخزون بالتكلفة (AVCO)، غياب tamper-evidence بسجل التدقيق، وثغرة IDOR في `createDistribution` (كانت لا تتحقق من ملكية beneficiaryId/grantId للمنظمة). التفاصيل والحدود المتبقية لكل بند (بصراحة) في `SECURITY_NOTES.md` § v31 — أهمها: hash chain لسجل التدقيق tamper-evident وليس immutable مطلق أمام مالك القاعدة، واختبارات concurrency الجديدة تثبت صحة الخوارزمية بمحاكاة، وليس تزامناً حقيقياً ضد Postgres فعلي.
