"use client";
import { useState, useTransition } from "react";
import { recordScreening } from "@/modules/screening/actions";
import { isScreeningOverdue, screeningStatusLabel } from "@/lib/screening/due-date";
import type { AppLocale } from "@/lib/preferences";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const LIST_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    un_consolidated_list:"القائمة الموحّدة للأمم المتحدة", ofac_sdn:"OFAC SDN (أمريكية)",
    eu_sanctions_list:"قائمة عقوبات الاتحاد الأوروبي", uk_hmt_list:"قائمة HMT البريطانية",
    national_list:"قائمة وطنية", other:"مصدر آخر",
  },
  en: {
    un_consolidated_list:"UN Consolidated List", ofac_sdn:"OFAC SDN (US)",
    eu_sanctions_list:"EU sanctions list", uk_hmt_list:"UK HMT list",
    national_list:"National list", other:"Other source",
  },
};
const RESULT_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { clear:"لا يوجد تطابق", potential_match:"تطابق محتمل", confirmed_match:"تطابق مؤكد", pending_review:"قيد المراجعة" },
  en: { clear:"No match", potential_match:"Potential match", confirmed_match:"Confirmed match", pending_review:"Pending review" },
};
const STATUS_STYLE: Record<string,string> = {
  not_screened:"bg-[#1F2937] text-[#9CA3AF]", overdue:"bg-[#271E0A] text-[#EF9F27]",
  clear:"bg-[#001A12] text-[#1D9E75]", flagged:"bg-[#271E0A] text-[#EF9F27]", blocked:"bg-[#2A1215] text-[#E24B4A]",
};
const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    not_screened:"لم يُفحَص بعد", overdue:"يستحق إعادة الفحص", clear:"مُصرَّح — لا تطابق",
    flagged:"محل تحفّظ", blocked:"محظور — تطابق مؤكد",
  },
  en: {
    not_screened:"Not screened yet", overdue:"Re-screening due", clear:"Cleared — no match",
    flagged:"Flagged", blocked:"Blocked — confirmed match",
  },
};

export default function ScreeningPanel({ entityType, entityId, entityName, organizationId, userId, history, locale = "ar" }: {
  entityType: "partner"|"vendor"|"beneficiary"|"employee"; entityId: string; entityName: string;
  organizationId: string; userId: string; history: any[]; locale?: AppLocale;
}) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ screenedAgainst:"un_consolidated_list", result:"clear", referenceNumber:"", screeningNotes:"" });

  const isAr = locale === "ar";
  const listLabel = LIST_LABEL[locale] ?? LIST_LABEL.ar;
  const resultLabel = RESULT_LABEL[locale] ?? RESULT_LABEL.ar;
  const statusLabel = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const dateTag = isAr ? "ar" : "en-US";
  const t = isAr ? {
    title:"الفحص المسبق (Anti-Terrorism Screening)",
    addNew:"+ تسجيل فحص جديد",
    referencePlaceholder:"رقم مرجعي (لقطة شاشة/أرشيف خارجي)",
    notesPlaceholder:"ملاحظات...",
    save:"حفظ سجل الفحص",
    empty:"لا توجد سجلات فحص بعد",
    footnote:"* هذا توثيق لفحص يدوي تمّ خارج النظام. لا يوجد اتصال تلقائي بقاعدة بيانات عقوبات حية.",
  } : {
    title:"Anti-Terrorism Screening",
    addNew:"+ Record new screening",
    referencePlaceholder:"Reference number (screenshot / external archive)",
    notesPlaceholder:"Notes...",
    save:"Save screening record",
    empty:"No screening records yet",
    footnote:"* This documents a manual screening performed outside the system. There is no automatic connection to a live sanctions database.",
  };

  const latest = history[0];
  const overdue = latest ? isScreeningOverdue(latest.nextScreeningDue ? new Date(latest.nextScreeningDue) : null) : false;
  const status = screeningStatusLabel(!!latest, latest?.result ?? null, overdue);

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await recordScreening({
        organizationId, entityType, entityId, entityNameSnapshot: entityName,
        screenedAgainst: form.screenedAgainst as any, result: form.result as any,
        referenceNumber: form.referenceNumber || undefined, screeningNotes: form.screeningNotes || undefined,
      }, userId);
      if (res.success) { setShowForm(false); setForm({ screenedAgainst:"un_consolidated_list", result:"clear", referenceNumber:"", screeningNotes:"" }); }
      else setError(res.error);
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><i className="ti ti-shield-check text-[#0F6E56]"/>{t.title}</h2>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[status]}`}>{statusLabel[status]}</span>
      </div>

      {error && <p className="text-[12px] text-[#E24B4A]">{error}</p>}

      <button onClick={()=>setShowForm(s=>!s)} className="text-[12px] text-[#0F6E56] hover:text-[#1D9E75]">{t.addNew}</button>

      {showForm && (
        <form onSubmit={submit} className="space-y-2 pt-2 border-t border-[#1F2937]">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.screenedAgainst} onChange={e=>setForm(p=>({...p,screenedAgainst:e.target.value}))} className={inputCls+" cursor-pointer"}>
              {Object.entries(listLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.result} onChange={e=>setForm(p=>({...p,result:e.target.value}))} className={inputCls+" cursor-pointer"}>
              {Object.entries(resultLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <input placeholder={t.referencePlaceholder} value={form.referenceNumber} onChange={e=>setForm(p=>({...p,referenceNumber:e.target.value}))} className={inputCls} dir="ltr"/>
          <textarea placeholder={t.notesPlaceholder} value={form.screeningNotes} onChange={e=>setForm(p=>({...p,screeningNotes:e.target.value}))} className={inputCls+" resize-none"} rows={2}/>
          <button type="submit" disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.save}</button>
        </form>
      )}

      <div className="space-y-1.5 pt-2">
        {history.map((h:any) => (
          <div key={h.id} className="flex items-center justify-between text-[12px] py-1.5 border-b border-[#1F2937] last:border-none">
            <span className="text-[#9CA3AF]">{listLabel[h.screenedAgainst]} — {new Date(h.screeningDate).toLocaleDateString(dateTag)}</span>
            <span className={h.result==="confirmed_match"?"text-[#E24B4A]":h.result==="potential_match"?"text-[#EF9F27]":"text-[#1D9E75]"}>{resultLabel[h.result]}</span>
          </div>
        ))}
        {history.length === 0 && <p className="text-[12px] text-[#6B7280]">{t.empty}</p>}
      </div>

      <p className="text-[10px] text-[#4B5563] pt-1">
        {t.footnote}
      </p>
    </div>
  );
}
