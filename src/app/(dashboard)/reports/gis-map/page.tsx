import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { beneficiaries, warehouses } from "@/db/schema";
import { eq, and, isNotNull, count } from "drizzle-orm";
import { redirect } from "next/navigation";
import GISMapView from "@/modules/gis/components/GISMapView";

export default async function GISMapPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "reports", session.user.role);
  if (!canView(__perm)) redirect("/");

  const [mappedBeneficiaries, mappedWarehouses, [{ cnt: totalBeneficiaries }]] = await Promise.all([
    db.query.beneficiaries.findMany({
      where: and(eq(beneficiaries.organizationId, orgId), isNotNull(beneficiaries.latitude), isNotNull(beneficiaries.longitude)),
      columns: { id:true, code:true, firstName:true, lastName:true, fullNameAr:true, latitude:true, longitude:true, vulnerabilityCategory:true, verificationStatus:true },
    }),
    db.query.warehouses.findMany({
      where: and(eq(warehouses.organizationId, orgId), isNotNull(warehouses.latitude), isNotNull(warehouses.longitude)),
      columns: { id:true, code:true, name:true, nameAr:true, latitude:true, longitude:true },
    }),
    db.select({ cnt: count() }).from(beneficiaries).where(eq(beneficiaries.organizationId, orgId)),
  ]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-map-pin text-[#0F6E56]" />الخريطة الجغرافية للعمليات
        </h1>
        <p className="text-[13px] text-[#6B7280] mt-1">
          GIS Mapping — {mappedBeneficiaries.length} من {totalBeneficiaries} مستفيد لديهم إحداثيات مسجّلة · {mappedWarehouses.length} مستودع
        </p>
      </div>
      <GISMapView beneficiaries={mappedBeneficiaries as any} warehouses={mappedWarehouses as any} />
    </div>
  );
}
