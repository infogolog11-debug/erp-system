// src/app/(dashboard)/vendors/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { vendors } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import VendorList   from "@/modules/vendors/components/VendorList";
import VendorHeader from "@/modules/vendors/components/VendorHeader";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function VendorsPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ status?:string; view?:string; page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "vendors", session.user.role);
  if (!canView(__perm)) redirect("/");

  // إصلاح v32: كانت هذه الصفحة تجلب كل الموردين بلا حد أقصى — مع نمو
  // عدد الموردين مع الوقت هذا يصير استعلاماً ثقيلاً على كل فتح للصفحة.
  const { limit, offset, page } = parsePagination(searchParams);
  const where = and(eq(vendors.organizationId, orgId), eq(vendors.isArchived, false));

  const [pageVendors, totalRow] = await Promise.all([
    db.query.vendors.findMany({
      where,
      with: { contacts: { limit:1 }, categories: true },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: limit + 1, // نجلب واحد زيادة لمعرفة هل فيه صفحة تالية بدون استعلام count منفصل لكل تحميل
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(vendors).where(where),
  ]);

  const hasNextPage = pageVendors.length > limit;
  const allVendors = hasNextPage ? pageVendors.slice(0, limit) : pageVendors;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <VendorHeader total={totalCount} role={session.user.role} />
      <VendorList vendors={allVendors} />
      <PaginationBar
        basePath="/vendors" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
        extraParams={{ status: searchParams.status, view: searchParams.view }}
      />
    </div>
  );
}
