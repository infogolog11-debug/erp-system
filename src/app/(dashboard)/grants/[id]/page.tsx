// src/app/(dashboard)/grants/[id]/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import SmartButtons   from "@/modules/grants/components/SmartButtons";
import StatusBar      from "@/components/shared/StatusBar";
import ChatterBox     from "@/components/shared/ChatterBox";
import BudgetBreakdown  from "@/modules/grants/components/BudgetBreakdown";
import BudgetWarningBar from "@/modules/grants/components/BudgetWarningBar";
import GrantActions   from "@/modules/grants/components/GrantActions";
import { getRequestPreferences } from "@/lib/preferences";
import { getLocaleTag } from "@/lib/i18n";

export default async function GrantDetailPage({
  params: paramsPromise,
}: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const prefs = await getRequestPreferences();
  const localeTag = getLocaleTag(prefs.locale);
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "grants", session.user.role);
  if (!canView(__perm)) redirect("/");

  const grant = await db.query.grants.findFirst({
    where: eq(grants.id, params.id),
    with: {
      donor:            true,
      budgetLines:      true,
      budgetAllocations: { limit: 5, orderBy: (t,{desc})=>[desc(t.createdAt)] },
    },
  });

  if (!grant || grant.organizationId !== orgId) notFound();

  const STATES = ["draft","submitted","approved","done"];
  const t = prefs.locale === "ar"
    ? {
        donorReport: "تقرير المانح",
        basicInfo: "المعلومات الأساسية",
        donor: "المانح",
        totalAmount: "المبلغ الكلي",
        startDate: "تاريخ البداية",
        endDate: "تاريخ الانتهاء",
        description: "الوصف",
        budgetStatus: "حالة خطوط الميزانية",
      }
    : {
        donorReport: "Donor report",
        basicInfo: "Basic information",
        donor: "Donor",
        totalAmount: "Total amount",
        startDate: "Start date",
        endDate: "End date",
        description: "Description",
        budgetStatus: "Budget line status",
      };

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* رأس الصفحة */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
              {grant.code}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white">{grant.name}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{grant.donor?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/reports/donor/${grant.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-[#D1D5DB] bg-[#111827] border border-[#1F2937] hover:border-[#0F6E56] rounded-lg px-3 py-2 transition-colors"
          >
            <i className="ti ti-file-report text-[#0F6E56]" />{t.donorReport}
          </a>
          <GrantActions
            grantId={grant.id}
            status={grant.status}
            role={session.user.role}
            userId={session.user.id}
            organizationId={orgId}
            locale={prefs.locale}
          />
        </div>
      </div>

      {/* شريط الحالة */}
      <StatusBar states={STATES} current={grant.status} locale={prefs.locale} />

      {/* Smart Buttons */}
      <SmartButtons grantId={grant.id} organizationId={orgId} locale={prefs.locale} />

      {/* الصف الرئيسي */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* تفاصيل المنحة */}
        <div className="lg:col-span-2 space-y-5">

          {/* المعلومات الأساسية */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">{t.basicInfo}</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label:t.donor,       value: grant.donor?.name },
                { label:t.totalAmount, value: `${Number(grant.totalAmount).toLocaleString(localeTag)}` },
                { label:t.startDate, value: new Date(grant.startDate).toLocaleDateString(localeTag) },
                { label:t.endDate, value: new Date(grant.endDate).toLocaleDateString(localeTag) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-[#4B5563] mb-1">{label}</p>
                  <p className="text-sm font-medium text-[#D1D5DB]">{value}</p>
                </div>
              ))}
            </div>
            {grant.description && (
              <div className="mt-4 pt-4 border-t border-[#1F2937]">
                <p className="text-xs text-[#4B5563] mb-1">{t.description}</p>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">{grant.description}</p>
              </div>
            )}
          </div>

          {/* تحذيرات الميزانية — طبقة 1 */}
          {grant.budgetLines.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <i className="ti ti-chart-bar text-[#0F6E56]" />{t.budgetStatus}
              </h2>
              {grant.budgetLines.map((line) => (
                <BudgetWarningBar
                  key={line.id}
                  lineName={prefs.locale === "ar" ? (line.nameAr ?? line.name) : line.name}
                  plannedAmount={Number(line.plannedAmount)}
                  spentAmount={Number(line.spentAmount)}
                  committedAmount={Number(line.committedAmount ?? 0)}
                  warningThreshold={line.warningThreshold ?? 80}
                  blockThreshold={line.blockThreshold ?? 100}
                  locale={prefs.locale}
                />
              ))}
            </div>
          )}

          {/* توزيع الميزانية */}
          <BudgetBreakdown lines={grant.budgetLines} totalAmount={grant.totalAmount} locale={prefs.locale} />

        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          <ChatterBox
            tableName="grants"
            recordId={grant.id}
            organizationId={orgId}
            userId={session.user.id}
          />
        </div>
      </div>
    </div>
  );
}
