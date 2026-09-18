/**
 * فحص متغيرات البيئة قبل النشر
 * شغّله بـ: npx tsx --env-file=.env.local scripts/check-env.ts
 *
 * القوائم مبنية على المتغيرات المُستخدمة فعلياً بالكود (تم التحقق عبر grep)
 * وليس تخميناً من .env.example فقط.
 */

const REQUIRED = [
  "DATABASE_URL",       // اتصال PostgreSQL — بدونه لا يعمل أي شيء
  "AUTH_SECRET",        // NextAuth v5 يقرأه ضمنياً — بدونه الجلسات غير آمنة/لا تعمل
] as const;

// إلزامي فعلياً لو ميزة البريد الإلكتروني مفعّلة (تأكيد حساب، تنبيهات)
const REQUIRED_FOR_EMAIL = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const;

// إلزامي فعلياً لو رفع الملفات (مرفقات، مستندات) مفعّل
const REQUIRED_FOR_STORAGE = [
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_REGION",
] as const;

const RECOMMENDED = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_APP_NAME",
  "NODE_ENV",
  "SECURITY_ALERT_EMAIL", // تنبيه مباشر لو انكسرت سلسلة سجل التدقيق — راجع scripts/verify-audit-integrity.ts
] as const;

function checkGroup(name: string, vars: readonly string[]): string[] {
  const missing = vars.filter((v) => !process.env[v] || process.env[v]?.trim() === "");
  if (missing.length === 0) {
    console.log(`✅ ${name}: كل المتغيرات موجودة`);
  } else {
    console.log(`❌ ${name}: ناقص — ${missing.join(", ")}`);
  }
  return missing;
}

function main() {
  console.log("🔍 فحص متغيرات البيئة...\n");

  const missingRequired = checkGroup("أساسي (حاجب)", REQUIRED);
  const missingEmail    = checkGroup("البريد الإلكتروني", REQUIRED_FOR_EMAIL);
  const missingStorage  = checkGroup("رفع الملفات", REQUIRED_FOR_STORAGE);
  const missingRecommended = checkGroup("موصى به", RECOMMENDED);

  console.log("");

  if (missingRequired.length > 0) {
    console.log("🛑 توقف — متغيرات أساسية ناقصة، النظام لن يعمل بدونها.");
    process.exit(1);
  }

  if (missingEmail.length > 0) {
    console.log("⚠️  تحذير — ميزات البريد الإلكتروني (تأكيد الحساب، التنبيهات) لن تعمل حتى تُضبط هذه القيم.");
  }

  if (missingStorage.length > 0) {
    console.log("⚠️  تحذير — رفع المرفقات لن يعمل حتى تُضبط هذه القيم.");
  }

  if (missingEmail.length === 0 && missingStorage.length === 0 && missingRecommended.length === 0) {
    console.log("✅ كل المتغيرات (الأساسية والموصى بها) مضبوطة بالكامل.");
  } else if (missingRequired.length === 0) {
    console.log("✅ المتغيرات الأساسية الحاجبة كلها مضبوطة — يمكن المتابعة، لكن راجع التحذيرات أعلاه.");
  }

  process.exit(0);
}

main();
