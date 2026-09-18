// src/app/(dashboard)/grants/page.tsx
import { auth } from "@/auth";
import { db } from "@/db";
import { grants, donors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import GrantKanban     from "@/modules/grants/components/GrantKanban";
import GrantListView   from "@/modules/grants/components/GrantListView";
import GrantPageHeader from "@/modules/grants/components/GrantPageHeader";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function GrantsPage({
  searchParams: searchParamsPromise,
}: { searchParams: Promise<{ view?: string; status?: string; page?: string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  const role    = session.user.role;
  const perm    = await getUserPermission(userId, orgId, "grants", role);
  if (!canView(perm)) redirect("/");
  const view    = searchParams.view ?? "kanban";

  // إصلاح v32: كانت تجلب كل المنح بلا حد أقصى. ملاحظة: عرض Kanban بطبيعته
  // يحتاج يشوف كل الأعمدة/الحالات دفعة وحدة ليكون مفيداً بصرياً — الـ
  // pagination هنا يُطبَّق فقط على عرض القائمة (list)، أما kanban فنُبقيه
  // بحد أعلى أكبر (300) كخط دفاع أخير بدل بلا حد أصلاً، لأن تقسيمه لصفحات
  // يكسر فائدته كأداة عرض شامل — هذا قرار منتج، مو قيد تقني بحت.
  const { limit, offset, page } = parsePagination(searchParams);
  const where = and(eq(grants.organizationId, orgId), eq(grants.isArchived, false));
  const effectiveLimit = view === "kanban" ? 300 : limit;

  const [pageGrants, totalRow] = await Promise.all([
    db.query.grants.findMany({
      where,
      with: { donor: true, budgetLines: true },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: view === "kanban" ? effectiveLimit : effectiveLimit + 1,
      offset: view === "kanban" ? 0 : offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(grants).where(where),
  ]);

  const hasNextPage = view !== "kanban" && pageGrants.length > limit;
  const allGrants = hasNextPage ? pageGrants.slice(0, limit) : pageGrants;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <GrantPageHeader
        total={totalCount}
        currentView={view}
        role={session.user.role}
      />
      {view === "kanban"
        ? <GrantKanban grants={allGrants} />
        : <GrantListView grants={allGrants} />
      }
      {view !== "kanban" && (
        <PaginationBar
          basePath="/grants" currentPage={page} hasNextPage={hasNextPage}
          totalCount={totalCount} pageSize={limit}
          extraParams={{ view: searchParams.view, status: searchParams.status }}
        />
      )}
    </div>
  );
}
