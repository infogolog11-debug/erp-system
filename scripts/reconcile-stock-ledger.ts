/**
 * ═══════════════════════════════════════════════════════════════
 * مهمة دورية: تسوية items.currentStock مقابل دفتر حركات المخزون
 * (كل المنظمات) — تسجيل وتنبيه فقط، بلا أي تصحيح تلقائي.
 * ═══════════════════════════════════════════════════════════════
 * التشغيل اليدوي:
 *   npx tsx --env-file=.env.production scripts/reconcile-stock-ledger.ts
 *
 * التشغيل الدوري: نفس آلية scripts/verify-audit-integrity.ts (راجعه
 * لخيارات Render Cron Job / GitHub Actions). مقترَح: يومياً — الفحص هنا
 * أخف من فحص سلسلة التدقيق (تجميع SQL واحد بدل مسح O(n) لكل سجل)، فتردد
 * أعلى معقول ومفيد لاكتشاف انحراف مبكراً.
 *
 * كود الخروج (exit code):
 *   0  — لا انحراف بأي صنف بأي منظمة
 *   1  — وُجد انحراف بصنف واحد أو أكثر (تنبيهات أُرسلت فعلاً من
 *        reconcileStockLedger نفسها قبل وصول الكود لهذا السطر — تسجيل
 *        وتنبيه فقط، لم يُعدَّل أي رصيد)
 *   2  — خطأ تشغيلي بالسكريبت نفسه (لا علاقة بسلامة البيانات)
 */
import { reconcileStockLedger } from "@/core/inventory/reconcile-stock";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL غير مُعرَّف");
    process.exit(2);
  }

  console.log("🔍 بدء تسوية دفتر المخزون...\n");

  const summary = await reconcileStockLedger();

  console.log(`فُحص ${summary.totalItemsChecked} صنف بتاريخ ${summary.checkedAt.toISOString()}\n`);

  if (summary.mismatches.length === 0) {
    console.log("✅ لا انحراف — كل الأرصدة مطابقة لدفتر الحركات.");
    process.exit(0);
  }

  for (const m of summary.mismatches) {
    console.log(`🔴 ${m.itemCode} (${m.itemName}) — منظمة ${m.organizationId}: المسجَّل ${m.currentStock} مقابل دفتر الحركات ${m.ledgerBalance} (فرق ${m.difference > 0 ? "+" : ""}${m.difference.toFixed(3)})`);
  }

  console.log("\n" + "═".repeat(60));
  console.log(`🔴 ${summary.mismatches.length} صنف بانحراف — تنبيهات أُرسلت لمسؤولي كل منظمة متأثرة (finance_manager/warehouse_manager/admin/super_admin). لا رصيد عُدِّل تلقائياً — يتطلب مراجعة محاسب/مسؤول مخزون.`);
  process.exit(1);
}

main().catch((e) => {
  console.error("❌ خطأ غير متوقع أثناء تسوية المخزون:", e instanceof Error ? e.message : String(e));
  process.exit(2);
});
