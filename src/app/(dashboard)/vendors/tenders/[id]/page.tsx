import { auth }     from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }       from "@/db";
import { tenders, tenderBids, bidEvaluationCriteria } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import BidEvaluationPanel from "@/modules/vendors/components/BidEvaluationPanel";
import ChatterBox    from "@/components/shared/ChatterBox";
import { getRequestPreferences } from "@/lib/preferences";
import type { AppLocale } from "@/lib/preferences";

export default async function TenderDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "vendors", session.user.role);
  if (!canView(__perm)) redirect("/");
  const userId  = session.user.id;
  const prefs = await getRequestPreferences();

  const tender = await db.query.tenders.findFirst({
    where: eq(tenders.id, params.id),
    with:  { bids: { orderBy: (b,{asc})=>[asc(b.createdAt)] } },
  });
  if (!tender || tender.organizationId !== orgId) notFound();

  const criteria = await db.query.bidEvaluationCriteria.findMany({
    where: eq(bidEvaluationCriteria.tenderId, tender.id),
    orderBy: (t,{asc}) => [asc(t.sortOrder)],
  });

  const STATUS_STYLE: Record<string,string> = {
    draft:    "text-[#4B5563]",
    open:     "text-[#1D9E75]",
    closed:   "text-[#EF9F27]",
    awarded:  "text-[#378ADD]",
    cancelled:"text-[#E24B4A]",
  };
  const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
    ar: { draft:"مسودة", open:"مفتوحة", closed:"مقفلة", awarded:"مُرسية", cancelled:"ملغية" },
    en: { draft:"Draft", open:"Open", closed:"Closed", awarded:"Awarded", cancelled:"Cancelled" },
  };
  const labelMap = STATUS_LABEL[prefs.locale] ?? STATUS_LABEL.ar;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{tender.code}</span>
            <span className={`text-xs font-medium ${STATUS_STYLE[tender.status]}`}>● {labelMap[tender.status]}</span>
          </div>
          <h1 className="text-xl font-semibold text-white">{tender.title}</h1>
        </div>
        <div className="text-left">
          <p className="text-sm text-[#4B5563]">{tender.bids.length} {prefs.locale === "ar" ? "عرض" : "bids"}</p>
          {tender.submissionDeadline && (
            <p className="text-xs text-[#6B7280] mt-1">
              {prefs.locale === "ar" ? "الإغلاق:" : "Closing:"} {new Date(tender.submissionDeadline).toLocaleDateString(prefs.locale === "ar" ? "ar" : "en-US")}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* لوحة التقييم */}
          {criteria.length > 0 && tender.bids.length > 0 ? (
            <BidEvaluationPanel
              tenderId={tender.id}
              organizationId={orgId}
              evaluatorId={userId}
              criteria={criteria.map(c => ({
                id:             c.id,
                criteriaNameAr: c.criteriaNameAr ?? c.criteriaName,
                weight:         c.weight,
                maxScore:       c.maxScore ?? 10,
              }))}
              bids={tender.bids.map((b:any) => ({
                id:         b.id,
                vendorName: b.vendorName ?? (prefs.locale === "ar" ? "مورد" : "Vendor"),
                bidAmount:  Number(b.totalAmount ?? 0),
                totalScore: b.totalScore ? Number(b.totalScore) : undefined,
              }))}
              locale={prefs.locale}
            />
          ) : (
            <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-8 text-center">
              <i className="ti ti-award text-[#2D3748] text-[40px]" />
              <p className="text-sm text-[#4B5563] mt-3">
                {criteria.length === 0
                  ? (prefs.locale === "ar" ? "لم تُحدَّد معايير التقييم بعد — أضفها من الإعدادات" : "Evaluation criteria have not been set yet — add them from settings")
                  : (prefs.locale === "ar" ? "لا توجد عروض مقدَّمة حتى الآن" : "No bids submitted yet")}
              </p>
            </div>
          )}

          <ChatterBox tableName="tenders" recordId={tender.id} organizationId={orgId} userId={userId} />
        </div>

        {/* ملخص جانبي */}
        <div className="space-y-5">
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="ti ti-scale text-[#0F6E56]" />{prefs.locale === "ar" ? "معايير التقييم" : "Evaluation criteria"}
            </h2>
            {criteria.length === 0 ? (
              <p className="text-xs text-[#4B5563]">{prefs.locale === "ar" ? "لا توجد معايير — يرجى الإعداد أولاً" : "No criteria — please configure them first"}</p>
            ) : (
              criteria.map(c => (
                <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#1F2937] last:border-0">
                  <span className="text-xs text-[#9CA3AF]">{c.criteriaNameAr ?? c.criteriaName}</span>
                  <span className="text-xs font-bold text-[#EF9F27]">{c.weight}%</span>
                </div>
              ))
            )}
            {criteria.length > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#4B5563]">{prefs.locale === "ar" ? "المجموع" : "Total"}</span>
                <span className={`text-xs font-bold ${criteria.reduce((s,c)=>s+c.weight,0)===100?"text-[#1D9E75]":"text-[#E24B4A]"}`}>
                  {criteria.reduce((s,c)=>s+c.weight,0)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
