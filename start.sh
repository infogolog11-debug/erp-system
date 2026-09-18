#!/bin/sh
# ═══════════════════════════════════════════════════════════════
# ERP System v39 — Render Start Entrypoint
# Runs: Migrations → Seed (safe) → Next.js App
# ═══════════════════════════════════════════════════════════════
set -e

echo '═══════════════════════════════════════════'
echo '🚀 ERP System v39 — بدء الإقلاع في Render'
echo '═══════════════════════════════════════════'
echo ''

# ─────────────────────────────────────────────
# [1/3] Migrations (الإصدار الأكثر استقراراً CJS أولاً)
# ─────────────────────────────────────────────
echo '⚙️  [1/3] تشغيل قاعدة البيانات Migrations (001→016)...'
if node src/db/migrations/run-migrations.cjs; then
  echo '   ✅ Migrations via CJS — نجح'
else
  echo '   ⚠️  CJS فشل، محاولة النسخة TS كنسخة احتياطية...'
  npx --yes tsx src/db/migrations/run-migrations.ts
fi
echo ''

# ─────────────────────────────────────────────
# [2/3] Seed الإنتاج (بدون إيقاف السكربت عند الفشل لأنه آمن للتشغيل المتكرر)
# ─────────────────────────────────────────────
echo '🌱 [2/3] بذر بيانات الإنتاج الأولية (Admin + Org + Fiscal Year)...'
if node src/db/seed-production.cjs 2>&1; then
  echo '   ✅ Seed via CJS — نجح'
else
  echo '   ⚠️  CJS فشل، محاولة النسخة TS كنسخة احتياطية...'
  (npx --yes tsx src/db/seed-production.ts 2>&1 || echo '   ⚠️  Seed تخطى (ربما تم تنفيذه مسبقاً)')
fi
echo ''

# ─────────────────────────────────────────────
# [3/3] بدء خادم Next.js
# ─────────────────────────────────────────────
echo '🌐 [3/3] بدء تشغيل خادم Next.js (npm start)...'
echo '═══════════════════════════════════════════'
exec npm start
