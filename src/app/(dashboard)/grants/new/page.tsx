import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { donors, currencies, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import GrantForm from "@/modules/grants/components/GrantForm";

export default async function NewGrantPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "grants", session.user.role);
  if (!canView(__perm)) redirect("/");
  const [allDonors, allCurrencies, allManagers] = await Promise.all([
    db.query.donors.findMany({ where: eq(donors.organizationId, orgId) }),
    db.query.currencies.findMany({ where: eq(currencies.isActive, true) }),
    db.query.users.findMany({ where: eq(users.organizationId, orgId), columns:{id:true,firstName:true,lastName:true,role:true} }),
  ]);
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6"><h1 className="text-lg font-semibold text-white">منحة جديدة</h1><p className="text-sm text-[#6B7280] mt-0.5">أدخل تفاصيل المنحة وبنود الميزانية</p></div>
      <GrantForm donors={allDonors} currencies={allCurrencies} managers={allManagers} organizationId={orgId} userId={session.user.id}/>
    </div>
  );
}
