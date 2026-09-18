import { db }  from "@/db";
import { purchaseRequests, approvalDecisions, approvalRules } from "@/db/schema";
import { eq, and, not, inArray } from "drizzle-orm";
import Link    from "next/link";

export default async function PendingApprovals({ organizationId, userId }: { organizationId:string; userId:string }) {
  // طلبات مقدمة لم تُكتمل بعد
  const submitted = await db.query.purchaseRequests.findMany({
    where: and(
      eq(purchaseRequests.organizationId, organizationId),
      eq(purchaseRequests.status, "submitted"),
      eq(purchaseRequests.isArchived, false),
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 5,
  });

  // جلب القرارات السابقة لكل طلب
  const decisionMap: Record<string, string[]> = {};
  for (const pr of submitted) {
    const decisions = await db.query.approvalDecisions.findMany({
      where: and(
        eq(approvalDecisions.recordId,   pr.id),
        eq(approvalDecisions.recordType, "purchase_request"),
      ),
    });
    decisionMap[pr.id] = decisions.map(d => d.approvalLevel.toString());
  }

  if (submitted.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 text-center">
      <i className="ti ti-checks text-[#2D3748] text-[32px]" />
      <p className="text-sm text-[#4B5563] mt-2">لا موافقات معلقة</p>
    </div>
  );

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-clock-check text-[#EF9F27]" />
          موافقات معلقة
          <span className="text-[11px] bg-[#1A1400] text-[#EF9F27] border border-[#3D2E00] px-2 py-0.5 rounded-full">{submitted.length}</span>
        </h2>
        <Link href="/procurement" className="text-xs text-[#0F6E56] hover:text-[#1D9E75]">عرض الكل</Link>
      </div>
      <div className="divide-y divide-[#1F2937]">
        {submitted.map(pr => (
          <Link key={pr.id} href={`/procurement/requests/${pr.id}`}
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#161B26] transition-colors">
            <div className="w-8 h-8 rounded-lg bg-[#1A1400] border border-[#3D2E00] flex items-center justify-center shrink-0">
              <i className="ti ti-clock text-[13px] text-[#EF9F27]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#D1D5DB] truncate">{pr.title}</p>
              <p className="text-[10px] text-[#4B5563] mt-0.5">{pr.code}</p>
            </div>
            <div className="text-left shrink-0">
              <p className="text-[10px] text-[#EF9F27]">L{(decisionMap[pr.id]?.length ?? 0) + 1}</p>
              <p className="text-[10px] text-[#4B5563]">{new Date(pr.createdAt).toLocaleDateString("ar")}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
