import { db } from "@/db";
import { items, stockMovements, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { notifyMany } from "@/core/notifications/notify";

// ════════════════════════════════════════════════════════════════
// مهمة دورية: تسوية items.currentStock مقابل دفتر الحركات stock_movements
// ════════════════════════════════════════════════════════════════
// بند مفتوح موثَّق منذ v31 (راجع SECURITY_NOTES.md). items.currentStock
// (الكاش) و stock_movements (دفتر الحركات — "stock_ledger" المطلوب اسمياً
// دُمج بجدول stock_movements نفسه منذ v32، راجع تعليق مطوَّل بأعلى
// src/db/schema/inventory.ts؛ لا جدول منفصل باسم stock_ledger فعلياً)
// يُفترَض أن يتطابقا دائماً لأن receiveStock/issueStock (src/lib/inventory/
// stock-movement.ts) هما المسار الوحيد الذي يكتب currentStock إطلاقاً —
// كلاهما يحدّثان currentStock ويُدرجان سطر حركة (balanceQty) بنفس المعاملة
// الذرّية. تحقّقنا من هذا صراحة: لا مسار آخر بكل src/modules أو src/lib
// يكتب على items.currentStock.
//
// إذن نظرياً لا ينبغي أن يحدث انحراف أبداً. عملياً، هذا بالضبط سبب وجود
// هذه المهمة: تدخّل يدوي بقاعدة البيانات، سكريبت هجرة مستقبلي ينسى هذا
// الافتراض، استعادة نسخة احتياطية جزئية، أو خلل برمجي لاحق — أي واحد من
// هذه يكسر التطابق بصمت لأن لا شيء غير هذه المهمة يتحقق منه فعلياً.
//
// **مبدأ التصميم الأهم (مطلوب صراحة): تسجيل وتنبيه فقط. لا تصحيح تلقائي.**
// اختيار الاتجاه الصحيح للتصحيح (هل currentStock خطأ أم دفتر الحركات ناقص
// سطراً؟) قرار محاسبي يحتاج مراجعة بشرية، وليس شيئاً تقرره هذه المهمة
// آلياً — تصحيح تلقائي خاطئ الاتجاه يُخفي مشكلة حقيقية بدل كشفها.

export interface StockMismatch {
  itemId: string;
  organizationId: string;
  itemCode: string;
  itemName: string;
  currentStock: number;   // القيمة المخزَّنة بـ items.current_stock (الكاش)
  ledgerBalance: number;  // مجموع حركات in (+) وout (-) بـ stock_movements
  difference: number;     // currentStock - ledgerBalance
}

export interface StockReconciliationSummary {
  checkedAt: Date;
  totalItemsChecked: number;
  mismatches: StockMismatch[];
}

// دقة عمود current_stock هي decimal(18,3) — أي فرق أصغر من ذلك تقريب عائم
// عادي من حسابات AVCO المتكررة، وليس انحرافاً حقيقياً يستحق تنبيهاً.
const EPSILON = 0.001;

/**
 * يقارن رصيد كل صنف الكاش (items.currentStock) بمجموع حركاته الفعلية
 * (stock_movements)، ويُنبِّه (لا يُصحِّح) عن أي انحراف. organizationId
 * اختياري — بلا تمرير، يفحص كل المنظمات (الاستخدام الدوري المعتاد عبر
 * scripts/reconcile-stock-ledger.ts). يُستدعى لمنظمة واحدة أيضاً من واجهة
 * تشغيلية لو احتاج مستخدم تحققاً فورياً بمنظمته فقط.
 */
export async function reconcileStockLedger(organizationId?: string): Promise<StockReconciliationSummary> {
  const ledgerRows = await db
    .select({
      itemId: stockMovements.itemId,
      ledgerBalance: sql<string>`SUM(
        CASE
          WHEN ${stockMovements.movementType} = 'in'  THEN  ${stockMovements.quantity}
          WHEN ${stockMovements.movementType} = 'out' THEN -${stockMovements.quantity}
          ELSE 0
        END
      )`,
    })
    .from(stockMovements)
    .where(organizationId ? eq(stockMovements.organizationId, organizationId) : sql`true`)
    .groupBy(stockMovements.itemId);

  const ledgerMap = new Map<string, number>(ledgerRows.map((r) => [r.itemId, Number(r.ledgerBalance)]));

  const allItems = await db.query.items.findMany({
    where: organizationId ? eq(items.organizationId, organizationId) : undefined,
    columns: { id: true, organizationId: true, code: true, name: true, nameAr: true, currentStock: true },
  });

  const mismatches: StockMismatch[] = [];
  for (const item of allItems) {
    const ledgerBalance = ledgerMap.get(item.id) ?? 0;
    const currentStock = Number(item.currentStock ?? 0);
    const difference = currentStock - ledgerBalance;
    if (Math.abs(difference) > EPSILON) {
      mismatches.push({
        itemId: item.id,
        organizationId: item.organizationId,
        itemCode: item.code,
        itemName: item.nameAr || item.name,
        currentStock,
        ledgerBalance,
        difference,
      });
    }
  }

  if (mismatches.length > 0) {
    await alertStockMismatches(mismatches);
  }

  return { checkedAt: new Date(), totalItemsChecked: allItems.length, mismatches };
}

/**
 * تنبيه داخلي فقط (بلا قناة بريد أمني خارجية منفصلة كما بكسر سلسلة
 * التدقيق) — هذا انحراف بيانات محاسبية يحتاج مراجعة محاسب، وليس مؤشر
 * تلاعب أمني بالضرورة. يُجمَّع حسب المنظمة، ويُرسَل لمن يملك صلاحية مالية
 * أو مخزنية فعلية بها (finance_manager/warehouse_manager/admin/super_admin)
 * بدل دور "محاسب" غير موجود أصلاً بمخطط الأدوار الحالي (userRoleEnum).
 */
async function alertStockMismatches(mismatches: StockMismatch[]): Promise<void> {
  const byOrg = new Map<string, StockMismatch[]>();
  for (const m of mismatches) {
    const list = byOrg.get(m.organizationId) ?? [];
    list.push(m);
    byOrg.set(m.organizationId, list);
  }

  for (const [organizationId, orgMismatches] of byOrg) {
    const title = `⚠️ انحراف مخزون مكتشَف — ${orgMismatches.length} صنف`;
    const lines = orgMismatches
      .map((m) => `${m.itemCode} (${m.itemName}): الرصيد المسجَّل ${m.currentStock}، دفتر الحركات ${m.ledgerBalance}، الفرق ${m.difference > 0 ? "+" : ""}${m.difference.toFixed(3)}`)
      .join("\n");
    const body = `تسوية دورية للمخزون اكتشفت عدم تطابق بين الرصيد المخزَّن (currentStock) ودفتر الحركات الفعلي لعدد ${orgMismatches.length} صنف. هذا تسجيل وتنبيه فقط — لم يُعدَّل أي رصيد تلقائياً. يتطلب مراجعة محاسب/مسؤول مخزون لتحديد سبب الانحراف قبل أي تصحيح يدوي.\n\n${lines}`;

    try {
      const recipients = await db.query.users.findMany({
        where: and(eq(users.organizationId, organizationId), eq(users.isActive, true)),
        columns: { id: true, role: true },
      });
      const recipientIds = recipients
        .filter((u) => ["super_admin", "admin", "finance_manager", "warehouse_manager"].includes(u.role))
        .map((u) => u.id);

      if (recipientIds.length > 0) {
        await notifyMany(recipientIds, {
          organizationId,
          title,
          titleAr: title,
          body,
          type: "alert",
          sendEmail: true,
          emailSubject: title,
          emailHtml: `<pre>${body}</pre>`,
        });
      } else {
        console.error(`⚠️  لا يوجد مسؤولون ماليون/مخزنيون نشطون بالمنظمة ${organizationId} لتنبيههم بانحراف المخزون.`);
      }
    } catch (e) {
      console.error(`فشل إرسال تنبيه انحراف المخزون للمنظمة ${organizationId}:`, e);
    }
  }
}
