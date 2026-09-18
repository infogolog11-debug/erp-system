import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { partners, grants, currencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import PartnerDetailView from "@/modules/partners/components/PartnerDetailView";
import { getScreeningHistory } from "@/modules/screening/actions";

export default async function PartnerDetailPage({
  params: paramsPromise,
}: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "partners", session.user.role);
  if (!canView(__perm)) redirect("/");

  const partner = await db.query.partners.findFirst({
    where: eq(partners.id, params.id),
    with: {
      subGrants: {
        with: {
          parentGrant: { columns:{ id:true, name:true, nameAr:true } },
          currency: { columns:{ code:true } },
          disbursements: { orderBy: (t,{desc})=>[desc(t.disbursementDate)] },
          reports: { orderBy: (t,{desc})=>[desc(t.submittedDate)] },
        },
        orderBy: (t,{desc})=>[desc(t.createdAt)],
      },
    },
  });
  if (!partner || partner.organizationId !== orgId) notFound();

  const [orgGrants, orgCurrencies, screeningHistory] = await Promise.all([
    db.query.grants.findMany({ where: eq(grants.organizationId, orgId), columns:{id:true,name:true,nameAr:true} }),
    db.query.currencies.findMany({ where: eq(currencies.isActive, true), columns:{id:true,code:true} }),
    getScreeningHistory(orgId, "partner", partner.id),
  ]);

  return (
    <PartnerDetailView
      partner={partner as any}
      orgGrants={orgGrants}
      orgCurrencies={orgCurrencies}
      screeningHistory={screeningHistory as any}
      userId={session.user.id}
      organizationId={orgId}
    />
  );
}
