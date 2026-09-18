import { auth }       from "@/auth";
import { redirect }   from "next/navigation";
import { db }         from "@/db";
import { fiscalYears, fiscalPeriods } from "@/db/schema";
import { eq, desc }   from "drizzle-orm";
import FiscalYearPanel from "@/modules/settings/components/FiscalYearPanel";

export default async function FiscalYearPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const role    = session.user.role;
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  if (role !== "admin" && role !== "super_admin" && role !== "finance_manager") redirect("/");

  const [years, periods] = await Promise.all([
    db.query.fiscalYears.findMany({ where:eq(fiscalYears.organizationId,orgId), orderBy:[desc(fiscalYears.startDate)] }),
    db.query.fiscalPeriods.findMany({ where:eq(fiscalPeriods.organizationId,orgId), orderBy:[desc(fiscalPeriods.startDate)] }),
  ]);

  return (
    <FiscalYearPanel
      orgId={orgId} userId={userId}
      years={years.map(y => ({
        id:y.id, name:y.name, year:new Date(y.startDate).getFullYear(),
        startDate:y.startDate.toISOString().split("T")[0],
        endDate:y.endDate.toISOString().split("T")[0],
        status:y.status ?? "open",
        isCurrent:!y.isClosed,
      }))}
      periods={periods.map(p => ({
        id:p.id, name:p.name, monthNumber:p.periodNumber,
        fiscalYearId:p.fiscalYearId ?? "",
        startDate:p.startDate.toISOString().split("T")[0],
        endDate:p.endDate.toISOString().split("T")[0],
        isClosed:p.isClosed ?? false,
        closedAt:null,
        closedBy:null,
      }))}
    />
  );
}
