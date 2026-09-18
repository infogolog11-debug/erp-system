# دليل النشر على الإنتاج — v39

هذا الدليل يغطي النشر الفعلي لهذا الإصدار (v36 مغلق + إضافات v37: التشخيص
قبل migration 016، دالة `assertOwnedByOrg` الموحّدة، ومهمة التحقق الدوري
من سلامة سجل التدقيق؛ + v38: تعميم `assertOwnedByOrg`؛ + v39: توحيد
idempotency بـ`processPayroll`، تحديث ذرّي لـ`submitVendorRating`/
`submitBidScore`، ومهمة تسوية المخزون الدورية — راجع قسم 5ب). يفترض
منصة Render (المُعدَّة فعلياً بـ`render.yaml`) لكنه يذكر البدائل حيث
يختلف الأمر.

**حالة الكود عند كتابة هذا الدليل**: `npx tsc --noEmit` نظيف، `npx vitest
run` → 350/350 ناجح.

---

## 0) قبل أي شيء — هل هذا أول نشر أم تحديث لبيئة فيها بيانات فعلاً؟

هذا فارق جوهري يُحدَّد به مسار القسم 2 بالكامل:

- **أول نشر (قاعدة فارغة)**: تجاهل قسم "2.ب" — نفّذ migrations بالترتيب
  العادي مباشرة، لا حاجة لأي تشخيص مسبق.
- **تحديث لبيئة فيها بيانات إنتاج حقيقية بالفعل**: **توقف عند migration
  016 تحديداً** ونفّذ قسم "2.ب" (التشخيص) قبل المتابعة. هذا ليس اختيارياً.

---

## 1) الترتيب العام لخطوات النشر

```
  1. git pull / سحب الإصدار الجديد على بيئة CI أو الخادم
  2. npm install                     ← تثبيت أي تبعيات جديدة
  3. npm run check:env                ← فحص متغيرات البيئة (قسم 4)
  4. npm run build:check              ← tsc --noEmit، يجب أن يكون نظيفاً
  5. npm test                         ← يجب أن تكون 317/317+ ناجحة
  6. [فقط لو بيانات موجودة] npm run check:migration-016  ← قسم 2.ب
  7. npm run db:migrate                ← تنفيذ migrations 001→016 بالترتيب
  8. npm run build                     ← بناء Next.js للإنتاج
  9. npm start (أو startCommand المنصة) ← تشغيل الخادم
 10. GET /api/health                   ← يجب أن يرجع status:"ok"
 11. تسجيل دخول تجريبي + فحص وظيفة حساسة واحدة يدوياً (مثال: صفحة grants)
 12. تأكد أن مهمة audit:verify الدورية مُجدولة وتصل فعلياً (قسم 5)
```

الخطوات 3-5 يجب أن تُنفَّذ **قبل** أي شيء يلمس قاعدة الإنتاج — لا فائدة من
اكتشاف خطأ نوع (type error) أو اختبار فاشل بعد أن بدأت migrations فعلياً.

**اختصار (v39): `./scripts/pre-deploy-check.sh .env.production`** يُشغّل
الخطوات 3، 4، 5، و6 دفعة واحدة، ويطبع تقريراً واحداً بـPASS/FAIL/WARN
لكل بند، وكود خروج 0/1 يحدد جاهزية المتابعة لخطوة 7 — دون أن يُشغّل
migrations نفسه (قرار بشري منفصل عمداً). راجع تعليقات الملف نفسه لتفاصيل
كل فحص. أول ملء لـ`.env.production` نفسه؟ ابدأ من
`.env.production.template` بجذر المشروع — يحتوي كل متغير مُستخدَم فعلياً
بالكود مع شرح لكل واحد، وليس تخميناً من `.env.example` القديم (الذي
يحمل أسماء next-auth v4 غير الصحيحة لهذا المشروع — راجع تعليق القالب).

---

## 2) الـ Migrations

### 2.أ) الترتيب

الترتيب ثابت ومُرقَّم صراحة، ولا يجوز تخطي رقم أو تنفيذه خارج الترتيب —
كل migration لاحقة تفترض أن ما قبلها نُفِّذ فعلاً (مثال: 013 تضيف
`stock_movements.balanceQty` التي تعتمد عليها استعلامات لاحقة):

```
001_initial_schema.sql → 002_fund_accounting.sql → 003_beneficiaries.sql
→ 004_donor_reporting.sql → 005_partners.sql → 006_fleet.sql
→ 007_cfm.sql → 008_screening.sql → 009_gis_mapping.sql
→ 010_performance_indexes.sql → 011_contract_allowances.sql
→ 012_payroll_adjustments.sql → 013_operational_integrity.sql
→ 014_po_item_inventory_link.sql → 015_payroll_run_uniqueness.sql
→ 016_budget_and_disbursement_guards.sql
```

`npm run db:migrate` (يُشغِّل `src/db/migrations/run-migrations.ts`)
ينفّذها بهذا الترتيب تلقائياً، ويتخطى أي migration نُفِّذت مسبقاً (يتتبعها
بجدول `_migrations`)، ويُنفِّذ كل ملف داخل معاملة واحدة (BEGIN/COMMIT مع
ROLLBACK تلقائي عند الفشل) — لا حاجة لتشغيلها يدوياً واحدة تلو الأخرى.

### 2.ب) migration 016 على بيئة فيها بيانات — إلزامي قبل التنفيذ

`016_budget_and_disbursement_guards.sql` يضيف `CHECK constraints` بصيغة
عادية (بدون `NOT VALID`) — أي أنها **تفحص كل صف موجود فعلياً وتفشل
بالكامل** لو وُجد صف واحد مخالف، وتأخذ قفل `ACCESS EXCLUSIVE` على الجدول
طوال الفحص. بما أن `SECURITY_NOTES.md` يوثّق أن الثغرات التي يحميها هذا
القيد (race conditions بميزانية المنح، استلام بضاعة زائد، صرف منح فرعية)
كانت موجودة فعلياً بالتطبيق قبل إصلاحات v35، أي بيئة استُخدمت بالكود القديم
قد تحمل بيانات مخالفة الآن دون أن تعرف.

**نفّذ هذا قبل الخطوة 7 أعلاه على أي بيئة فيها بيانات:**

```bash
npx tsx --env-file=.env.production scripts/pre-migration-016-diagnostics.ts
```

(أو مرّر `DATABASE_URL` مباشرة بمتغيرات بيئة الجلسة بدل `--env-file` لو
كنت تُشغّله من CI/CD تحصل فيه متغيرات البيئة أصلاً من المنصة).

- **صفر مخالفات** → تابع للخطوة 7 بالـmigration الأصلية مباشرة.
- **وُجدت مخالفات** → لا تُشغّل migration 016 الأصلية. بدلاً من ذلك:
  1. صحّح البيانات المخالفة (السكريبت يطبع عيّنة من الصفوف وسببها).
  2. لو تعذّر تصحيح الكل فوراً، استخدم
     `scripts/016_budget_and_disbursement_guards_not_valid.sql` بدل الملف
     الأصلي — يضيف القيود بصيغة `NOT VALID` (لا تفحص الصفوف القديمة، قفل
     خفيف، تبدأ حماية الكتابات الجديدة فوراً)، ثم `VALIDATE CONSTRAINT`
     لكل قيد لاحقاً (بعد تصحيح تدريجي) بقفل لا يمنع القراءة/الكتابة
     العادية. التفاصيل والفرق التقني الكامل موثّق داخل الملف نفسه.
  3. أعد تشغيل السكريبت التشخيصي بعد كل دفعة تصحيح للتأكد من الوصول لصفر.

هذا السكريبت للقراءة فقط (`SELECT`) — آمن للتشغيل على الإنتاج في أي وقت
دون أي أثر جانبي.

---

## 3) أوامر البناء والنشر

| الأمر | الغرض | متى |
|---|---|---|
| `npm install` | تثبيت التبعيات | أول شيء بعد كل سحب كود جديد |
| `npm run check:env` | تحقق من متغيرات البيئة المطلوبة | قبل البناء |
| `npm run build:check` | `tsc --noEmit` — تحقق أنواع كامل بلا بناء فعلي | قبل البناء، بـCI |
| `npm test` | `vitest run` — كل الاختبارات مرة واحدة (ليست watch mode) | قبل البناء، بـCI |
| `npm run db:migrate` | تنفيذ الـmigrations بالترتيب (قسم 2) | بعد نجاح الفحوصات، قبل تشغيل الخادم الجديد |
| `npm run build` | بناء Next.js للإنتاج | بعد الـmigrations |
| `npm start` | تشغيل خادم الإنتاج المبني | آخر خطوة |
| `npm run check:migration-016` | التشخيص المسبق (قسم 2.ب) | مرة واحدة، قبل أول تشغيل لـmigration 016 على بيانات حقيقية |
| `npm run audit:verify` | تشغيل يدوي لفحص سلامة سجل التدقيق | للتأكد من عمل التنبيهات (قسم 5)، أو عند الشك بحادثة أمنية |

على Render تحديداً (`render.yaml` الحالي): `buildCommand: npm install &&
npm run build` و`startCommand: npm start` — **لا يُشغِّل `db:migrate`
تلقائياً بالنشر**. شغّل migrations يدوياً (أو أضِفها لـ`buildCommand`
صراحة إن أردت أتمتة كاملة: `npm install && npm run db:migrate && npm run
build`) — لكن الأفضل تشغيلها يدوياً بخطوة منفصلة قابلة للمراجعة، خصوصاً
لـmigration 016 على بيئة فيها بيانات (قسم 2.ب أعلاه يحتاج قراراً بشرياً
محتملاً، لا أتمتة عمياء).

---

## 4) متغيرات البيئة

القائمة الكاملة والمُصنَّفة موجودة بـ`.env.production.example` (لا تنسخه
كملف — انقل القيم يدوياً للوحة المنصة). ملخص حسب الأولوية:

### 🔴 حرجة — التطبيق لا يعمل بدونها
- `DATABASE_URL` — يجب أن يحتوي `sslmode=require` للإنتاج
- `NEXTAUTH_SECRET` — **ولّد قيمة جديدة** (`openssl rand -base64 32`)، لا
  تُعِد استخدام قيمة بيئة التطوير
- `NEXTAUTH_URL` — الدومين الحقيقي بعد النشر

### 🟡 مطلوبة فعلياً حسب الميزة المفعّلة
- **البريد** (موافقات، تنبيهات ميزانية، تنبيهات سلامة سجل التدقيق):
  `RESEND_API_KEY` + `EMAIL_FROM`، أو `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`
- **رفع الملفات**: `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`,
  `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`
- **تنبيه سلامة سجل التدقيق** (جديد v37): `SECURITY_ALERT_EMAIL` — صندوق
  بريد يُراقَب فعلياً (قناة أوبس)، منفصل عمداً عن نظام مستخدمي التطبيق
  (راجع قسم 5 للسبب)

### 🟢 اختيارية لكن موصى بها
- `SENTRY_DSN` / `NEXT_PUBLIC_POSTHOG_KEY` — مراقبة أخطاء/استخدام

شغّل `npm run check:env` بعد تعبئتها للتأكد الآلي بدل المراجعة اليدوية.

### KMS / أسرار خارجية — الوضع الحالي والقرار المفتوح

هذا المشروع **لا يستخدم KMS/HSM خارجي حالياً** — كل الأسرار (مفاتيح
API، كلمات مرور SMTP، `NEXTAUTH_SECRET`) تُدار كمتغيرات بيئة عادية
بلوحة المنصة (Render envVars، مع `sync: false` للحقول الحساسة بـ
`render.yaml` — يعني "لا تُخزَّن قيمتها بالملف، عبّئها يدوياً باللوحة").
هذا مقبول لحجم هذا المشروع، لكن له حدود موثّقة صراحة بـ`SECURITY_NOTES.md`
(§7 سجل التدقيق): تجزئة سجل التدقيق (`hash`/`prevHash`) تُحسَب بنفس تطبيق
Node.js الذي له صلاحية كتابة كاملة على الجدول — أي مفتاح KMS خارجي (HMAC
بدل hash عادي) يتطلب **قراراً بنيوياً منفصلاً خارج نطاق الكود الحالي**،
وليس مجرد إعداد بيئة. لو كانت هذه أولوية، الخطوة التالية هي اختيار خدمة
(AWS KMS / HashiCorp Vault / إلخ) وتصميم كيف يستدعيها Node.js وقت حساب كل
hash — لم يُنفَّذ بهذه الجولة.

---

## 5) مهمة التحقق الدوري من سلامة سجل التدقيق

`verifyAuditChain(organizationId)` (بـ`audit-trail.ts`) كانت موجودة أصلاً
لكن بلا أي مسار تشغيلي يستدعيها تلقائياً. أُضيف v37:

- `src/core/audit/scheduled-check.ts` — `runScheduledAuditIntegrityCheck()`
  تفحص كل المنظمات النشطة، وتُنبِّه فوراً عند أي كسر عبر مسارين مستقلين:
  1. إشعار داخل النظام + إيميل لكل مستخدمي المنظمة بدور `admin`/`super_admin`
  2. إيميل مباشر لـ`SECURITY_ALERT_EMAIL` (خارج نظام المستخدمين تماماً —
     لأن تلاعباً حقيقياً بالسجل يعني بالتعريف وصول مهاجم لصلاحية DB owner،
     وهو نفسه قادر نظرياً على التلاعب بجدول الإشعارات لإخفاء المسار الأول)
- `scripts/verify-audit-integrity.ts` — نقطة التشغيل (CLI)، كود خروج 0
  (سليم) / 1 (كسر مكتشف) / 2 (خطأ تشغيلي بالسكريبت نفسه)

### كيفية الجدولة (اختر واحدة حسب بيئتك)

**Render Cron Job** (أُضيف بـ`render.yaml` بهذا الإصدار):
```yaml
- type: cron
  name: erp-audit-integrity-check
  schedule: "0 3 * * 0"   # كل أحد 3:00 صباحاً UTC
  startCommand: npm run audit:verify
```
ملاحظة: بعض خطط Render لا تدعم نوع `cron` — تحقق من خطتك الحالية أولاً.

**بديل: GitHub Actions** (لو Render Cron غير متاح، أو النشر على منصة أخرى):
```yaml
# .github/workflows/audit-integrity-check.yml
name: Weekly Audit Integrity Check
on:
  schedule:
    - cron: "0 3 * * 0"
  workflow_dispatch: {}   # يسمح بتشغيل يدوي فوري من تبويب Actions
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run audit:verify
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          EMAIL_FROM: ${{ secrets.EMAIL_FROM }}
          SECURITY_ALERT_EMAIL: ${{ secrets.SECURITY_ALERT_EMAIL }}
```

**بديل: crontab عادي** على أي خادم يصل لنفس `DATABASE_URL`:
```
0 3 * * 0 cd /path/to/app && npx tsx --env-file=.env.production scripts/verify-audit-integrity.ts >> /var/log/audit-check.log 2>&1
```

بعد إعداد أي خيار، **تحقق فعلياً** بتشغيل يدوي واحد
(`npm run audit:verify`) وتأكد وصول أي بريد اختباري — لا تفترض أن
الجدولة تعمل لمجرد أنها مكتوبة.

---

## 5ب) مهمة دورية جديدة (v39): تسوية دفتر المخزون

- `src/core/inventory/reconcile-stock.ts` — `reconcileStockLedger()`
  تقارن `items.currentStock` (الكاش) بمجموع حركات `stock_movements`
  الفعلية لكل صنف، وتُنبِّه (**تسجيل وتنبيه فقط — لا تصحيح تلقائي
  لأي رصيد**) عند أي انحراف يتجاوز هامش تقريب عائم بسيط (0.001).
  التنبيه داخلي فقط لأدوار `finance_manager`/`warehouse_manager`/
  `admin`/`super_admin` — هذا انحراف محاسبي يحتاج مراجعة بشرية لتحديد
  اتجاه التصحيح الصحيح، بخلاف كسر سلسلة التدقيق (لا قناة بريد أمني
  خارجية منفصلة هنا).
- `scripts/reconcile-stock-ledger.ts` — نقطة التشغيل (CLI)، كود خروج
  0 (لا انحراف) / 1 (انحراف مكتشف بصنف أو أكثر — تنبيهات أُرسلت) /
  2 (خطأ تشغيلي بالسكريبت نفسه)

الجدولة بنفس آلية `audit:verify` أعلاه تماماً (Render Cron Job /
GitHub Actions / crontab عادي) — استبدل `npm run audit:verify` بـ
`npm run stock:reconcile` بأي من الأمثلة أعلاه. مقترَح: تردد أعلى
(يومياً بدل أسبوعياً) لأن الفحص هنا أخف (تجميع SQL واحد، لا مسح O(n)
لسجل تدقيق كامل).

مثال Render Cron Job إضافي بـ`render.yaml`:
```yaml
- type: cron
  name: erp-stock-reconciliation
  schedule: "0 4 * * *"   # يومياً 4:00 صباحاً UTC
  startCommand: npm run stock:reconcile
```

بعد إعداد الجدولة، تحقق فعلياً بتشغيل يدوي واحد
(`npm run stock:reconcile`) وتأكد عدم وجود انحراف غير متوقَّع على
بيانات الإنتاج الحالية قبل الاعتماد عليها كخط دفاع مستمر.

---

## 6) قائمة تفقد نهائية قبل الإعلان عن اكتمال النشر

- [ ] `./scripts/pre-deploy-check.sh .env.production` يُنهي بـ "✅ جاهز"
      (يغطي البنود الثلاثة التالية دفعة واحدة — أبقيناها مفصَّلة أدناه
      لمن يفضّل تشغيلها يدوياً بندأً بندأً)
- [ ] `npm run build:check` نظيف تماماً (0 أخطاء)
- [ ] `npm test` → كل الاختبارات ناجحة (350 بهذا الإصدار)
- [ ] `npm run check:env` → لا نواقص بالمتغيرات الحرجة
- [ ] [بيانات موجودة فقط] `npm run check:migration-016` → صفر مخالفات، أو
      خطة NOT VALID/VALIDATE مُطبَّقة بدلاً منها
- [ ] `npm run db:migrate` نجح لكل الملفات 001-016 دون أي rollback
- [ ] `npm run build` نجح
- [ ] `GET /api/health` يرجع `status:"ok"` على الدومين الحقيقي بعد التشغيل
- [ ] تسجيل دخول تجريبي ناجح + إجراء واحد حساس (مثال: إنشاء بند ميزانية)
      يعمل فعلياً على الإنتاج، لا فقط محلياً
- [ ] مهمة `audit:verify` مُجدولة (قسم 5) وجرِّبت تشغيلها يدوياً مرة واحدة
      على الأقل بنجاح
- [ ] مهمة `stock:reconcile` مُجدولة (قسم 5ب) وجرِّبت تشغيلها يدوياً مرة
      واحدة على الأقل بنجاح، وتأكدت عدم وجود انحراف غير مبرَّر ببيانات
      الإنتاج الحالية
- [ ] `SECURITY_ALERT_EMAIL` يصله فعلاً بريد اختباري (جرّب كسر تجريبياً
      بيئة تطوير محلية إن أردت تأكيداً كاملاً — لا تختبر هذا بالإنتاج)
- [ ] `SEED_ADMIN_PASSWORD` عُرِّف صراحةً قبل أي تشغيل لـ`db:seed:prod`
      (وإلا يُستخدَم افتراضي معروف بالكود المصدري — راجع تحذير
      `.env.production.template`)

