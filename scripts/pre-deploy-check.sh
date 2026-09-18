#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# فحص شامل قبل النشر — يقرر هل السيرفر جاهز لتشغيل run-migrations.ts
# ═══════════════════════════════════════════════════════════════
#
# التشغيل:
#   ./scripts/pre-deploy-check.sh [مسار ملف env]
#   (افتراضياً: .env.production — مرّره كأول وسيط لو غير ذلك. لازم يحتوي
#   DATABASE_URL الحقيقي لبيئة الإنتاج، وإلا فحص migration 016 لن يعني
#   شيئاً — نفس تحذير pre-migration-016-diagnostics.ts نفسه.)
#
# هذا السكريبت **لا يُشغّل** run-migrations.ts ولا أي أمر يُعدّل بيانات أو
# بنية قاعدة البيانات — كل خطواته قراءة/فحص فقط (tsc، vitest، وسكريبت
# التشخيص الذي هو SELECT فقط). التشغيل الفعلي لـrun-migrations.ts قرار
# بشري منفصل يُتخذ *بعد* قراءة التقرير النهائي هنا، لا جزءاً آلياً منه —
# هذا مقصود: قرار "متى ننشر فعلياً" لا يجب أن يُترك لسكريبت.
#
# كود الخروج: 0 = كل الفحوصات الحاجبة ناجحة، جاهز لتشغيل run-migrations.ts يدوياً.
#             1 = فحص حاجب واحد أو أكثر فشل — لا تُشغّل run-migrations.ts.

set -uo pipefail
# ملاحظة: لا نستخدم set -e عمداً — نريد تشغيل كل الفحوصات وتجميع نتائجها
# كلها بالتقرير النهائي، لا التوقف عند أول فشل.

# ── الألوان (تُعطَّل تلقائياً لو الإخراج ليس طرفية تفاعلية — مهم لسجلات CI) ──
if [[ -t 1 ]]; then
  RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[0;33m'; BLUE=$'\033[0;34m'; BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  RED=""; GREEN=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi

ENV_FILE="${1:-.env.production}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

declare -a RESULT_NAMES=()
declare -a RESULT_STATUS=()   # PASS | FAIL | WARN
declare -a RESULT_DETAIL=()

record() {
  RESULT_NAMES+=("$1")
  RESULT_STATUS+=("$2")
  RESULT_DETAIL+=("$3")
}

section() {
  echo ""
  echo "${BOLD}${BLUE}▶ $1${RESET}"
}

echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
echo "${BOLD}  فحص ما قبل النشر — $(date '+%Y-%m-%d %H:%M:%S')${RESET}"
echo "${BOLD}  ملف البيئة: ${ENV_FILE}${RESET}"
echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"

# ─────────────────────────────────────────────────────────────
# 1) وجود ملف البيئة نفسه
# ─────────────────────────────────────────────────────────────
section "1) ملف البيئة"
if [[ -f "$ENV_FILE" ]]; then
  echo "  ✅ الملف موجود: $ENV_FILE"
  record "ملف البيئة موجود" "PASS" "$ENV_FILE"
  # نحمّله بهذا الشِل نفسه (export) — نحتاج DATABASE_URL وبقية المتغيرات
  # متاحة بهذا السكريبت نفسه لعرض التقرير، وليس فقط للأدوات الفرعية
  # (npx tsx --env-file=... تحمّله بشكل مستقل بخطوة 5 على أي حال).
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "  ${RED}❌ الملف غير موجود: $ENV_FILE${RESET}"
  echo "     مرِّر مسار ملف env الصحيح كوسيط أول، مثال:"
  echo "     ./scripts/pre-deploy-check.sh .env.production"
  record "ملف البيئة موجود" "FAIL" "$ENV_FILE غير موجود"
fi

# ─────────────────────────────────────────────────────────────
# 2) المتغيرات البيئية الأساسية
# ─────────────────────────────────────────────────────────────
section "2) المتغيرات البيئية الأساسية"

# نفس القوائم المعتمَدة بـscripts/check-env.ts (وليست تخميناً منفصلاً) —
# لو عدّلت واحدة، عدّل الأخرى. الأسماء هنا مطابقة لما يقرأه next-auth v5
# فعلياً (AUTH_SECRET/AUTH_URL) — .env.example القديم بالمشروع يستخدم
# NEXTAUTH_SECRET/NEXTAUTH_URL الخاصة بـv4، وهذا غير صحيح لهذا الإصدار
# (تحقّقنا من هذا بقراءة src/auth.ts وكود next-auth@5 فعلياً).
REQUIRED_VARS=(DATABASE_URL AUTH_SECRET)
RECOMMENDED_VARS=(SECURITY_ALERT_EMAIL NEXT_PUBLIC_APP_URL AUTH_URL)
EMAIL_VARS_RESEND=(RESEND_API_KEY EMAIL_FROM)
EMAIL_VARS_SMTP=(SMTP_HOST SMTP_USER SMTP_PASS EMAIL_FROM)

missing_required=()
for v in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then missing_required+=("$v"); fi
done

if [[ ${#missing_required[@]} -eq 0 ]]; then
  echo "  ✅ كل المتغيرات الأساسية (${REQUIRED_VARS[*]}) موجودة"
  record "متغيرات أساسية" "PASS" "${REQUIRED_VARS[*]}"
else
  echo "  ${RED}❌ ناقص: ${missing_required[*]}${RESET}"
  record "متغيرات أساسية" "FAIL" "ناقص: ${missing_required[*]}"
fi

missing_recommended=()
for v in "${RECOMMENDED_VARS[@]}"; do
  if [[ -z "${!v:-}" ]]; then missing_recommended+=("$v"); fi
done
if [[ ${#missing_recommended[@]} -eq 0 ]]; then
  echo "  ✅ كل المتغيرات الموصى بها موجودة"
  record "متغيرات موصى بها" "PASS" "-"
else
  echo "  ${YELLOW}⚠️  ناقص (لن يمنع النشر لكن يُفعِّل تحذيراً): ${missing_recommended[*]}${RESET}"
  record "متغيرات موصى بها" "WARN" "ناقص: ${missing_recommended[*]}"
fi

# بريد إلكتروني: مقبول لو Resend مكتمل أو SMTP مكتمل (أحدهما يكفي)
resend_ok=true; for v in "${EMAIL_VARS_RESEND[@]}"; do [[ -z "${!v:-}" ]] && resend_ok=false; done
smtp_ok=true;   for v in "${EMAIL_VARS_SMTP[@]}";   do [[ -z "${!v:-}" ]] && smtp_ok=false; done
if $resend_ok || $smtp_ok; then
  echo "  ✅ إعدادات بريد إلكتروني كاملة ($([ "$resend_ok" = true ] && echo Resend || echo SMTP))"
  record "إعدادات البريد" "PASS" "$([ "$resend_ok" = true ] && echo Resend || echo SMTP)"
else
  echo "  ${YELLOW}⚠️  لا Resend ولا SMTP مكتمل — تنبيهات البريد (SECURITY_ALERT_EMAIL، تسوية المخزون) لن تُرسَل${RESET}"
  record "إعدادات البريد" "WARN" "لا مزوّد بريد مكتمل"
fi

# تحذير أمني حرج: كلمة مرور admin الافتراضية (src/db/seed-production.ts)
if [[ -z "${SEED_ADMIN_PASSWORD:-}" ]]; then
  echo "  ${YELLOW}⚠️  SEED_ADMIN_PASSWORD غير مُعرَّف — لو شُغِّل db:seed:prod سيُستخدَم"
  echo "     كلمة مرور افتراضية معروفة بالكود المصدري (Admin@1234). لا تُشغّل"
  echo "     seed على الإنتاج بدون تعريف هذا المتغير أولاً.${RESET}"
  record "SEED_ADMIN_PASSWORD" "WARN" "غير معرَّف — خطر أمني لو شُغِّل seed:prod"
else
  echo "  ✅ SEED_ADMIN_PASSWORD معرَّف (لن يُستخدَم أي افتراضي معروف)"
  record "SEED_ADMIN_PASSWORD" "PASS" "-"
fi

# ─────────────────────────────────────────────────────────────
# 3) npx tsc --noEmit
# ─────────────────────────────────────────────────────────────
section "3) فحص أنواع TypeScript (tsc --noEmit)"
if npx tsc --noEmit > /tmp/pre-deploy-tsc.log 2>&1; then
  echo "  ✅ نظيف — 0 أخطاء أنواع"
  record "tsc --noEmit" "PASS" "0 أخطاء"
else
  err_count=$(grep -c "error TS" /tmp/pre-deploy-tsc.log || true)
  echo "  ${RED}❌ فشل — ${err_count} خطأ. التفاصيل: /tmp/pre-deploy-tsc.log${RESET}"
  tail -20 /tmp/pre-deploy-tsc.log | sed 's/^/     /'
  record "tsc --noEmit" "FAIL" "${err_count} خطأ — راجع /tmp/pre-deploy-tsc.log"
fi

# ─────────────────────────────────────────────────────────────
# 4) npx vitest run
# ─────────────────────────────────────────────────────────────
section "4) الاختبارات (vitest run)"
if NO_COLOR=1 npx vitest run > /tmp/pre-deploy-vitest.log 2>&1; then
  summary_line=$(grep -E "Tests +[0-9]+ (passed|failed)" /tmp/pre-deploy-vitest.log | tail -1 | sed 's/^ *//')
  echo "  ✅ كل الاختبارات ناجحة — ${summary_line:-(راجع السجل الكامل)}"
  record "vitest run" "PASS" "${summary_line:-ناجح}"
else
  summary_line=$(grep -E "Tests +[0-9]+ (passed|failed)" /tmp/pre-deploy-vitest.log | tail -1 | sed 's/^ *//')
  echo "  ${RED}❌ فشل اختبار واحد أو أكثر — ${summary_line:-(راجع السجل الكامل)}${RESET}"
  echo "     التفاصيل: /tmp/pre-deploy-vitest.log"
  record "vitest run" "FAIL" "${summary_line:-فشل}"
fi

# ─────────────────────────────────────────────────────────────
# 5) سكريبت تشخيص migration 016 (قراءة فقط — لا يُعدّل شيئاً)
# ─────────────────────────────────────────────────────────────
section "5) تشخيص migration 016 (فحص بيانات تاريخية مخالفة)"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "  ${YELLOW}⚠️  تخطّي — DATABASE_URL غير معرَّف بملف البيئة، لا يمكن الاتصال بقاعدة الإنتاج${RESET}"
  record "تشخيص migration 016" "WARN" "تخطّي — DATABASE_URL غير معرَّف"
else
  if npx tsx --env-file="$ENV_FILE" scripts/pre-migration-016-diagnostics.ts > /tmp/pre-deploy-mig016.log 2>&1; then
    echo "  ✅ صفر مخالفات — migration 016 آمنة للتنفيذ المباشر"
    record "تشخيص migration 016" "PASS" "صفر مخالفات"
  else
    mig_exit=$?
    if [[ $mig_exit -eq 1 ]]; then
      echo "  ${RED}❌ وُجدت بيانات تاريخية مخالفة — migration 016 سترفض (ROLLBACK) لو نُفِّذت مباشرة${RESET}"
      echo "     استخدم البديل scripts/016_budget_and_disbursement_guards_not_valid.sql بدلاً منها،"
      echo "     أو صحّح البيانات أولاً. التفاصيل الكاملة: /tmp/pre-deploy-mig016.log"
      tail -15 /tmp/pre-deploy-mig016.log | sed 's/^/     /'
      record "تشخيص migration 016" "FAIL" "بيانات مخالفة موجودة — راجع /tmp/pre-deploy-mig016.log"
    else
      echo "  ${RED}❌ خطأ تشغيلي بالسكريبت نفسه (لا علاقة بسلامة البيانات) — راجع /tmp/pre-deploy-mig016.log${RESET}"
      tail -15 /tmp/pre-deploy-mig016.log | sed 's/^/     /'
      record "تشخيص migration 016" "FAIL" "خطأ تشغيلي — راجع /tmp/pre-deploy-mig016.log"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────
# التقرير النهائي
# ─────────────────────────────────────────────────────────────
echo ""
echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"
echo "${BOLD}  التقرير النهائي${RESET}"
echo "${BOLD}═══════════════════════════════════════════════════════════════${RESET}"

fail_count=0
warn_count=0
for i in "${!RESULT_NAMES[@]}"; do
  name="${RESULT_NAMES[$i]}"
  status="${RESULT_STATUS[$i]}"
  detail="${RESULT_DETAIL[$i]}"
  case "$status" in
    PASS) printf "  ${GREEN}%-6s${RESET} %-28s %s\n" "PASS" "$name" "$detail" ;;
    WARN) printf "  ${YELLOW}%-6s${RESET} %-28s %s\n" "WARN" "$name" "$detail"; warn_count=$((warn_count+1)) ;;
    FAIL) printf "  ${RED}%-6s${RESET} %-28s %s\n" "FAIL" "$name" "$detail"; fail_count=$((fail_count+1)) ;;
  esac
done

echo ""
if [[ $fail_count -eq 0 ]]; then
  echo "${GREEN}${BOLD}✅ جاهز — كل الفحوصات الحاجبة ناجحة.${RESET}"
  if [[ $warn_count -gt 0 ]]; then
    echo "${YELLOW}   (${warn_count} تحذير غير حاجب أعلاه — يُستحسَن مراجعته قبل المتابعة)${RESET}"
  fi
  echo ""
  echo "  يمكنك الآن تشغيل يدوياً (هذا السكريبت لا يُشغّله نيابةً عنك):"
  echo "  ${BOLD}npx tsx --env-file=${ENV_FILE} src/db/migrations/run-migrations.ts${RESET}"
  exit 0
else
  echo "${RED}${BOLD}🛑 غير جاهز — ${fail_count} فحص حاجب فشل. لا تُشغّل run-migrations.ts حتى تُصلَح كل ما هو FAIL أعلاه.${RESET}"
  exit 1
fi
