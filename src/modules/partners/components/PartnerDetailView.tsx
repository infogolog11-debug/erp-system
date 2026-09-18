"use client";
import { useState, useTransition } from "react";
import {
  updateDueDiligence, createSubGrant, signAgreement, activateSubGrant,
  createDisbursement, submitPartnerReport, reviewPartnerReport,
} from "@/modules/partners/actions";
import ScreeningPanel from "@/modules/screening/components/ScreeningPanel";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const DD_STYLE: Record<string,string> = {
  pending:"bg-[#271E0A] text-[#EF9F27]", cleared:"bg-[#001A12] text-[#1D9E75]",
  flagged:"bg-[#2A1215] text-[#E24B4A]", rejected:"bg-[#2A1215] text-[#E24B4A]",
};
const DD_LABEL: Record<string,string> = { pending:"قيد الفحص", cleared:"تمت الموافقة", flagged:"محل تحفظ", rejected:"مرفوض" };
const SG_STATUS_LABEL: Record<string,string> = { draft:"مسودة", active:"نشطة", completed:"مكتملة", terminated:"مُنهاة", suspended:"معلّقة" };
const SG_STATUS_STYLE: Record<string,string> = {
  draft:"bg-[#1F2937] text-[#9CA3AF]", active:"bg-[#001A12] text-[#1D9E75]",
  completed:"bg-[#0B1A2A] text-[#378ADD]", terminated:"bg-[#2A1215] text-[#E24B4A]", suspended:"bg-[#271E0A] text-[#EF9F27]",
};

export default function PartnerDetailView({ partner, orgGrants, orgCurrencies, screeningHistory, userId, organizationId }: {
  partner: any; orgGrants: any[]; orgCurrencies: any[]; screeningHistory: any[]; userId: string; organizationId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [showSubGrantForm, setShowSubGrantForm] = useState(false);
  const [expandedSubGrant, setExpandedSubGrant] = useState<string|null>(null);

  function setDD(status: "cleared"|"flagged"|"rejected") {
    startTransition(async () => { await updateDueDiligence(partner.id, organizationId, userId, status); });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{partner.code}</span>
          <h1 className="text-xl font-semibold text-white mt-1.5">{partner.nameAr || partner.name}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{partner.country ?? "—"} · {partner.contactPerson ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${DD_STYLE[partner.dueDiligenceStatus]}`}>{DD_LABEL[partner.dueDiligenceStatus]}</span>
          {partner.dueDiligenceStatus !== "cleared" && <button onClick={()=>setDD("cleared")} disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3 py-1.5">اعتماد</button>}
          {partner.dueDiligenceStatus !== "flagged" && <button onClick={()=>setDD("flagged")} disabled={isPending} className="text-[12px] font-medium text-[#EF9F27] border border-[#4A3510] hover:bg-[#271E0A] rounded-lg px-3 py-1.5">تحفّظ</button>}
          {partner.dueDiligenceStatus !== "rejected" && <button onClick={()=>setDD("rejected")} disabled={isPending} className="text-[12px] font-medium text-[#E24B4A] border border-[#4A1C20] hover:bg-[#2A1215] rounded-lg px-3 py-1.5">رفض</button>}
        </div>
      </div>

      {partner.capacityAssessmentScore != null && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 flex items-center justify-between">
          <span className="text-[13px] text-[#9CA3AF]">درجة تقييم القدرات المؤسسية</span>
          <span className="text-[15px] font-semibold text-white">{partner.capacityAssessmentScore}/100</span>
        </div>
      )}

      <ScreeningPanel
        entityType="partner" entityId={partner.id} entityName={partner.nameAr || partner.name}
        organizationId={organizationId} userId={userId} history={screeningHistory}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">المنح الفرعية ({partner.subGrants.length})</h2>
        <button onClick={()=>setShowSubGrantForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3.5 py-2 flex items-center gap-1.5">
          <i className="ti ti-plus"/>منحة فرعية جديدة
        </button>
      </div>

      {showSubGrantForm && (
        <SubGrantForm partnerId={partner.id} organizationId={organizationId} userId={userId} orgGrants={orgGrants} orgCurrencies={orgCurrencies} onDone={()=>setShowSubGrantForm(false)} />
      )}

      {partner.subGrants.length === 0 && <p className="text-[13px] text-[#6B7280] text-center py-8">لا توجد منح فرعية</p>}

      <div className="space-y-3">
        {partner.subGrants.map((sg:any) => (
          <SubGrantCard
            key={sg.id} sg={sg} partnerId={partner.id} organizationId={organizationId} userId={userId}
            expanded={expandedSubGrant === sg.id}
            onToggle={()=>setExpandedSubGrant(e => e===sg.id ? null : sg.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SubGrantForm({ partnerId, organizationId, userId, orgGrants, orgCurrencies, onDone }: any) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({ parentGrantId:"", currencyId: orgCurrencies[0]?.id ?? "", title:"", totalAmount:"", startDate:"", endDate:"", description:"" });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createSubGrant({
        organizationId, parentGrantId: form.parentGrantId, partnerId, currencyId: form.currencyId,
        title: form.title, totalAmount: Number(form.totalAmount),
        startDate: form.startDate, endDate: form.endDate, description: form.description || undefined,
      }, userId);
      if (res.success) { onDone(); }
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-lg px-3 py-2 text-[13px] text-[#E24B4A]">{error}</div>}
      <select value={form.parentGrantId} onChange={e=>setForm((p:any)=>({...p,parentGrantId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
        <option value="">اختر المنحة الرئيسية...</option>
        {orgGrants.map((g:any)=><option key={g.id} value={g.id}>{g.nameAr || g.name}</option>)}
      </select>
      <input value={form.title} onChange={e=>setForm((p:any)=>({...p,title:e.target.value}))} placeholder="عنوان المنحة الفرعية" className={inputCls} required/>
      <div className="grid grid-cols-3 gap-3">
        <input type="number" step="0.01" placeholder="المبلغ الإجمالي" value={form.totalAmount} onChange={e=>setForm((p:any)=>({...p,totalAmount:e.target.value}))} className={inputCls} dir="ltr" required/>
        <select value={form.currencyId} onChange={e=>setForm((p:any)=>({...p,currencyId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
          {orgCurrencies.map((c:any)=><option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" value={form.startDate} onChange={e=>setForm((p:any)=>({...p,startDate:e.target.value}))} className={inputCls} dir="ltr" required/>
        <input type="date" value={form.endDate} onChange={e=>setForm((p:any)=>({...p,endDate:e.target.value}))} className={inputCls} dir="ltr" required/>
      </div>
      <textarea value={form.description} onChange={e=>setForm((p:any)=>({...p,description:e.target.value}))} placeholder="وصف مختصر..." className={inputCls+" resize-none"} rows={2}/>
      <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-lg px-4 py-2">حفظ</button>
    </form>
  );
}

function SubGrantCard({ sg, partnerId, organizationId, userId, expanded, onToggle }: any) {
  const [isPending, startTransition] = useTransition();
  const [signDate, setSignDate] = useState("");
  const remaining = Number(sg.totalAmount) - Number(sg.disbursedAmount);
  const disbPct = Number(sg.totalAmount) > 0 ? (Number(sg.disbursedAmount)/Number(sg.totalAmount)*100) : 0;

  function doSign() {
    if (!signDate) return;
    startTransition(async () => { await signAgreement(sg.id, partnerId, organizationId, signDate, userId); });
  }
  function doActivate() {
    startTransition(async () => { await activateSubGrant(sg.id, partnerId, organizationId, userId); });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#161B26] transition-colors">
        <div className="flex items-center gap-3 text-right">
          <i className={`ti ti-chevron-${expanded?"down":"left"} text-[#6B7280] text-sm`}/>
          <div>
            <div className="text-[13px] font-medium text-white">{sg.title}</div>
            <div className="text-[11px] text-[#6B7280]">{sg.code} · {sg.parentGrant?.nameAr || sg.parentGrant?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#9CA3AF] tabular-nums">{Number(sg.disbursedAmount).toLocaleString()} / {Number(sg.totalAmount).toLocaleString()} {sg.currency?.code}</span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${SG_STATUS_STYLE[sg.subGrantStatus]}`}>{SG_STATUS_LABEL[sg.subGrantStatus]}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#1F2937] p-4 space-y-4 bg-[#0B0F17]">
          {sg.subGrantStatus === "draft" && (
            <div className="flex items-center gap-2 bg-[#111827] rounded-xl p-3">
              {!sg.agreementSignedDate ? (
                <>
                  <input type="date" value={signDate} onChange={e=>setSignDate(e.target.value)} className={inputCls+" flex-1"} dir="ltr"/>
                  <button onClick={doSign} disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] rounded-lg px-3 py-2 shrink-0">تسجيل توقيع الاتفاقية</button>
                </>
              ) : (
                <button onClick={doActivate} disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] rounded-lg px-3 py-2">تفعيل المنحة الفرعية</button>
              )}
            </div>
          )}

          <div className="h-2 bg-[#1F2937] rounded-full overflow-hidden">
            <div className="h-full bg-[#378ADD] rounded-full" style={{ width:`${Math.min(disbPct,100)}%` }}/>
          </div>
          <p className="text-[11px] text-[#6B7280]">مصروف مُبلَّغ من الشريك: {Number(sg.reportedSpentAmount).toLocaleString()} {sg.currency?.code} · المتبقي غير المصروف: {remaining.toLocaleString()}</p>

          <DisbursementSection sg={sg} partnerId={partnerId} organizationId={organizationId} userId={userId} />
          <ReportSection sg={sg} partnerId={partnerId} organizationId={organizationId} userId={userId} />
        </div>
      )}
    </div>
  );
}

function DisbursementSection({ sg, partnerId, organizationId, userId }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ amount:"", method:"bank_transfer", referenceNumber:"" });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createDisbursement({ organizationId, subGrantId: sg.id, amount: Number(form.amount), method: form.method, referenceNumber: form.referenceNumber || undefined }, partnerId, userId);
      if (res.success) { setShowForm(false); setForm({ amount:"", method:"bank_transfer", referenceNumber:"" }); }
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-[#9CA3AF]">الصرفيات ({sg.disbursements.length})</h3>
        <button onClick={()=>setShowForm(s=>!s)} className="text-[11px] text-[#0F6E56] hover:text-[#1D9E75]">+ صرفية جديدة</button>
      </div>
      {error && <p className="text-[11px] text-[#E24B4A]">{error}</p>}
      {showForm && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input type="number" step="0.01" placeholder="المبلغ" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className={inputCls} dir="ltr" required/>
          <select value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))} className={inputCls+" cursor-pointer"}>
            <option value="bank_transfer">تحويل بنكي</option><option value="cheque">شيك</option><option value="cash">نقدي</option>
          </select>
          <input placeholder="رقم مرجعي" value={form.referenceNumber} onChange={e=>setForm(p=>({...p,referenceNumber:e.target.value}))} className={inputCls} dir="ltr"/>
          <button type="submit" disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] rounded-lg px-3 py-2 shrink-0">حفظ</button>
        </form>
      )}
      {sg.disbursements.map((d:any) => (
        <div key={d.id} className="flex items-center justify-between text-[12px] text-[#9CA3AF] py-1">
          <span>{new Date(d.disbursementDate).toLocaleDateString("ar")} — {d.method}</span>
          <span className="tabular-nums text-[#D1D5DB]">{Number(d.amount).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function ReportSection({ sg, partnerId, organizationId, userId }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ periodStart:"", periodEnd:"", narrativeReport:"", financialReportAmount:"" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await submitPartnerReport({
        organizationId, subGrantId: sg.id, periodStart: form.periodStart, periodEnd: form.periodEnd,
        narrativeReport: form.narrativeReport || undefined,
        financialReportAmount: form.financialReportAmount ? Number(form.financialReportAmount) : undefined,
      }, partnerId, userId);
      setShowForm(false); setForm({ periodStart:"", periodEnd:"", narrativeReport:"", financialReportAmount:"" });
    });
  }
  function review(reportId: string, decision: "approved"|"needs_revision") {
    startTransition(async () => { await reviewPartnerReport(reportId, partnerId, organizationId, userId, decision); });
  }

  return (
    <div className="space-y-2 pt-2 border-t border-[#1F2937]">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-[#9CA3AF]">تقارير الشريك ({sg.reports.length})</h3>
        <button onClick={()=>setShowForm(s=>!s)} className="text-[11px] text-[#0F6E56] hover:text-[#1D9E75]">+ تقرير جديد</button>
      </div>
      {showForm && (
        <form onSubmit={submit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.periodStart} onChange={e=>setForm(p=>({...p,periodStart:e.target.value}))} className={inputCls} dir="ltr" required/>
            <input type="date" value={form.periodEnd} onChange={e=>setForm(p=>({...p,periodEnd:e.target.value}))} className={inputCls} dir="ltr" required/>
          </div>
          <textarea value={form.narrativeReport} onChange={e=>setForm(p=>({...p,narrativeReport:e.target.value}))} placeholder="التقرير السردي..." className={inputCls+" resize-none"} rows={2}/>
          <input type="number" step="0.01" placeholder="المبلغ المصروف المُبلَّغ عنه" value={form.financialReportAmount} onChange={e=>setForm(p=>({...p,financialReportAmount:e.target.value}))} className={inputCls} dir="ltr"/>
          <button type="submit" disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] rounded-lg px-3 py-2">إرسال التقرير</button>
        </form>
      )}
      {sg.reports.map((r:any) => (
        <div key={r.id} className="bg-[#111827] rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#9CA3AF]">{new Date(r.periodStart).toLocaleDateString("ar")} — {new Date(r.periodEnd).toLocaleDateString("ar")}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${r.reviewStatus==="approved"?"bg-[#001A12] text-[#1D9E75]":r.reviewStatus==="needs_revision"?"bg-[#2A1215] text-[#E24B4A]":"bg-[#271E0A] text-[#EF9F27]"}`}>
              {r.reviewStatus==="approved"?"مُعتمد":r.reviewStatus==="needs_revision"?"يحتاج تعديل":"قيد المراجعة"}
            </span>
          </div>
          {r.narrativeReport && <p className="text-[11px] text-[#D1D5DB]">{r.narrativeReport}</p>}
          {r.reviewStatus === "pending" && (
            <div className="flex gap-2 pt-1">
              <button onClick={()=>review(r.id,"approved")} className="text-[11px] text-[#1D9E75]">اعتماد</button>
              <button onClick={()=>review(r.id,"needs_revision")} className="text-[11px] text-[#E24B4A]">طلب تعديل</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
