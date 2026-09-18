import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { vehicles, drivers, grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import VehicleDetailView from "@/modules/fleet/components/VehicleDetailView";

export default async function VehicleDetailPage({
  params: paramsPromise,
}: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "fleet", session.user.role);
  if (!canView(__perm)) redirect("/");

  const vehicle = await db.query.vehicles.findFirst({
    where: eq(vehicles.id, params.id),
    with: {
      assignedDriver: true,
      trips: { with: { driver: true, grant: { columns:{id:true,name:true,nameAr:true} } }, orderBy:(t,{desc})=>[desc(t.departureDate)] },
      fuelLogs: { orderBy:(t,{desc})=>[desc(t.fuelDate)] },
      maintenanceRecords: { orderBy:(t,{desc})=>[desc(t.maintenanceDate)] },
    },
  });
  if (!vehicle || vehicle.organizationId !== orgId) notFound();

  const [orgDrivers, orgGrants] = await Promise.all([
    db.query.drivers.findMany({ where: eq(drivers.organizationId, orgId), columns:{id:true,fullName:true} }),
    db.query.grants.findMany({ where: eq(grants.organizationId, orgId), columns:{id:true,name:true,nameAr:true} }),
  ]);

  return (
    <VehicleDetailView vehicle={vehicle as any} orgDrivers={orgDrivers} orgGrants={orgGrants} userId={session.user.id} organizationId={orgId} />
  );
}
