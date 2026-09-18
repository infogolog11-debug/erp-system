// لوحة التحكم الرئيسية — ديناميكية كاملة
import { auth }   from "@/auth";
import { db }     from "@/db";
import {
  grants, grantBudgetLines, purchaseRequests, employees,
  notifications, vendorInvoices, approvalDecisions,
  payrollRuns, assets, vendors,
} from "@/db/schema";
import { eq, and, count, sql, desc, gte, lt, isNull } from "drizzle-orm";
import Link from "next/link";
import StatCard        from "@/components/dashboard/StatCard";
import BudgetWidget    from "@/components/dashboard/BudgetWidget";
import PendingApprovals from "@/components/dashboard/PendingApprovals";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  const role    = session.user.role;

  const now       = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [
    activeGrants,
    pendingPRs,
    totalEmployees,
    unreadNotifs,
    blockedInvoices,
    emergencyPRs,
    pendingPayroll,
    atRiskBudgets,
    vendorCount,
    thisMonthPRs,
  ] = await Promise.all([
    // منح نشطة
    db.select({ c: count() }).from(grants)
      .where(and(eq(grants.organizationId, orgId), eq(grants.status,"approved"), eq(grants.isArchived,false))),
    // طلبات شراء معلقة
    db.select({ c: count() }).from(purchaseRequests)
      .where(and(eq(purchaseRequests.organizationId, orgId), eq(purchaseRequests.status,"submitted"), eq(purchaseRequests.isArchived,false))),
    // الموظفون النشطون
    db.select({ c: count() }).from(employees)
      .where(and(eq(employees.organizationId, orgId), eq(employees.isActive,true))),
    // إشعارات غير مقروءة
    db.select({ c: count() }).from(notifications)
      .where(and(eq(notifications.organizationId, orgId), eq(notifications.isRead,false), eq(notifications.userId,userId))),
    // فواتير محجوبة (مطابقة ثلاثية فاشلة)
    db.select({ c: count() }).from(vendorInvoices)
      .where(and(eq(vendorInvoices.organizationId, orgId), eq(vendorInvoices.matchingStatus,"discrepancy"))),
    // طلبات طوارئ نشطة
    db.select({ c: count() }).from(purchaseRequests)
      .where(and(eq(purchaseRequests.organizationId, orgId), eq(purchaseRequests.isEmergency,true), eq(purchaseRequests.status,"submitted"))),
    // كشوف رواتب بانتظار الاعتماد
    db.select({ c: count() }).from(payrollRuns)
      .where(and(eq(payrollRuns.organizationId, orgId), eq(payrollRuns.status,"processing"))),
    // خطوط ميزانية تجاوزت 80%
    db.select({ c: count() }).from(grantBudgetLines)
      .where(and(
        eq(grantBudgetLines.organizationId, orgId),
        sql`CAST(spent_amount AS NUMERIC) / NULLIF(CAST(planned_amount AS NUMERIC),0) >= 0.80`,
      )),
    // عدد الموردين المعتمدين
    db.select({ c: count() }).from(vendors)
      .where(and(eq(vendors.organizationId, orgId), eq(vendors.status,"approved"))),
    // طلبات هذا الشهر
    db.select({ c: count() }).from(purchaseRequests)
      .where(and(
        eq(purchaseRequests.organizationId, orgId),
        gte(purchaseRequests.createdAt, thisMonth),
        lt(purchaseRequests.createdAt, nextMonth),
      )),
  ]);

  // آخر 5 طلبات شراء للنشاط الأخير
  const recentPRs = await db.query.purchaseRequests.findMany({
    where: and(eq(purchaseRequests.organizationId, orgId), eq(purchaseRequests.isArchived,false)),
    orderBy: [desc(purchaseRequests.createdAt)],
    limit: 5,
    with: { grant: { columns:{name:true} } },
  });

  // إجمالي الميزانيات المخططة والمنفقة
  const budgetTotals = await db.select({
    planned: sql<number>`COALESCE(SUM(CAST(planned_amount AS NUMERIC)),0)`,
    spent:   sql<number>`COALESCE(SUM(CAST(spent_amount   AS NUMERIC)),0)`,
  }).from(grantBudgetLines)
    .where(eq(grantBudgetLines.organizationId, orgId));

  const totalPlanned = Number(budgetTotals[0]?.planned ?? 0);
  const totalSpent   = Number(budgetTotals[0]?.spent   ?? 0);
  const spendPct     = totalPlanned > 0 ? (totalSpent / totalPlanned * 100) : 0;

  const fmt = (n:number) => n >= 1_000_000
    ? `${(n/1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : String(n);

  const kpis = [
    { label:"منح نشطة",           value: activeGrants[0].c,   icon:"ti-coins",          color:"teal",   href:"/grants",      sub:`${fmt(totalPlanned)} USD مخطط` },
    { label:"طلبات معلقة",        value: pendingPRs[0].c,     icon:"ti-clipboard-list", color:"amber",  href:"/procurement", sub:`${thisMonthPRs[0].c} طلب هذا الشهر` },
    { label:"موظفون نشطون",       value: totalEmployees[0].c, icon:"ti-users",          color:"blue",   href:"/hr",          sub:`${pendingPayroll[0].c} كشف بانتظار اعتماد` },
    { label:"موردون معتمدون",     value: vendorCount[0].c,    icon:"ti-truck",          color:"purple", href:"/vendors",     sub:`${blockedInvoices[0].c} فاتورة محجوبة` },
  ];

  // تنبيهات ذات أولوية
  const alerts = [
    blockedInvoices[0].c > 0  && { type:"danger",  icon:"ti-ban",            msg:`${blockedInvoices[0].c} فاتورة محجوبة — المطابقة الثلاثية فاشلة`, href:"/procurement" },
    emergencyPRs[0].c  > 0    && { type:"warning", icon:"ti-alert-triangle", msg:`${emergencyPRs[0].c} طلب طوارئ نشط بانتظار الموافقة`, href:"/procurement" },
    atRiskBudgets[0].c > 0    && { type:"warning", icon:"ti-chart-bar",      msg:`${atRiskBudgets[0].c} خط ميزانية تجاوز 80%`, href:"/grants" },
    unreadNotifs[0].c  > 0    && { type:"info",    icon:"ti-bell",           msg:`${unreadNotifs[0].c} إشعار غير مقروء`, href:"/notifications" },
  ].filter(Boolean) as { type:string; icon:string; msg:string; href:string }[];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ترحيب */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">
            مرحباً، {session.user.nameAr ?? session.user.firstName ?? ""} 👋
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {now.toLocaleDateString("ar-SA", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </p>
        </div>
        {/* شريط الإنفاق الكلي */}
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-xl px-5 py-3 min-w-[240px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#6B7280]">الإنفاق الكلي للمنح</span>
            <span className={`text-xs font-semibold tabular-nums ${spendPct>=95?"text-[#E24B4A]":spendPct>=80?"text-[#EF9F27]":"text-[#1D9E75]"}`}>
              {spendPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width:`${Math.min(spendPct,100)}%`,
              background: spendPct>=95?"#E24B4A":spendPct>=80?"#EF9F27":"#0F6E56",
            }} />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-[#4B5563]">{fmt(totalSpent)} USD منفق</span>
            <span className="text-[10px] text-[#4B5563]">{fmt(totalPlanned)} USD مخطط</span>
          </div>
        </div>
      </div>

      {/* تنبيهات عاجلة */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {alerts.map((a,i) => (
            <Link key={i} href={a.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                a.type==="danger"  ? "bg-[#2A1215] border-[#4A1C20] text-[#E24B4A] hover:bg-[#3A1A1E]" :
                a.type==="warning" ? "bg-[#1A1400] border-[#3D2E00] text-[#EF9F27] hover:bg-[#221A00]" :
                                     "bg-[#0A1628] border-[#1A3060] text-[#378ADD] hover:bg-[#0F1F3A]"
              }`}>
              <i className={`ti ${a.icon} text-[16px] shrink-0`} />
              <span className="flex-1">{a.msg}</span>
              <i className="ti ti-chevron-left text-[12px] opacity-60" />
            </Link>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* الصف الثاني */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <BudgetWidget organizationId={orgId} />
          {/* النشاط الأخير */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <i className="ti ti-activity text-[#0F6E56]" />آخر الطلبات
              </h2>
              <Link href="/procurement" className="text-xs text-[#0F6E56] hover:text-[#1D9E75]">عرض الكل</Link>
            </div>
            <div className="divide-y divide-[#1F2937]">
              {recentPRs.map(pr => {
                const STATUS_COLOR: Record<string,string> = {
                  draft:"text-[#4B5563]", submitted:"text-[#EF9F27]",
                  approved:"text-[#1D9E75]", rejected:"text-[#E24B4A]", done:"text-[#6B7280]",
                };
                const STATUS_LABEL: Record<string,string> = {
                  draft:"مسودة", submitted:"معلق", approved:"معتمد", rejected:"مرفوض", done:"منجز",
                };
                return (
                  <Link key={pr.id} href={`/procurement/requests/${pr.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#161B26] transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-[#161B26] border border-[#2D3748] flex items-center justify-center shrink-0">
                      <i className="ti ti-clipboard-list text-[14px] text-[#4B5563]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#D1D5DB] truncate">{pr.title}</p>
                      <p className="text-[11px] text-[#4B5563] mt-0.5">{pr.grant?.name ?? "بدون منحة"} · {pr.code}</p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className={`text-xs font-medium ${STATUS_COLOR[pr.status] ?? "text-[#6B7280]"}`}>
                        ● {STATUS_LABEL[pr.status] ?? pr.status}
                      </p>
                      <p className="text-[10px] text-[#4B5563] mt-0.5">
                        {new Date(pr.createdAt).toLocaleDateString("ar")}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {recentPRs.length === 0 && (
                <p className="text-sm text-[#4B5563] text-center py-8">لا توجد طلبات بعد</p>
              )}
            </div>
          </div>
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          <PendingApprovals organizationId={orgId} userId={userId} />
          {/* روابط سريعة */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <i className="ti ti-zap text-[#EF9F27]" />إجراءات سريعة
            </h2>
            <div className="space-y-1.5">
              {[
                { label:"طلب شراء جديد",    href:"/procurement/new",    icon:"ti-plus",          color:"text-[#1D9E75]" },
                { label:"إضافة مورد",        href:"/vendors/new",        icon:"ti-truck",         color:"text-[#378ADD]" },
                { label:"معالجة الرواتب",    href:"/hr/payroll",         icon:"ti-moneybag",      color:"text-[#EF9F27]" },
                { label:"إعدادات النظام",    href:"/settings",           icon:"ti-settings-2",    color:"text-[#6B7280]" },
                { label:"مصفوفة التواقيع",   href:"/settings/approval-matrix", icon:"ti-shield-check", color:"text-[#A855F7]" },
              ].map(a => (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#161B26] transition-colors group">
                  <i className={`ti ${a.icon} text-[15px] ${a.color}`} />
                  <span className="text-sm text-[#9CA3AF] group-hover:text-white transition-colors">{a.label}</span>
                  <i className="ti ti-chevron-left text-[11px] text-[#2D3748] mr-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
