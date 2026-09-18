import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { beneficiaries, items, grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import BeneficiaryDetailView from "@/modules/beneficiaries/components/BeneficiaryDetailView";

export default async function BeneficiaryDetailPage({
  params: paramsPromise,
}: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "beneficiaries", session.user.role);
  if (!canView(__perm)) redirect("/");

  const beneficiary = await db.query.beneficiaries.findFirst({
    where: eq(beneficiaries.id, params.id),
    with: {
      grant: true,
      householdMembers: true,
      cases: { with: { notes: { orderBy: (t,{desc})=>[desc(t.createdAt)] } }, orderBy: (t,{desc})=>[desc(t.createdAt)] },
      distributions: { with: { item: true }, orderBy: (t,{desc})=>[desc(t.distributionDate)], limit: 50 },
    },
  });

  if (!beneficiary || beneficiary.organizationId !== orgId) notFound();

  const [availableItems, orgGrants] = await Promise.all([
    db.query.items.findMany({ where: eq(items.organizationId, orgId), columns:{id:true,name:true,nameAr:true,unit:true,currentStock:true} }),
    db.query.grants.findMany({ where: eq(grants.organizationId, orgId), columns:{id:true,name:true,nameAr:true} }),
  ]);

  return (
    <BeneficiaryDetailView
      beneficiary={beneficiary as any}
      availableItems={availableItems}
      orgGrants={orgGrants}
      userId={session.user.id}
      organizationId={orgId}
    />
  );
}
