import { auth }    from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db }      from "@/db";
import {
  purchaseRequests, purchaseOrders, grants, grantBudgetLines,
  employees, payrollRuns, vendors, vendorRatings, assets,
} from "@/db/schema";
import { eq, and, sql, count, sum, desc, gte } from "drizzle-orm";
import ReportsDashboard from "@/modules/reports/components/ReportsDashboard";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "reports", session.user.role);
  if (!canView(__perm)) redirect("/");
  const now     = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth()-5, 1);

  // 1. إنفاق المشتريات الشهري (آخر 6 أشهر)
  const monthlyPR = await db.select({
    month:  sql<number>`EXTRACT(MONTH FROM created_at)`,
    year:   sql<number>`EXTRACT(YEAR  FROM created_at)`,
    total:  sql<number>`COALESCE(SUM(CAST(estimated_total AS NUMERIC)),0)`,
    cnt:    count(),
  }).from(purchaseRequests)
    .where(and(eq(purchaseRequests.organizationId, orgId), gte(purchaseRequests.createdAt, sixMonthsAgo)))
    .groupBy(sql`EXTRACT(MONTH FROM created_at)`, sql`EXTRACT(YEAR FROM created_at)`)
    .orderBy(sql`EXTRACT(YEAR FROM created_at)`, sql`EXTRACT(MONTH FROM created_at)`);

  // 2. توزيع المنح حسب الحالة
  const grantsByStatus = await db.select({
    status: grants.status,
    cnt:    count(),
    total:  sql<number>`COALESCE(SUM(CAST(total_amount AS NUMERIC)),0)`,
  }).from(grants)
    .where(eq(grants.organizationId, orgId))
    .groupBy(grants.status);

  // 3. أفضل 5 موردين (حسب عدد POs)
  const topVendors = await db.select({
    vendorId:   purchaseOrders.vendorId,
    vendorName: vendors.name,
    poCount:    count(),
    totalValue: sql<number>`COALESCE(SUM(CAST(${purchaseOrders.totalAmount} AS NUMERIC)),0)`,
  }).from(purchaseOrders)
    .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .where(eq(purchaseOrders.organizationId, orgId))
    .groupBy(purchaseOrders.vendorId, vendors.name)
    .orderBy(desc(count()))
    .limit(5);

  // 4. إجماليات الرواتب آخر 6 أشهر
  const monthlyPayroll = await db.select({
    month:    payrollRuns.month,
    year:     payrollRuns.year,
    totalNet: sql<number>`COALESCE(SUM(CAST(total_net AS NUMERIC)),0)`,
    empCount: sql<number>`COALESCE(SUM(employee_count),0)`,
  }).from(payrollRuns)
    .where(and(eq(payrollRuns.organizationId, orgId), gte(payrollRuns.createdAt, sixMonthsAgo)))
    .groupBy(payrollRuns.month, payrollRuns.year)
    .orderBy(payrollRuns.year, payrollRuns.month);

  // 5. صحة الأصول
  const assetHealth = await db.select({
    condition:  assets.assetCondition,
    cnt:        count(),
    totalValue: sql<number>`COALESCE(SUM(CAST(current_value AS NUMERIC)),0)`,
  }).from(assets)
    .where(eq(assets.organizationId, orgId))
    .groupBy(assets.assetCondition);

  // 6. إجمالي الميزانية
  const budgetSummary = await db.select({
    totalPlanned:    sql<number>`COALESCE(SUM(CAST(planned_amount AS NUMERIC)),0)`,
    totalSpent:      sql<number>`COALESCE(SUM(CAST(spent_amount AS NUMERIC)),0)`,
    totalCommitted:  sql<number>`COALESCE(SUM(CAST(committed_amount AS NUMERIC)),0)`,
  }).from(grantBudgetLines)
    .where(eq(grantBudgetLines.organizationId, orgId));

  const MONTH_AR = ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  return (
    <ReportsDashboard
      monthlyPR={monthlyPR.map(r => ({
        label: `${MONTH_AR[Number(r.month)]} ${r.year}`,
        total: Number(r.total),
        count: Number(r.cnt),
      }))}
      grantsByStatus={grantsByStatus.map(r => ({
        status: r.status,
        count:  Number(r.cnt),
        total:  Number(r.total),
      }))}
      topVendors={topVendors.map(r => ({
        name:       r.vendorName ?? "غير معروف",
        poCount:    Number(r.poCount),
        totalValue: Number(r.totalValue),
      }))}
      monthlyPayroll={monthlyPayroll.map(r => ({
        label:    `${MONTH_AR[r.month]} ${r.year}`,
        totalNet: Number(r.totalNet),
        empCount: Number(r.empCount),
      }))}
      assetHealth={assetHealth.map(r => ({
        condition:  r.condition,
        count:      Number(r.cnt),
        totalValue: Number(r.totalValue),
      }))}
      budgetSummary={{
        planned:   Number(budgetSummary[0]?.totalPlanned   ?? 0),
        spent:     Number(budgetSummary[0]?.totalSpent     ?? 0),
        committed: Number(budgetSummary[0]?.totalCommitted ?? 0),
      }}
    />
  );
}
