import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db } from "@/db";
import { grants, grantBudgetLines, beneficiaries, distributions } from "@/db/schema";
import { eq, and, count, sum } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { computeSF425, computeEchoSingleForm, computeUnhcrIPR, selectTemplate } from "@/lib/donor-reports/templates";
import DonorReportView from "@/modules/donor-reports/components/DonorReportView";

export default async function DonorReportPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: { params: Promise<{ grantId: string }>; searchParams: Promise<{ template?: string }> }) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "reports", session.user.role);
  if (!canView(__perm)) redirect("/");

  const grant = await db.query.grants.findFirst({
    where: eq(grants.id, params.grantId),
    with: { donor: true, currency: true },
  });
  if (!grant || grant.organizationId !== orgId) notFound();

  const lines = await db.query.grantBudgetLines.findMany({
    where: eq(grantBudgetLines.grantId, grant.id),
  });

  const grantInput = {
    code: grant.code, name: grant.name, nameAr: grant.nameAr,
    totalAmount: Number(grant.totalAmount), currencyCode: grant.currency?.code ?? "—",
    startDate: grant.startDate.toISOString(), endDate: grant.endDate.toISOString(),
  };
  const lineInputs = lines.map(l => ({
    code: l.code, name: l.name, nameAr: l.nameAr, budgetCategory: l.budgetCategory,
    plannedAmount: Number(l.plannedAmount), committedAmount: Number(l.committedAmount), spentAmount: Number(l.spentAmount),
  }));

  const template = searchParams.template ?? selectTemplate(grant.donor?.reportingStandard ?? "generic");

  let report: any = null;
  if (template === "usaid_sf425") {
    report = computeSF425(grantInput, lineInputs);
  } else if (template === "echo_single_form") {
    report = computeEchoSingleForm(grantInput, lineInputs);
  } else if (template === "unhcr_ipr") {
    const [benCount] = await db.select({ cnt: count() }).from(beneficiaries)
      .where(and(eq(beneficiaries.grantId, grant.id), eq(beneficiaries.verificationStatus, "verified")));
    const [distStats] = await db.select({
      cnt: count(),
      totalCash: sum(distributions.cashAmount),
    }).from(distributions).where(eq(distributions.grantId, grant.id));

    report = computeUnhcrIPR(grantInput, lineInputs, {
      beneficiariesReached: Number(benCount?.cnt ?? 0),
      beneficiariesTargeted: Number(benCount?.cnt ?? 0) || 100, // بدون هدف مُعرَّف مسبقاً بعد — يُقارَن بذاته مؤقتاً
      distributionsCount: Number(distStats?.cnt ?? 0),
      totalDistributionValue: Number(distStats?.totalCash ?? 0),
    });
  }

  return (
    <DonorReportView
      report={report}
      template={template}
      donorName={grant.donor?.nameAr || grant.donor?.name || "—"}
      grantId={grant.id}
      availableTemplates={["usaid_sf425","echo_single_form","unhcr_ipr"]}
    />
  );
}
