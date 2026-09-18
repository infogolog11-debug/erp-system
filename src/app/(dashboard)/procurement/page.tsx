// src/app/(dashboard)/procurement/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { purchaseRequests, users, grants } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import PRKanban    from "@/modules/procurement/components/PRKanban";
import PRPageHeader from "@/modules/procurement/components/PRPageHeader";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function ProcurementPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ view?:string; grantId?:string; page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "procurement", session.user.role);
  if (!canView(__perm)) redirect("/");
  const view    = searchParams.view ?? "kanban";

  // إصلاح v32: كانت تجلب كل طلبات الشراء بلا حد أقصى. عرض kanban يحتاج
  // رؤية شاملة (حد أعلى 300 كخط دفاع بدل بلا حد)، عرض list يُقسَّم فعلياً
  // لصفحات — نفس نمط /grants.
  const { limit, offset, page } = parsePagination(searchParams);
  const where = and(eq(purchaseRequests.organizationId, orgId), eq(purchaseRequests.isArchived, false));
  const isKanban = view === "kanban";

  const [pagePRs, totalRow] = await Promise.all([
    db.query.purchaseRequests.findMany({
      where,
      with: { grant: { columns:{name:true,code:true} } },
      orderBy: [desc(purchaseRequests.createdAt)],
      limit: isKanban ? 300 : limit + 1,
      offset: isKanban ? 0 : offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(purchaseRequests).where(where),
  ]);

  const hasNextPage = !isKanban && pagePRs.length > limit;
  const allPRs = hasNextPage ? pagePRs.slice(0, limit) : pagePRs;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PRPageHeader total={totalCount} currentView={view} role={session.user.role}/>
      <PRKanban prs={allPRs} currentView={view}/>
      {!isKanban && (
        <PaginationBar
          basePath="/procurement" currentPage={page} hasNextPage={hasNextPage}
          totalCount={totalCount} pageSize={limit}
          extraParams={{ view: searchParams.view, grantId: searchParams.grantId }}
        />
      )}
    </div>
  );
}
