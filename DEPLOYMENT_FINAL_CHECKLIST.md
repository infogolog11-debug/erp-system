# ═══════════════════════════════════════════════════════════════
# قائمة تحقق النشر النهائية — نظام إدارة الموارد ERP
# تاريخ النشر: 2026-09-19
# ═══════════════════════════════════════════════════════════════
# Instructions: اطبق ✅ على كل خطوة متكملة، ❌ على الخطوة الفاشلة

# ─────────────────────────────────────────────────────────────
# [أ] حذف الخدمة القديمة
# ─────────────────────────────────────────────────────────────
[ ] تم فتح لوحة Render dashboard.render.com بنجاح
[ ] تم العثور على الخدمة القديمة erp-system (Docker Runtime)
[ ] تم الدخول إلى Settings → Danger Zone → Delete Service
[ ] تم التأكيد على الحذف والخدمة اختفت من قائمة Services

# ─────────────────────────────────────────────────────────────
# [ب] إنشاء خدمة الويب الجديدة (Node Runtime)
# ─────────────────────────────────────────────────────────────
[ ] New → Web Service → تم ربط الريبو infogolog11-debug/erp-system
[ ] الاسم:            erp-system
[ ] Runtime:         Node
[ ] Region:          Oregon
[ ] Branch:          main
[ ] Plan:            Free
[ ] Build Command:   npm install && npm run build
[ ] Start Command:   node src/db/migrations/run-migrations.cjs && (node src/db/seed-production.cjs || true) && npm start
[ ] تم الضغط على Create Web Service

# ─────────────────────────────────────────────────────────────
# [ج] متغيرات البيئة (Environment Variables) — الجولة الأولى
# ─────────────────────────────────────────────────────────────
[ ] فتح تبويب Environment (/environment)
[ ] ✅ DATABASE_URL         = postgresql://postgres:U0kJOCYez4WnIoDw@db.txlcfxfuiphwicpduccc.supabase.co:5432/postgres?sslmode=require
[ ] ✅ NODE_ENV             = production
[ ] ✅ AUTH_SECRET          = GIbjpeeN7i0iEBInnBXbarsPgxvVXjL4aLcnwrugnYU=
[ ] ✅ AUTH_TRUST_HOST      = true
[ ] ✅ NEXT_PUBLIC_APP_NAME = نظام إدارة الموارد
[ ] ✅ SEED_ADMIN_EMAIL     = admin@yourorg.com
[ ] ✅ SEED_ADMIN_PASSWORD  = 2ANRMNTWNPeyXr8w39iZW3EU!1A.
[ ] ✅ AUTH_URL             = تُرك فارغاً (سيُعبأ لاحقاً)
[ ] ✅ NEXT_PUBLIC_APP_URL  = تُرك فارغاً (سيُعبأ لاحقاً)
[ ] تم حفظ التغييرات (Save Changes)

# ─────────────────────────────────────────────────────────────
# [د] انتظار اكتمال أول Build (مدة ~8-15 دقيقة)
# ─────────────────────────────────────────────────────────────
[ ] تبويب Deploys: آخر Deploy بالحالة Live 🟢
[ ] Logs: ظهرت رسالة "✅ جميع الـ Migrations تمت بنجاح!"
[ ] Logs: ظهرت رسالة "✅ تم إعداد بيانات الإنتاج الأساسية بنجاح!"
[ ] Logs: ظهرت رسالة "READY server started on port ..."
[ ] تم نسخ الرابط العام للخدمة:
    https://erp-system-__________.onrender.com

# ─────────────────────────────────────────────────────────────
# [هـ] تحديث AUTH_URL و NEXT_PUBLIC_APP_URL (الجولة الثانية)
# ─────────────────────────────────────────────────────────────
[ ] العودة إلى تبويب Environment
[ ] ✅ AUTH_URL            = https://erp-system-__________.onrender.com
[ ] ✅ NEXT_PUBLIC_APP_URL = https://erp-system-__________.onrender.com
[ ] تم حفظ التغييرات
[ ] انتظار إعادة التشغيل → الحالة تعود إلى Live 🟢

# ─────────────────────────────────────────────────────────────
# [و] إنشاء Cron Job 1 — التحقق من سلسلة التدقيق
# ─────────────────────────────────────────────────────────────
[ ] New → Cron Job → ربط الريبو نفسه
[ ] Name:        erp-audit-integrity-check
[ ] Runtime:     Node
[ ] Region:      Oregon
[ ] Plan:        Free
[ ] Schedule:    0 3 */3 * *
[ ] Build Cmd:   npm install
[ ] Start Cmd:   npm run audit:verify
[ ] Environment: تم إضافة DATABASE_URL (نفس القيمة) + NODE_ENV=production
[ ] تم الحفظ واكتمال Build بنجاح

# ─────────────────────────────────────────────────────────────
# [ز] إنشاء Cron Job 2 — تسوية المخزون
# ─────────────────────────────────────────────────────────────
[ ] New → Cron Job → ربط الريبو نفسه
[ ] Name:        erp-stock-reconcile
[ ] Runtime:     Node
[ ] Region:      Oregon
[ ] Plan:        Free
[ ] Schedule:    30 3 */3 * *
[ ] Build Cmd:   npm install
[ ] Start Cmd:   npm run stock:reconcile
[ ] Environment: تم إضافة DATABASE_URL (نفس القيمة) + NODE_ENV=production
[ ] تم الحفظ واكتمال Build بنجاح

# ─────────────────────────────────────────────────────────────
# [ح] تشغيل Cron Jobs يدوياً
# ─────────────────────────────────────────────────────────────
[ ] erp-audit-integrity-check → زر Run Now → Last Run = Success 🟢
[ ] erp-stock-reconcile       → زر Run Now → Last Run = Success 🟢

# ─────────────────────────────────────────────────────────────
# [ط] التحققات النهائية بالمتصفح
# ─────────────────────────────────────────────────────────────
[ ] /api/health → HTTP 200 → {"status":"ok"} (بعد ~50s Cold Start)
[ ] /login      → تم الدخول بـ admin@yourorg.com + كلمة المرور
[ ] /login      → تم إعادة التوجيه إلى /dashboard بنجاح
[ ] /dashboard/settings/users → ظهر صف admin@yourorg.com دور super_admin

# ─────────────────────────────────────────────────────────────
# [ي] ملاحظات تشغيلية مهمة
# ─────────────────────────────────────────────────────────────
[ ] تأكد من وجود Cold Start ~50s عند أول طلب بعد السكون (>15 دقيقة)
[ ] ملف render.yaml موجود بجذر المشروع كمرجع لتكوينات Blueprint
[ ] تم إنشاء نسخة من هذا الدليل كملف DEPLOYMENT_RENDER_STEP_BY_STEP.md
[ ] تاريخ النشر موثق: 2026-09-19

# ═══════════════════════════════════════════════════════════════
# نهاية قائمة التحقق
# ═══════════════════════════════════════════════════════════════
