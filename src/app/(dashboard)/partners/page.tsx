import { auth } from "@/auth";
import { db } from "@/db";
import { partners } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import PartnerListView from "@/modules/partners/components/PartnerListView";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function PartnersPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;
  const perm = await getUserPermission(session.user.id, orgId, "partners", session.user.role);
  if (!canView(perm)) redirect("/");

  // إصلاح (v34-تتمة-3، بند مفتوح موثّق بـSECURITY_NOTES.md § v32)
  const { limit, offset, page } = parsePagination(searchParams);
  const where = and(eq(partners.organizationId, orgId), eq(partners.isArchived, false));

  const [pagePartners, totalRow] = await Promise.all([
    db.query.partners.findMany({
      where,
      with: { subGrants: { columns: { id:true, totalAmount:true, disbursedAmount:true, subGrantStatus:true } } },
      orderBy: [desc(partners.createdAt)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(partners).where(where),
  ]);

  const hasNextPage = pagePartners.length > limit;
  const allPartners = hasNextPage ? pagePartners.slice(0, limit) : pagePartners;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-building-community text-[#0F6E56]" />الشركاء المنفّذون والمنح الفرعية
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Partner / Sub-grant Management — {totalCount} شريك</p>
        </div>
        <a href="/partners/new" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-4 py-2">
          <i className="ti ti-plus" />تسجيل شريك جديد
        </a>
      </div>
      <PartnerListView partners={allPartners as any} />
      <PaginationBar
        basePath="/partners" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
      />
    </div>
  );
}
