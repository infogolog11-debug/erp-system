// src/app/(dashboard)/vendors/tenders/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView, canCreate } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { tenders } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";
import { getRequestPreferences } from "@/lib/preferences";
import type { AppLocale } from "@/lib/preferences";
import { TENDER_TYPES, TENDER_TYPE_KEYS, tenderTypeLabel } from "@/lib/i18n";

const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { draft:"مسودة", submitted:"مُقدَّمة", approved:"معتمدة", rejected:"مرفوضة", done:"منجزة", cancelled:"ملغية" },
  en: { draft:"Draft", submitted:"Submitted", approved:"Approved", rejected:"Rejected", done:"Done", cancelled:"Cancelled" },
};

export default async function TendersPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?:string; type?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const prefs = await getRequestPreferences();
  const orgId   = session.user.organizationId;
  const __perm = await getUserPermission(session.user.id, orgId, "vendors", session.user.role);
  if (!canView(__perm)) redirect("/");
  const permCreate = canCreate(__perm);

  const { limit, offset, page } = parsePagination(searchParams);
  const isAr = prefs.locale === "ar";
  const typeFilter = TENDER_TYPE_KEYS.includes(searchParams.type as any) ? searchParams.type! : "";
  const where = and(
    eq(tenders.organizationId, orgId),
    eq(tenders.isArchived, false),
    typeFilter ? eq(tenders.tenderType, typeFilter) : undefined,
  );

  const [pageTenders, totalRow] = await Promise.all([
    db.query.tenders.findMany({
      where,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(tenders).where(where),
  ]);

  const hasNextPage  = pageTenders.length > limit;
  const allTenders   = hasNextPage ? pageTenders.slice(0, limit) : pageTenders;
  const totalCount   = Number(totalRow[0]?.c ?? 0);
  const labelMap     = STATUS_LABEL[prefs.locale] ?? STATUS_LABEL.ar;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">{prefs.locale === "ar" ? "المناقصات" : "Tenders"}</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">{totalCount} {prefs.locale === "ar" ? "مناقصة" : "tenders"}</p>
        </div>
        {permCreate && (
          <Link href="/vendors/tenders/new" className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
            <i className="ti ti-plus text-[16px]" aria-hidden="true" />{prefs.locale === "ar" ? "مناقصة جديدة" : "New tender"}
          </Link>
        )}
      </div>

      {/* تصفية حسب نوع المناقصة */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/vendors/tenders"
          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!typeFilter ? "bg-[#0F6E56] border-[#0F6E56] text-white" : "bg-[#161B26] border-[#1F2937] text-[#9CA3AF] hover:text-[#D1D5DB]"}`}
        >
          {isAr ? "كل الأنواع" : "All types"}
        </Link>
        {TENDER_TYPES.map(t => (
          <Link
            key={t.key}
            href={`/vendors/tenders?type=${t.key}`}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${typeFilter === t.key ? "bg-[#0F6E56] border-[#0F6E56] text-white" : "bg-[#161B26] border-[#1F2937] text-[#9CA3AF] hover:text-[#D1D5DB]"}`}
          >
            {tenderTypeLabel(t.key, prefs.locale)}
          </Link>
        ))}
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937] text-xs text-[#6B7280]">
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "الكود" : "Code"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "العنوان" : "Title"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "النوع" : "Type"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "التصنيف" : "Category"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "القيمة التقديرية" : "Estimated value"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "آخر موعد للتقديم" : "Submission deadline"}</th>
              <th className="text-right font-medium px-4 py-3">{prefs.locale === "ar" ? "الحالة" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {allTenders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[#4B5563]">
                  {prefs.locale === "ar" ? "لا توجد مناقصات بعد" : "No tenders yet"}
                </td>
              </tr>
            ) : (
              allTenders.map((t) => (
                <tr key={t.id} className="border-b border-[#1F2937] last:border-0 hover:bg-[#161B26] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/vendors/tenders/${t.id}`} className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{t.code}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/vendors/tenders/${t.id}`} className="text-[#D1D5DB] hover:text-[#1D9E75] transition-colors">{t.title}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#9CA3AF] bg-[#161B26] px-2 py-0.5 rounded-md whitespace-nowrap">{tenderTypeLabel(t.tenderType, prefs.locale)}</span>
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{t.category}</td>
                  <td className="px-4 py-3 text-[#9CA3AF] tabular-nums" dir="ltr">{t.estimatedValue ? Number(t.estimatedValue).toLocaleString(prefs.locale === "ar" ? "ar" : "en-US") : "—"}</td>
                  <td className="px-4 py-3 text-[#6B7280]" dir="ltr">{t.submissionDeadline ? new Date(t.submissionDeadline).toLocaleDateString(prefs.locale === "ar" ? "ar" : "en-US") : "—"}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{labelMap[t.status] ?? t.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar
        basePath="/vendors/tenders" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
        locale={prefs.locale}
      />
    </div>
  );
}
