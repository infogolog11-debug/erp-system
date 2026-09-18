// ════════════════════════════════════════════════════════════════
// حركات المخزون الذرية — يكتب فعلياً بجدول stock_movements (الجدول
// الأصلي الذي كان معرَّفاً بالسكيما منذ البداية ولم يكن أي كود يكتب
// فيه — كانت هذه إحدى أضعف نقاط المشروع بمراجعة سابقة). يحل مشكلتين:
//
// 1) Race Condition (TOCTOU): الفحص "هل يوجد رصيد كافٍ؟" والخصم كانا
//    عمليتين منفصلتين (قراءة ثم UPDATE). هنا بعبارة UPDATE واحدة ذرية
//    بشرط `current_stock >= quantity` — لا نافذة زمنية بين القراءة
//    والكتابة.
//
// 2) عدم تسجيل أي حركة فعلية: items.currentStock كان يتغيّر مباشرة
//    بدون أي سطر بـ stock_movements، فيصير الجدول عديم الفائدة كسجل
//    تدقيق ولا يمكن مطابقته (reconciliation) مع الرصيد المعروض.
//    الآن كل حركة تُسجَّل مع رصيد ومتوسط مرجّح للتكلفة (AVCO) بعدها
//    مباشرة (أعمدة balanceQty/balanceAvgCost أُضيفت لنفس الجدول
//    بدل إنشاء جدول موازٍ منفصل — كان هذا خطأ بجولة سابقة تم تصحيحه).
// ════════════════════════════════════════════════════════════════
import { db } from "@/db";
import { items, stockMovements, warehouses } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

type Tx = Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export type StockMovementResult =
  | { success: true; balanceQty: number; balanceAvgCost: number }
  | { success: false; error: string };

/**
 * warehouseId إلزامي بالسكيما (stock_movements.warehouse_id NOT NULL) لكن
 * كثير من نقاط النداء الحالية (مثل توزيع المستفيدين) لا تملك مفهوم مخزن
 * محدد بعد. بدل ما نكسر كل الاستدعاءات القديمة، نحل "المخزن الافتراضي"
 * تلقائياً (أول مخزن نشط بالمنظمة) لو ما انمرّر صراحة.
 * ⚠️ قرار مؤقت موثَّق بصراحة: لو المنظمة عندها أكثر من مخزن فعلياً وتحتاج
 * تتبّع دقيق لكل مخزن، هذا الافتراض غير كافٍ ويحتاج قرار تشغيلي (أي
 * مخزن يُستخدم لكل نوع عملية) قبل الاعتماد النهائي — مو قرار برمجي بحت.
 */
async function resolveWarehouseId(tx: Tx, organizationId: string, explicit?: string): Promise<string | null> {
  if (explicit) return explicit;
  const wh = await tx.query.warehouses.findFirst({
    where: and(eq(warehouses.organizationId, organizationId), eq(warehouses.isActive, true)),
  });
  return wh?.id ?? null;
}

export async function receiveStock(
  tx: Tx,
  params: {
    organizationId: string;
    itemId: string;
    warehouseId?: string;
    quantity: number;
    unitCost: number;
    grantId?: string;
    referenceTable?: string;
    referenceId?: string;
    idempotencyKey?: string;
    userId: string;
  },
): Promise<StockMovementResult> {
  if (params.quantity <= 0) return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" };

  const warehouseId = await resolveWarehouseId(tx, params.organizationId, params.warehouseId);
  if (!warehouseId) return { success: false, error: "لا يوجد مخزن نشط لهذه المنظمة — يجب إنشاء مخزن أولاً" };

  if (params.idempotencyKey) {
    const dup = await tx.query.stockMovements.findFirst({
      where: and(eq(stockMovements.itemId, params.itemId), eq(stockMovements.idempotencyKey, params.idempotencyKey)),
    });
    if (dup) return { success: true, balanceQty: Number(dup.balanceQty), balanceAvgCost: Number(dup.balanceAvgCost) };
  }

  const rows = await tx.execute<{ current_stock: string; unit_cost: string }>(sql`
    UPDATE items SET
      current_stock = current_stock + ${params.quantity},
      unit_cost = CASE
        WHEN current_stock + ${params.quantity} = 0 THEN unit_cost
        ELSE ((COALESCE(current_stock,0) * COALESCE(unit_cost,0)) + (${params.quantity} * ${params.unitCost}))
             / (current_stock + ${params.quantity})
      END,
      updated_at = now()
    WHERE id = ${params.itemId} AND organization_id = ${params.organizationId}
    RETURNING current_stock, unit_cost
  `).then(r => (r as any).rows ?? r);

  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) return { success: false, error: "الصنف غير موجود" };

  const balanceQty = Number((updated as any).current_stock);
  const balanceAvgCost = Number((updated as any).unit_cost);

  await tx.insert(stockMovements).values({
    organizationId: params.organizationId,
    itemId: params.itemId,
    warehouseId,
    movementType: "in",
    quantity: String(params.quantity),
    unitCost: String(params.unitCost),
    totalCost: String(params.quantity * params.unitCost),
    grantId: params.grantId,
    referenceTable: params.referenceTable,
    referenceId: params.referenceId,
    idempotencyKey: params.idempotencyKey,
    performedBy: params.userId,
    createdBy: params.userId,
    balanceQty: String(balanceQty),
    balanceAvgCost: String(balanceAvgCost),
  });

  return { success: true, balanceQty, balanceAvgCost };
}

export async function issueStock(
  tx: Tx,
  params: {
    organizationId: string;
    itemId: string;
    warehouseId?: string;
    quantity: number;
    grantId?: string;
    referenceTable?: string;
    referenceId?: string;
    idempotencyKey?: string;
    userId: string;
  },
): Promise<StockMovementResult> {
  if (params.quantity <= 0) return { success: false, error: "الكمية يجب أن تكون أكبر من صفر" };

  const warehouseId = await resolveWarehouseId(tx, params.organizationId, params.warehouseId);
  if (!warehouseId) return { success: false, error: "لا يوجد مخزن نشط لهذه المنظمة — يجب إنشاء مخزن أولاً" };

  if (params.idempotencyKey) {
    const dup = await tx.query.stockMovements.findFirst({
      where: and(eq(stockMovements.itemId, params.itemId), eq(stockMovements.idempotencyKey, params.idempotencyKey)),
    });
    if (dup) return { success: true, balanceQty: Number(dup.balanceQty), balanceAvgCost: Number(dup.balanceAvgCost) };
  }

  const rows = await tx.execute<{ current_stock: string; unit_cost: string }>(sql`
    UPDATE items SET
      current_stock = current_stock - ${params.quantity},
      updated_at = now()
    WHERE id = ${params.itemId}
      AND organization_id = ${params.organizationId}
      AND current_stock >= ${params.quantity}
    RETURNING current_stock, unit_cost
  `).then(r => (r as any).rows ?? r);

  const updated = Array.isArray(rows) ? rows[0] : rows;
  if (!updated) {
    const item = await tx.query.items.findFirst({ where: eq(items.id, params.itemId) });
    if (!item) return { success: false, error: "الصنف غير موجود" };
    return { success: false, error: `المخزون غير كافٍ — المتاح ${item.currentStock}` };
  }

  const balanceQty = Number((updated as any).current_stock);
  const balanceAvgCost = Number((updated as any).unit_cost ?? 0);

  await tx.insert(stockMovements).values({
    organizationId: params.organizationId,
    itemId: params.itemId,
    warehouseId,
    movementType: "out",
    quantity: String(params.quantity),
    unitCost: String(balanceAvgCost),
    totalCost: String(params.quantity * balanceAvgCost),
    grantId: params.grantId,
    referenceTable: params.referenceTable,
    referenceId: params.referenceId,
    idempotencyKey: params.idempotencyKey,
    performedBy: params.userId,
    createdBy: params.userId,
    balanceQty: String(balanceQty),
    balanceAvgCost: String(balanceAvgCost),
  });

  return { success: true, balanceQty, balanceAvgCost };
}
