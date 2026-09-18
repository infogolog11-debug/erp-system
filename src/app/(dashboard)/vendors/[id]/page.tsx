import { auth }     from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }       from "@/db";
import { vendors, vendorRatings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import ChatterBox   from "@/components/shared/ChatterBox";
import VendorScorecardPanel from "@/modules/vendors/components/VendorScorecardPanel";

export default async function VendorDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "vendors", session.user.role);
  if (!canView(__perm)) redirect("/");
  const userId  = session.user.id;

  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.id, params.id),
    with:  { contacts: true, preferredCurrency: true },
  });
  if (!vendor || vendor.organizationId !== orgId) notFound();

  const ratings = await db.query.vendorRatings.findMany({
    where: eq(vendorRatings.vendorId, vendor.id),
    orderBy: [desc(vendorRatings.ratingDate)],
    limit: 10,
  });

  const STATUS_STYLE: Record<string,string> = {
    approved:    "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]",
    preferred:   "bg-[#0A1628] text-[#378ADD] border-[#1A3060]",
    pending:     "bg-[#271E0A] text-[#EF9F27] border-[#3D2E00]",
    restricted:  "bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]",
    blacklisted: "bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]",
  };
  const STATUS_LABEL: Record<string,string> = {
    approved:"معتمد", preferred:"مفضل", pending:"قيد المراجعة",
    restricted:"مقيد", blacklisted:"محظور",
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
              {vendor.code}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${STATUS_STYLE[vendor.status] ?? ""}`}>
              {STATUS_LABEL[vendor.status] ?? vendor.status}
            </span>
          </div>
          <h1 className="text-xl font-semibold text-white">{vendor.name}</h1>
          {vendor.nameAr && <p className="text-sm text-[#6B7280] mt-0.5">{vendor.nameAr}</p>}
        </div>
        {vendor.overallScore && Number(vendor.overallScore) > 0 && (
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums text-[#EF9F27]">
              {Number(vendor.overallScore).toFixed(1)}
            </p>
            <p className="text-xs text-[#4B5563]">متوسط التقييم</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* العمود الرئيسي */}
        <div className="lg:col-span-2 space-y-5">
          {/* بيانات المورد */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 grid grid-cols-2 gap-4">
            {[
              { label:"البريد الإلكتروني", value: vendor.email,   icon:"ti-mail" },
              { label:"الهاتف",            value: vendor.phone,   icon:"ti-phone" },
              { label:"الدولة",            value: vendor.country, icon:"ti-map-pin" },
              { label:"الضريبة",           value: vendor.taxNumber, icon:"ti-receipt-tax" },
              { label:"العملة المفضلة",    value: vendor.preferredCurrency?.code, icon:"ti-currency-dollar" },
            ].map(({ label, value, icon }) => value ? (
              <div key={label} className="flex items-start gap-3">
                <i className={`ti ${icon} text-[#4B5563] mt-0.5`} />
                <div>
                  <p className="text-[10px] text-[#4B5563]">{label}</p>
                  <p className="text-sm text-[#D1D5DB] font-medium">{value}</p>
                </div>
              </div>
            ) : null)}
          </div>

          <ChatterBox tableName="vendors" recordId={vendor.id} organizationId={orgId} userId={userId} />
        </div>

        {/* بطاقة الأداء */}
        <div>
          <VendorScorecardPanel
            vendorId={vendor.id}
            vendorName={vendor.name}
            organizationId={orgId}
            ratedBy={userId}
            averageRating={Number(vendor.overallScore ?? 0)}
            ratingsCount={ratings.length}
            history={ratings.map(r => ({
              id:              r.id,
              qualityScore:    Number(r.qualityScore),
              deliveryScore:   Number(r.deliveryScore),
              complianceScore: Number(r.complianceScore),
              weightedAverage: Number(r.weightedAverage),
              comments:        r.comments ?? undefined,
              ratingDate:      r.ratingDate.toISOString(),
            }))}
          />
        </div>
      </div>
    </div>
  );
}
