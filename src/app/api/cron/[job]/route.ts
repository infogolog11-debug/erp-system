// src/app/api/cron/[job]/route.ts
// ═══════════════════════════════════════════════════════════════
// نقطة تشغيل المهام الدورية يدوياً/خارجياً (audit-verify / stock-reconcile).
//
// السبب في وجودها: Render لا يدعم Cron Jobs على الخطة المجانية
// (يرفض إنشاء الخدمة بخطأ invalid plan: free)، ومنطق الفحص مكتوب
// بـ Node (سلسلة تدقيق hash + مقارنة دفاتر) ولا يمكن تنفيذه من SQL.
// الحل المجاني: pg_cron + pg_net داخل Supabase يستدعيان هذه النقطة.
//
// الحماية: ترويسة x-cron-secret يجب أن تطابق CRON_SECRET بيئياً.
// ═══════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { runScheduledAuditIntegrityCheck } from "@/core/audit/scheduled-check";
import { reconcileStockLedger } from "@/core/inventory/reconcile-stock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { job } = await paramsPromise;

  try {
    if (job === "audit-verify") {
      const s = await runScheduledAuditIntegrityCheck();
      return NextResponse.json({
        job,
        ok: s.brokenCount === 0,
        checkedAt: s.checkedAt,
        totalOrganizations: s.totalOrganizations,
        brokenCount: s.brokenCount,
      });
    }

    if (job === "stock-reconcile") {
      const s = await reconcileStockLedger();
      return NextResponse.json({
        job,
        ok: s.mismatches.length === 0,
        checkedAt: s.checkedAt,
        totalItemsChecked: s.totalItemsChecked,
        mismatchCount: s.mismatches.length,
      });
    }

    return NextResponse.json({ error: "مهمة غير معروفة" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ job, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
