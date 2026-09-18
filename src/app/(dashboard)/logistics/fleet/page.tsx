import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { vehicles, drivers } from "@/db/schema";
import { eq, and, desc, sql, or, isNotNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import FleetListView from "@/modules/fleet/components/FleetListView";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function FleetPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "fleet", session.user.role);
  if (!canView(__perm)) redirect("/");

  // إصلاح v32: كانت تجلب كل المركبات/السائقين بلا حد أقصى. القائمة
  // المعروضة الآن مُقسَّمة لصفحات، لكن التنبيهات (صيانة مستحقة/رخصة على
  // وشك الانتهاء) تحتاج فحص *كل* السجلات لتبقى صحيحة — لذا استعلام
  // منفصل خفيف (أعمدة قليلة فقط، ومُصفّى مسبقاً بشرط وجود تاريخ/عداد
  // أصلاً) يجلب كل شي لغرض التنبيه فقط، بمعزل عن استعلام العرض المُقسَّم.
  const { limit, offset, page } = parsePagination(searchParams, 30);
  const vehicleWhere = and(eq(vehicles.organizationId, orgId), eq(vehicles.isArchived, false));

  const [pageVehicles, totalRow, alertVehicles, allDrivers] = await Promise.all([
    db.query.vehicles.findMany({
      where: vehicleWhere,
      with: { assignedDriver: true },
      orderBy: [desc(vehicles.createdAt)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(vehicles).where(vehicleWhere),
    db.query.vehicles.findMany({
      where: and(vehicleWhere, or(isNotNull(vehicles.nextServiceDate), isNotNull(vehicles.nextServiceOdometer))),
      columns: { id:true, plateNumber:true, currentOdometer:true, nextServiceOdometer:true, nextServiceDate:true },
    }),
    db.query.drivers.findMany({
      where: and(eq(drivers.organizationId, orgId), eq(drivers.isActive, true)),
    }),
  ]);

  const hasNextPage = pageVehicles.length > limit;
  const allVehicles = hasNextPage ? pageVehicles.slice(0, limit) : pageVehicles;
  const totalCount = Number(totalRow[0]?.c ?? 0);
  const alertDrivers = allDrivers.filter(d => d.licenseExpiryDate);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-truck text-[#0F6E56]" />إدارة الأسطول
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Logistics / Fleet Management — {totalCount} مركبة</p>
        </div>
      </div>
      <FleetListView
        vehicles={allVehicles as any} drivers={allDrivers}
        alertVehicles={alertVehicles as any} alertDrivers={alertDrivers as any}
        organizationId={orgId} userId={session.user.id}
      />
      <PaginationBar
        basePath="/logistics/fleet" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
      />
    </div>
  );
}
