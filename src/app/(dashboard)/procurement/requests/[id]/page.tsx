// صفحة تفاصيل طلب الشراء — مع مصفوفة التواقيع + الطوارئ + تحذير الميزانية
import { auth }     from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { db }       from "@/db";
import { purchaseRequests, purchaseRequestItems, grantBudgetLines, attachments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import StatusBar     from "@/components/shared/StatusBar";
import ChatterBox    from "@/components/shared/ChatterBox";
import ApprovalPanel from "@/modules/approvals/components/ApprovalPanel";
import BudgetWarningBar from "@/modules/grants/components/BudgetWarningBar";
import { EmergencyBadge, EmergencyToggle } from "@/modules/procurement/components/EmergencyBadge";
import { getRequiredApprovers, getApprovalStatus } from "@/lib/approval/matrix";
import ExportButton from "@/components/shared/ExportButton";
import AttachmentsPanel from "@/components/shared/AttachmentsPanel";

const STATES = ["draft","submitted","approved","done"];

export default async function PRDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session?.user) notFound();
  const orgId   = session.user.organizationId;
  const userId  = session.user.id;
  const role    = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "procurement", role);
  if (!canView(__perm)) redirect("/");

  const prAttachments = await db.query.attachments.findMany({ where: and(eq(attachments.tableName,"purchase_requests"), eq(attachments.recordId, params.id)) });

  const pr = await db.query.purchaseRequests.findFirst({
    where: eq(purchaseRequests.id, params.id),
    with: { items: true },
  });
  if (!pr || pr.organizationId !== orgId) notFound();

  const totalAmount = pr.items.reduce((s:number, i:any) =>
    s + Number(i.estimatedUnitPrice) * Number(i.quantity), 0);

  // جلب مستويات الموافقة المطلوبة
  const approversRes = await getRequiredApprovers(orgId, "procurement", totalAmount);
  const statusRes    = await getApprovalStatus(
    "purchase_request", pr.id, orgId, "procurement", totalAmount
  );

  // بناء levels للعرض
  const levels = approversRes.success
    ? approversRes.data.levels.map(l => {
        const completed = statusRes.success && statusRes.data.completedLevels.includes(l.level);
        const rejected  = statusRes.success && !!statusRes.data.rejectedBy;
        const current   = !completed && !rejected &&
          statusRes.success && statusRes.data.currentLevel === l.level;
        return {
          level:     l.level,
          levelName: l.levelName,
          ruleId:    l.ruleId,
          status:    (completed ? "completed" : rejected ? "rejected" : current ? "current" : "pending") as "completed"|"rejected"|"current"|"pending",
        };
      })
    : [];

  // بيانات ميزانية البند (إذا وُجدت)
  const budgetLine = pr.budgetLineId
    ? await db.query.grantBudgetLines.findFirst({ where: eq(grantBudgetLines.id, pr.budgetLineId) })
    : null;

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
              {pr.code}
            </span>
            {pr.isEmergency && <EmergencyBadge reviewDue={pr.emergencyReviewDue?.toISOString()} />}
          </div>
          <h1 className="text-xl font-semibold text-white">{pr.title}</h1>
          {pr.justification && <p className="text-sm text-[#6B7280] mt-1">{pr.justification}</p>}
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            apiPath={`/api/export/pr/${pr.id}`}
            filename={`PR-${pr.code}`}
            formats={["pdf"]}
          />
        </div>
        <div className="text-left">
          <p className="text-2xl font-bold tabular-nums text-white">{fmt(totalAmount)}</p>
          <p className="text-xs text-[#4B5563] mt-0.5">USD — القيمة التقديرية</p>
        </div>
      </div>

      {/* شريط الحالة */}
      <StatusBar states={STATES} current={pr.status} />

      {/* الشبكة الرئيسية */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* العمود الرئيسي */}
        <div className="lg:col-span-2 space-y-5">

          {/* تحذير ميزانية */}
          {budgetLine && (
            <BudgetWarningBar
              lineName={budgetLine.nameAr ?? budgetLine.name}
              plannedAmount={Number(budgetLine.plannedAmount)}
              spentAmount={Number(budgetLine.spentAmount)}
              committedAmount={Number(budgetLine.committedAmount ?? 0)}
              warningThreshold={budgetLine.warningThreshold ?? 80}
              blockThreshold={budgetLine.blockThreshold ?? 100}
            />
          )}

          {/* بنود الطلب */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1F2937] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <i className="ti ti-list-details text-[#0F6E56]" />بنود الطلب
              </h2>
              <span className="text-xs text-[#4B5563]">{pr.items.length} بند</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1F2937] bg-[#161B26]">
                  {["الصنف","الكمية","الوحدة","السعر التقديري","الإجمالي"].map(h => (
                    <th key={h} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pr.items.map((item:any) => (
                  <tr key={item.id} className="border-b border-[#1F2937] last:border-0 hover:bg-[#161B26] transition-colors">
                    <td className="px-4 py-3 text-[#D1D5DB]">{item.description}</td>
                    <td className="px-4 py-3 tabular-nums text-[#9CA3AF]">{item.quantity}</td>
                    <td className="px-4 py-3 text-[#4B5563] text-xs">{item.unit}</td>
                    <td className="px-4 py-3 tabular-nums text-[#9CA3AF]">{fmt(Number(item.estimatedUnitPrice))}</td>
                    <td className="px-4 py-3 tabular-nums font-medium text-[#D1D5DB]">
                      {fmt(Number(item.quantity) * Number(item.estimatedUnitPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#2D3748] bg-[#161B26]">
                  <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-[#9CA3AF]">الإجمالي</td>
                  <td className="px-4 py-3 text-sm font-bold tabular-nums text-white">{fmt(totalAmount)} USD</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* مسار الطوارئ */}
          {(role === "admin" || role === "procurement_officer") && (
            <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <i className="ti ti-alert-triangle text-[#EF9F27]" />مسار الشراء الطارئ
              </h2>
              <EmergencyToggle
                prId={pr.id} organizationId={orgId} authorizedBy={userId}
                isEmergency={pr.isEmergency ?? false}
                reviewDue={pr.emergencyReviewDue?.toISOString()}
                reason={pr.emergencyReason}
              />
            </div>
          )}

          {/* المرفقات */}
          <AttachmentsPanel
            recordType="purchase_request"
            recordId={pr.id}
            initial={prAttachments.map(a => ({ id:a.id, fileName:a.fileName, fileSize:a.fileSize??0, mimeType:a.mimeType??"", url:a.fileUrl??"" }))}
          />

          {/* ChatterBox */}
          <ChatterBox tableName="purchase_requests" recordId={pr.id} organizationId={orgId} userId={userId} />
        </div>

        {/* العمود الجانبي */}
        <div className="space-y-5">
          {/* مصفوفة التواقيع */}
          {levels.length > 0 ? (
            <ApprovalPanel
              recordType="purchase_request"
              recordId={pr.id}
              organizationId={orgId}
              userId={userId}
              levels={levels}
              amount={totalAmount}
              revalidatePath={`/procurement/requests/${pr.id}`}
            />
          ) : (
            <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
              <p className="text-sm text-[#4B5563] text-center py-4">
                <i className="ti ti-shield-off text-[#2D3748] text-2xl block mb-2" />
                لا توجد قواعد موافقة معرَّفة لهذا المبلغ.
                <br/>
                <span className="text-xs">يرجى إعداد مصفوفة التواقيع من الإعدادات</span>
              </p>
            </div>
          )}

          {/* ملخص سريع */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <i className="ti ti-info-circle text-[#0F6E56]" />معلومات الطلب
            </h2>
            {[
              { label:"رقم الطلب",     value: pr.code },
              { label:"الأولوية",      value: pr.priority },
              { label:"تاريخ الإنشاء", value: new Date(pr.createdAt).toLocaleDateString("ar") },
              { label:"المبلغ الإجمالي",value: `${fmt(totalAmount)} USD` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-1 border-b border-[#1F2937] last:border-0">
                <span className="text-xs text-[#4B5563]">{label}</span>
                <span className="text-xs font-medium text-[#D1D5DB]">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
