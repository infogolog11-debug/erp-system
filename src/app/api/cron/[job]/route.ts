// src/app/api/cron/[job]/route.ts
// ═══════════════════════════════════════════════════════════════
// نقطة تشغيل المهام الدورية يدوياً/خارجياً (audit-verify / stock-reconcile /
// budget-health).
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
import { runBudgetHealthCheck } from "@/lib/budget/warning";
import { db } from "@/db";
import { grants, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

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

    if (job === "budget-health") {
      // مسح صحة الميزانية لكل المنح النشطة، وإشعار مدير كل منحة (أو أول مدير
      // نظام بالمنظمة عند غيابه) بالخطوط الحرجة/المحجوزة.
      const activeGrants = await db.query.grants.findMany({ where: eq(grants.isActive, true) });

      const results: { grantId: string; code: string; criticals: number; ok: boolean }[] = [];
      for (const g of activeGrants) {
        let notifyUserId = g.grantManagerId ?? null;
        if (!notifyUserId) {
          const admin = await db.query.users.findFirst({
            where: and(
              eq(users.organizationId, g.organizationId),
              inArray(users.role, ["super_admin", "admin"]),
            ),
          });
          notifyUserId = admin?.id ?? null;
        }
        if (!notifyUserId) continue;

        const r = await runBudgetHealthCheck(g.id, g.organizationId, notifyUserId);
        if (!r.success) {
          results.push({ grantId: g.id, code: g.code, criticals: 0, ok: false });
          continue;
        }
        const criticals = r.data.filter(x => x.warningLevel === "critical" || x.warningLevel === "blocked").length;
        results.push({ grantId: g.id, code: g.code, criticals, ok: true });
      }

      const totalCriticals = results.reduce((s, r) => s + r.criticals, 0);
      return NextResponse.json({
        job,
        checkedAt: new Date().toISOString(),
        ok: results.every(r => r.ok),
        grantsChecked: results.length,
        totalCriticals,
        results,
      });
    }

    return NextResponse.json({ error: "مهمة غير معروفة" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ job, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
