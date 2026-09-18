import { auth }    from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db }      from "@/db";
import { donors, grants, grantBudgetLines } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import BudgetVsActualView from "@/modules/reports/components/BudgetVsActualView";

export default async function BudgetVsActualPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "reports", session.user.role);
  if (!canView(__perm)) redirect("/");

  // كل المنح مع المانح والعملة
  const grantRows = await db.query.grants.findMany({
    where: eq(grants.organizationId, orgId),
    orderBy: [asc(grants.name)],
    with: {
      donor:    true,
      currency: true,
    },
  });

  // كل بنود الميزانية لكل المنح في هذه المنظمة
  const budgetLineRows = await db.query.grantBudgetLines.findMany({
    where: eq(grantBudgetLines.organizationId, orgId),
  });

  // تجميع بنود الميزانية حسب المنحة
  const linesByGrant = new Map<string, typeof budgetLineRows>();
  for (const line of budgetLineRows) {
    const arr = linesByGrant.get(line.grantId) ?? [];
    arr.push(line);
    linesByGrant.set(line.grantId, arr);
  }

  // بناء الهيكل: مانح ← منحة ← بنود ميزانية + إجماليات
  type LineVM = {
    id: string; name: string; nameAr: string | null; category: string;
    planned: number; committed: number; spent: number;
    warningThreshold: number; blockThreshold: number;
  };
  type GrantVM = {
    id: string; code: string; name: string; nameAr: string | null;
    currencyCode: string; startDate: string; endDate: string;
    totalAmount: number;
    planned: number; committed: number; spent: number; remaining: number;
    utilizationPct: number;
    lines: LineVM[];
  };
  type DonorVM = {
    id: string; name: string; nameAr: string | null; donorType: string;
    grants: GrantVM[];
    totalPlanned: number; totalCommitted: number; totalSpent: number;
  };

  const donorMap = new Map<string, DonorVM>();

  for (const g of grantRows) {
    const lines = linesByGrant.get(g.id) ?? [];
    const lineVMs: LineVM[] = lines.map(l => ({
      id: l.id,
      name: l.name,
      nameAr: l.nameAr,
      category: l.budgetCategory,
      planned:   Number(l.plannedAmount),
      committed: Number(l.committedAmount),
      spent:     Number(l.spentAmount),
      warningThreshold: l.warningThreshold,
      blockThreshold:   l.blockThreshold,
    }));
    const planned   = lineVMs.reduce((s,l)=>s+l.planned,0);
    const committed = lineVMs.reduce((s,l)=>s+l.committed,0);
    const spent     = lineVMs.reduce((s,l)=>s+l.spent,0);

    const grantVM: GrantVM = {
      id: g.id, code: g.code, name: g.name, nameAr: g.nameAr,
      currencyCode: g.currency?.code ?? "—",
      startDate: g.startDate.toISOString(),
      endDate:   g.endDate.toISOString(),
      totalAmount: Number(g.totalAmount),
      planned, committed, spent,
      remaining: planned - committed - spent,
      utilizationPct: planned > 0 ? ((committed+spent)/planned*100) : 0,
      lines: lineVMs,
    };

    const donorKey = g.donorId;
    if (!donorMap.has(donorKey)) {
      donorMap.set(donorKey, {
        id: g.donor.id, name: g.donor.name, nameAr: g.donor.nameAr,
        donorType: g.donor.donorType,
        grants: [], totalPlanned: 0, totalCommitted: 0, totalSpent: 0,
      });
    }
    const donorVM = donorMap.get(donorKey)!;
    donorVM.grants.push(grantVM);
    donorVM.totalPlanned   += planned;
    donorVM.totalCommitted += committed;
    donorVM.totalSpent     += spent;
  }

  const donorVMs = Array.from(donorMap.values()).sort((a,b)=>b.totalPlanned-a.totalPlanned);

  return <BudgetVsActualView donors={donorVMs} />;
}
