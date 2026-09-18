import { auth } from "@/auth";
import { db } from "@/db";
import { complaints } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { isOverdue } from "@/lib/cfm/sla";
import CFMListView from "@/modules/cfm/components/CFMListView";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function CFMPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) redirect("/login");
  const orgId = session.user.organizationId;
  const perm = await getUserPermission(session.user.id, orgId, "cfm", session.user.role);
  if (!canView(perm)) redirect("/");

  const canSeeSensitive = perm === "admin";

  // إصلاح (v34-تتمة-3، بند مفتوح موثّق بـSECURITY_NOTES.md § v32): كانت
  // هذه الصفحة تجلب كل شكاوى المنظمة كاملة بلا حد أقصى — عدد الشكاوى ينمو
  // بلا توقف مع الوقت. الإحصائيات (مفتوحة/متجاوزة/حساسة) تحتاج فعلياً كل
  // السجلات لدقتها، فبدل جلب السجل الكامل (وصف، بيانات مشتكٍ...) لكل
  // الشكاوى فقط لحساب إحصائية، نجلب أعمدة خفيفة فقط لهذا الغرض، ونُرجّع
  // للـpagination الموحّد لقائمة العرض الفعلية.
  const where = and(eq(complaints.organizationId, orgId), eq(complaints.isArchived, false));
  const { limit, offset, page } = parsePagination(searchParams);

  const [statsRows, pageComplaints, totalRow] = await Promise.all([
    db.query.complaints.findMany({
      where,
      columns: { dueDate: true, complaintStatus: true, sensitivity: true },
    }),
    db.query.complaints.findMany({
      where,
      orderBy: [desc(complaints.receivedDate)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(complaints).where(where),
  ]);

  // إخفاء تفاصيل الشكاوى الحساسة عن غير المخوَّلين — تُعرَض كسجل مقيَّد الوصول فقط
  const hasNextPage = pageComplaints.length > limit;
  const visible = (hasNextPage ? pageComplaints.slice(0, limit) : pageComplaints).map(c => {
    if (c.sensitivity === "sensitive" && !canSeeSensitive) {
      return { ...c, description: "", complainantName: null, complainantPhone: null, restricted: true };
    }
    return { ...c, restricted: false };
  });

  const totalCount = Number(totalRow[0]?.c ?? 0);
  const overdueCount = statsRows.filter(c => isOverdue(c.dueDate, c.complaintStatus)).length;
  const openCount = statsRows.filter(c => !["resolved","closed"].includes(c.complaintStatus)).length;
  const sensitiveCount = statsRows.filter(c => c.sensitivity === "sensitive").length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-message-report text-[#0F6E56]" />آلية الشكاوى والتغذية الراجعة
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Complaint & Feedback Mechanism — {totalCount} شكوى</p>
        </div>
        <a href="/cfm/new" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-4 py-2">
          <i className="ti ti-plus" />تسجيل شكوى جديدة
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#6B7280] text-[12px] mb-1"><i className="ti ti-folder-open"/>شكاوى مفتوحة</div>
          <div className="text-xl font-semibold text-white">{openCount}</div>
        </div>
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#E24B4A] text-[12px] mb-1"><i className="ti ti-clock-exclamation"/>متجاوزة المهلة</div>
          <div className="text-xl font-semibold text-white">{overdueCount}</div>
        </div>
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
          <div className="flex items-center gap-2 text-[#EF9F27] text-[12px] mb-1"><i className="ti ti-shield-lock"/>شكاوى حساسة</div>
          <div className="text-xl font-semibold text-white">{sensitiveCount}</div>
        </div>
      </div>

      <CFMListView complaints={visible as any} />
      <PaginationBar
        basePath="/cfm" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
      />
    </div>
  );
}
