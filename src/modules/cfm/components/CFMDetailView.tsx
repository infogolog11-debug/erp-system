"use client";
import { useState, useTransition } from "react";
import { updateComplaintStatus, assignComplaint, addComplaintUpdate, recordSatisfactionRating } from "@/modules/cfm/actions";
import { isOverdue, daysOpen } from "@/lib/cfm/sla";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const STATUS_LABEL: Record<string,string> = {
  received:"مستلَمة", under_review:"قيد المراجعة", investigating:"قيد التحقيق",
  resolved:"محلولة", closed:"مغلقة", escalated:"مُصعَّدة",
};
const CATEGORY_LABEL: Record<string,string> = {
  service_quality:"جودة الخدمة", staff_conduct:"سلوك الموظفين", corruption_fraud:"فساد/احتيال",
  sgbv_protection:"حماية/عنف قائم على النوع", distribution_issue:"مشكلة توزيع",
  eligibility_targeting:"استهداف/أهلية", data_privacy:"خصوصية البيانات", suggestion:"اقتراح", other:"أخرى",
};

export default function CFMDetailView({ complaint, orgUsers, userId, organizationId }: { complaint:any; orgUsers:any[]; userId:string; organizationId:string }) {
  const [isPending, startTransition] = useTransition();
  const [updateDraft, setUpdateDraft] = useState("");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const overdue = isOverdue(complaint.dueDate ? new Date(complaint.dueDate) : null, complaint.complaintStatus);
  const open = daysOpen(new Date(complaint.receivedDate), complaint.resolvedDate ? new Date(complaint.resolvedDate) : null);

  function changeStatus(status: string) {
    if (status === "resolved" || status === "closed") { setShowResolveForm(true); return; }
    startTransition(async () => { await updateComplaintStatus(complaint.id, organizationId, userId, status as any); });
  }
  function submitResolve(status: "resolved"|"closed") {
    startTransition(async () => { await updateComplaintStatus(complaint.id, organizationId, userId, status, resolutionDraft); setShowResolveForm(false); });
  }
  function onAssign(assigneeId: string) {
    startTransition(async () => { await assignComplaint(complaint.id, assigneeId, organizationId, userId); });
  }
  function submitUpdate() {
    if (!updateDraft.trim()) return;
    startTransition(async () => { await addComplaintUpdate(complaint.id, organizationId, updateDraft, userId); setUpdateDraft(""); });
  }
  function rate(n: number) {
    startTransition(async () => { await recordSatisfactionRating(complaint.id, organizationId, n, userId); });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{complaint.code}</span>
          {complaint.sensitivity === "sensitive" && <span className="text-[11px] text-[#EF9F27] mr-2"><i className="ti ti-shield-lock"/> حساسة</span>}
          <h1 className="text-lg font-semibold text-white mt-1.5">{CATEGORY_LABEL[complaint.category]}</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {complaint.isAnonymous ? "مقدَّمة بشكل مجهول" : (complaint.complainantName || "—")} · مفتوحة منذ {open} يوم
            {overdue && <span className="text-[#E24B4A] mr-1.5">— متجاوزة المهلة</span>}
          </p>
        </div>
        <select value={complaint.complaintStatus} onChange={e=>changeStatus(e.target.value)} disabled={isPending} className={inputCls+" cursor-pointer w-auto"}>
          {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {showResolveForm && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <textarea value={resolutionDraft} onChange={e=>setResolutionDraft(e.target.value)} placeholder="ملخص الحل..." className={inputCls+" resize-none"} rows={3}/>
          <div className="flex gap-2">
            <button onClick={()=>submitResolve("resolved")} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">وضع علامة محلولة</button>
            <button onClick={()=>submitResolve("closed")} className="text-[13px] font-medium text-[#9CA3AF] border border-[#2D3748] rounded-lg px-4 py-2">إغلاق بدون حل</button>
          </div>
        </div>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">تفاصيل الشكوى</h2>
        <p className="text-[13px] text-[#D1D5DB]">{complaint.description}</p>
        {complaint.resolutionSummary && (
          <div className="mt-3 pt-3 border-t border-[#1F2937]">
            <p className="text-[12px] text-[#6B7280] mb-1">ملخص الحل</p>
            <p className="text-[13px] text-[#1D9E75]">{complaint.resolutionSummary}</p>
          </div>
        )}
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">التكليف</h2>
        <select value={complaint.assignedTo ?? ""} onChange={e=>onAssign(e.target.value)} className={inputCls+" cursor-pointer"} disabled={isPending}>
          <option value="">غير مُكلَّف</option>
          {orgUsers.map((u:any)=><option key={u.id} value={u.id}>{u.firstNameAr || u.firstName} {u.lastNameAr || u.lastName}</option>)}
        </select>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">التحديثات ({complaint.updates.length})</h2>
        {complaint.updates.map((u:any) => (
          <p key={u.id} className="text-[13px] text-[#9CA3AF]">— {u.update} <span className="text-[11px] text-[#4B5563]">({new Date(u.createdAt).toLocaleDateString("ar")})</span></p>
        ))}
        <div className="flex gap-2">
          <input value={updateDraft} onChange={e=>setUpdateDraft(e.target.value)} placeholder="إضافة تحديث..." className={inputCls}/>
          <button onClick={submitUpdate} disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2 shrink-0">إضافة</button>
        </div>
      </div>

      {(complaint.complaintStatus === "resolved" || complaint.complaintStatus === "closed") && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-white">تقييم رضا مقدّم الشكوى</h2>
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={()=>rate(n)} className={`text-2xl ${complaint.satisfactionRating >= n ? "text-[#EF9F27]" : "text-[#2D3748]"}`}>★</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
