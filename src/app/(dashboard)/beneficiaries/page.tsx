import { auth } from "@/auth";
import { db } from "@/db";
import { beneficiaries } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import BeneficiaryListView from "@/modules/beneficiaries/components/BeneficiaryListView";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function BeneficiariesPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId  = session.user.organizationId;
  const userId = session.user.id;
  const role   = session.user.role;
  const perm   = await getUserPermission(userId, orgId, "beneficiaries", role);
  if (!canView(perm)) redirect("/");

  // إصلاح (بند "51 findMany غير مُراجَع" بـSECURITY_NOTES v34/v35): كانت هذه
  // الصفحة تجلب حتى 200 سجل بلا pagination حقيقي (لا صفحة تالية)، والأخطر:
  // الإحصائيات (قيد المراجعة/موثّق/ازدواجية) كانت تُحسب فقط على هذه الـ200
  // المعروضة — أي رقم خاطئ فعلياً لأي منظمة يتجاوز عدد مستفيديها 200. نفس
  // نمط الحل المطبَّق سابقاً بـcfm/inventory: أعمدة خفيفة منفصلة لإحصاء دقيق
  // يغطي كل السجلات، وpagination موحّد للقائمة المعروضة فعلياً.
  const where = and(eq(beneficiaries.organizationId, orgId), eq(beneficiaries.isArchived, false));
  const { limit, offset, page } = parsePagination(searchParams);

  const [statsRows, pageBeneficiaries, totalRow] = await Promise.all([
    db.query.beneficiaries.findMany({
      where,
      columns: { verificationStatus: true },
    }),
    db.query.beneficiaries.findMany({
      where,
      with: { grant: { columns: { id:true, name:true, nameAr:true } } },
      orderBy: [desc(beneficiaries.createdAt)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(beneficiaries).where(where),
  ]);

  const hasNextPage = pageBeneficiaries.length > limit;
  const visible = hasNextPage ? pageBeneficiaries.slice(0, limit) : pageBeneficiaries;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  const stats = {
    total: totalCount,
    pending: statsRows.filter(b => b.verificationStatus === "pending").length,
    verified: statsRows.filter(b => b.verificationStatus === "verified").length,
    flagged: statsRows.filter(b => b.verificationStatus === "flagged_duplicate").length,
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-users-group text-[#0F6E56]" />إدارة المستفيدين
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Beneficiary Management — {stats.total} مسجّل</p>
        </div>
        <a
          href="/beneficiaries/new"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-4 py-2 transition-colors"
        >
          <i className="ti ti-plus" />تسجيل مستفيد جديد
        </a>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label:"الإجمالي", value: stats.total, color:"#378ADD", icon:"users" },
          { label:"قيد المراجعة", value: stats.pending, color:"#EF9F27", icon:"clock" },
          { label:"موثّق", value: stats.verified, color:"#1D9E75", icon:"circle-check" },
          { label:"ازدواجية محتملة", value: stats.flagged, color:"#E24B4A", icon:"alert-triangle" },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6B7280] text-[12px] mb-1">
              <i className={`ti ti-${s.icon}`} style={{ color: s.color }} />{s.label}
            </div>
            <div className="text-xl font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <BeneficiaryListView beneficiaries={visible as any} />
      <PaginationBar
        basePath="/beneficiaries" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
      />
    </div>
  );
}
