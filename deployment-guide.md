# دليل النشر الكامل على Render

---

## الخطوة 1 — رفع الكود على GitHub

```bash
# في مجلد المشروع
git init
git add .
git commit -m "feat: ERP System initial release"

# إنشاء repo على github.com ثم:
git remote add origin https://github.com/YOUR_USERNAME/erp-system.git
git branch -M main
git push -u origin main
```

---

## الخطوة 2 — إنشاء قاعدة البيانات على Render

1. اذهب إلى https://render.com وسجل دخولاً
2. اضغط **New +** → **PostgreSQL**
3. الإعدادات:
   - **Name:** `erp-db`
   - **Region:** Frankfurt (EU Central)
   - **Plan:** Starter ($7/mo)
4. اضغط **Create Database**
5. انتظر دقيقة ثم انسخ **External Database URL**

---

## الخطوة 3 — تشغيل Migration على قاعدة البيانات

```bash
# في مجلد المشروع المحلي
# عدّل DATABASE_URL في .env.local بـ External URL من Render

npm run db:migrate
# يشغّل تلقائياً كل الـ9 ملفات (001 → 009) بالترتيب — لا حاجة لتشغيلها يدوياً واحداً واحداً

# بعد نجاح الـ Migration، شغّل الـ Seed
npm run db:seed
# ملاحظة: seed.ts لا ينشئ منحاً تجريبية — أنشئ أول منحة يدوياً بعد النشر من /grants/new
```

---

## الخطوة 4 — نشر التطبيق على Render

1. في Render اضغط **New +** → **Web Service**
2. اختر **Connect a GitHub repository**
3. اختر repo المشروع
4. الإعدادات:
   | الحقل | القيمة |
   |-------|--------|
   | Name | `erp-system` |
   | Region | Frankfurt |
   | Branch | `main` |
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Plan | Starter ($7/mo) |

5. **Environment Variables** — اضغط **Add Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Internal Database URL من الخطوة 2 |
   | `NEXTAUTH_SECRET` | شغّل: `openssl rand -base64 32` وانسخ النتيجة |
   | `NEXTAUTH_URL` | `https://erp-system.onrender.com` |
   | `NEXT_PUBLIC_APP_NAME` | اسم نظامك |

6. اضغط **Create Web Service**
7. انتظر 3-5 دقائق حتى يكتمل البناء

---

## الخطوة 5 — التحقق من النشر

افتح `https://erp-system.onrender.com` في المتصفح.

**بيانات الدخول الأولى:**
```
البريد:      admin@myorg.com
كلمة المرور: Admin@1234
```

**أول شيء تفعله بعد الدخول:**
1. غيّر كلمة مرور الـ admin فوراً
2. أضف بيانات مؤسستك الحقيقية من الإعدادات
3. أنشئ المستخدمين الفعليين

---

## استكشاف الأخطاء الشائعة

**المشكلة:** صفحة بيضاء أو خطأ 500
**الحل:** افتح Render Dashboard → Logs وابحث عن الخطأ

**المشكلة:** `DATABASE_URL is not defined`
**الحل:** تأكد أن Environment Variable مضبوطة في Render

**المشكلة:** `NEXTAUTH_SECRET is not defined`
**الحل:** أضف المتغير في Render Environment Variables

**المشكلة:** تسجيل الدخول لا يعمل
**الحل:** تأكد أن `NEXTAUTH_URL` يطابق URL النشر الفعلي تماماً

---

## تحديث النظام لاحقاً

```bash
# أي تغيير في الكود:
git add . && git commit -m "your message" && git push

# Render سيعيد البناء تلقائياً (Auto-Deploy)

# إذا كان هناك تغيير في Schema:
npm run db:generate  # محلياً
npm run db:migrate   # محلياً على Production DB
git push             # ثم Render يُعيد البناء
```

---

## التكاليف الشهرية

| الخدمة | الخطة | التكلفة |
|--------|-------|---------|
| Web Service | Starter | $7/شهر |
| PostgreSQL | Starter | $7/شهر |
| **الإجمالي** | | **$14/شهر** |

*يمكن الترقية لخطط أكبر عند زيادة الاستخدام*
