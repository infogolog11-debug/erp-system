"use client";
import { useState, useTransition } from "react";
import { updateComplaintStatus, assignComplaint, addComplaintUpdate, recordSatisfactionRating } from "@/modules/cfm/actions";
import { isOverdue, daysOpen } from "@/lib/cfm/sla";
import type { AppLocale } from "@/lib/preferences";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    received:"مستلَمة", under_review:"قيد المراجعة", investigating:"قيد التحقيق",
    resolved:"محلولة", closed:"مغلقة", escalated:"مُصعَّدة",
  },
  en: {
    received:"Received", under_review:"Under review", investigating:"Investigating",
    resolved:"Resolved", closed:"Closed", escalated:"Escalated",
  },
};
const CATEGORY_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    service_quality:"جودة الخدمة", staff_conduct:"سلوك الموظفين", corruption_fraud:"فساد/احتيال",
    sgbv_protection:"حماية/عنف قائم على النوع", distribution_issue:"مشكلة توزيع",
    eligibility_targeting:"استهداف/أهلية", data_privacy:"خصوصية البيانات", suggestion:"اقتراح", other:"أخرى",
  },
  en: {
    service_quality:"Service quality", staff_conduct:"Staff conduct", corruption_fraud:"Corruption / fraud",
    sgbv_protection:"Protection / GBV", distribution_issue:"Distribution issue",
    eligibility_targeting:"Eligibility / targeting", data_privacy:"Data privacy", suggestion:"Suggestion", other:"Other",
  },
};

export default function CFMDetailView({ complaint, orgUsers, userId, organizationId, locale = "ar" }: { complaint:any; orgUsers:any[]; userId:string; organizationId:string; locale?: AppLocale }) {
  const [isPending, startTransition] = useTransition();
  const [updateDraft, setUpdateDraft] = useState("");
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const overdue = isOverdue(complaint.dueDate ? new Date(complaint.dueDate) : null, complaint.complaintStatus);
  const open = daysOpen(new Date(complaint.receivedDate), complaint.resolvedDate ? new Date(complaint.resolvedDate) : null);

  const isAr = locale === "ar";
  const statusLabel = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const categoryLabel = CATEGORY_LABEL[locale] ?? CATEGORY_LABEL.ar;
  const dateTag = isAr ? "ar" : "en-US";
  const t = isAr ? {
    sensitive:"حساسة",
    anonymous:"مقدَّمة بشكل مجهول",
    openFor:(n:number)=>`مفتوحة منذ ${n} يوم`,
    overdue:"— متجاوزة المهلة",
    resolvePlaceholder:"ملخص الحل...",
    markResolved:"وضع علامة محلولة",
    closeWithout:"إغلاق بدون حل",
    details:"تفاصيل الشكوى",
    resolutionSummary:"ملخص الحل",
    assignment:"التكليف",
    unassigned:"غير مُكلَّف",
    updates:(n:number)=>`التحديثات (${n})`,
    addUpdatePlaceholder:"إضافة تحديث...",
    add:"إضافة",
    satisfaction:"تقييم رضا مقدّم الشكوى",
  } : {
    sensitive:"Sensitive",
    anonymous:"Submitted anonymously",
    openFor:(n:number)=>`Open for ${n} day(s)`,
    overdue:"— Overdue",
    resolvePlaceholder:"Resolution summary...",
    markResolved:"Mark as resolved",
    closeWithout:"Close without resolution",
    details:"Complaint details",
    resolutionSummary:"Resolution summary",
    assignment:"Assignment",
    unassigned:"Unassigned",
    updates:(n:number)=>`Updates (${n})`,
    addUpdatePlaceholder:"Add update...",
    add:"Add",
    satisfaction:"Complainant satisfaction rating",
  };

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
          {complaint.sensitivity === "sensitive" && <span className="text-[11px] text-[#EF9F27] mr-2"><i className="ti ti-shield-lock"/> {t.sensitive}</span>}
          <h1 className="text-lg font-semibold text-white mt-1.5">{categoryLabel[complaint.category]}</h1>
          <p className="text-[13px] text-[#6B7280] mt-1">
            {complaint.isAnonymous ? t.anonymous : (complaint.complainantName || "—")} · {t.openFor(open)}
            {overdue && <span className="text-[#E24B4A] mr-1.5">{t.overdue}</span>}
          </p>
        </div>
        <select value={complaint.complaintStatus} onChange={e=>changeStatus(e.target.value)} disabled={isPending} className={inputCls+" cursor-pointer w-auto"}>
          {Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {showResolveForm && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <textarea value={resolutionDraft} onChange={e=>setResolutionDraft(e.target.value)} placeholder={t.resolvePlaceholder} className={inputCls+" resize-none"} rows={3}/>
          <div className="flex gap-2">
            <button onClick={()=>submitResolve("resolved")} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.markResolved}</button>
            <button onClick={()=>submitResolve("closed")} className="text-[13px] font-medium text-[#9CA3AF] border border-[#2D3748] rounded-lg px-4 py-2">{t.closeWithout}</button>
          </div>
        </div>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white mb-2">{t.details}</h2>
        <p className="text-[13px] text-[#D1D5DB]">{complaint.description}</p>
        {complaint.resolutionSummary && (
          <div className="mt-3 pt-3 border-t border-[#1F2937]">
            <p className="text-[12px] text-[#6B7280] mb-1">{t.resolutionSummary}</p>
            <p className="text-[13px] text-[#1D9E75]">{complaint.resolutionSummary}</p>
          </div>
        )}
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">{t.assignment}</h2>
        <select value={complaint.assignedTo ?? ""} onChange={e=>onAssign(e.target.value)} className={inputCls+" cursor-pointer"} disabled={isPending}>
          <option value="">{t.unassigned}</option>
          {orgUsers.map((u:any)=><option key={u.id} value={u.id}>{isAr ? (u.firstNameAr || u.firstName) : (u.firstName || u.firstNameAr)} {isAr ? (u.lastNameAr || u.lastName) : (u.lastName || u.lastNameAr)}</option>)}
        </select>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">{t.updates(complaint.updates.length)}</h2>
        {complaint.updates.map((u:any) => (
          <p key={u.id} className="text-[13px] text-[#9CA3AF]">— {u.update} <span className="text-[11px] text-[#4B5563]">({new Date(u.createdAt).toLocaleDateString(dateTag)})</span></p>
        ))}
        <div className="flex gap-2">
          <input value={updateDraft} onChange={e=>setUpdateDraft(e.target.value)} placeholder={t.addUpdatePlaceholder} className={inputCls}/>
          <button onClick={submitUpdate} disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2 shrink-0">{t.add}</button>
        </div>
      </div>

      {(complaint.complaintStatus === "resolved" || complaint.complaintStatus === "closed") && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-2">
          <h2 className="text-sm font-semibold text-white">{t.satisfaction}</h2>
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
