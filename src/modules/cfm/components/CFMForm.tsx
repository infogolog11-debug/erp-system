"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createComplaint } from "@/modules/cfm/actions";
import type { AppLocale } from "@/lib/preferences";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] transition-all";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(<div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required&&<span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>);
}
const CHANNEL_OPTIONS: Record<AppLocale, {value:string;label:string}[]> = {
  ar: [
    {value:"hotline",label:"الخط الساخن"},{value:"in_person",label:"حضورياً"},{value:"sms",label:"رسالة نصية"},
    {value:"email",label:"بريد إلكتروني"},{value:"suggestion_box",label:"صندوق اقتراحات"},{value:"community_meeting",label:"اجتماع مجتمعي"},{value:"other",label:"أخرى"},
  ],
  en: [
    {value:"hotline",label:"Hotline"},{value:"in_person",label:"In person"},{value:"sms",label:"SMS"},
    {value:"email",label:"Email"},{value:"suggestion_box",label:"Suggestion box"},{value:"community_meeting",label:"Community meeting"},{value:"other",label:"Other"},
  ],
};
const CATEGORY_OPTIONS: Record<AppLocale, {value:string;label:string}[]> = {
  ar: [
    {value:"service_quality",label:"جودة الخدمة"},{value:"staff_conduct",label:"سلوك الموظفين"},
    {value:"corruption_fraud",label:"فساد/احتيال"},{value:"sgbv_protection",label:"حماية/عنف قائم على النوع"},
    {value:"distribution_issue",label:"مشكلة توزيع"},{value:"eligibility_targeting",label:"استهداف/أهلية"},
    {value:"data_privacy",label:"خصوصية البيانات"},{value:"suggestion",label:"اقتراح"},{value:"other",label:"أخرى"},
  ],
  en: [
    {value:"service_quality",label:"Service quality"},{value:"staff_conduct",label:"Staff conduct"},
    {value:"corruption_fraud",label:"Corruption / fraud"},{value:"sgbv_protection",label:"Protection / GBV"},
    {value:"distribution_issue",label:"Distribution issue"},{value:"eligibility_targeting",label:"Eligibility / targeting"},
    {value:"data_privacy",label:"Data privacy"},{value:"suggestion",label:"Suggestion"},{value:"other",label:"Other"},
  ],
};
const PRIORITY_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { low:"منخفضة", medium:"متوسطة", high:"عالية", critical:"حرجة" },
  en: { low:"Low", medium:"Medium", high:"High", critical:"Critical" },
};
const SENSITIVE = new Set(["corruption_fraud","sgbv_protection"]);

export default function CFMForm({ organizationId, userId, orgGrants, locale = "ar" }: { organizationId:string; userId:string; orgGrants:any[]; locale?: AppLocale }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    channel:"hotline", category:"service_quality", isAnonymous:false,
    complainantName:"", complainantPhone:"", grantId:"", description:"", priority:"medium",
  });
  const upd = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

  const isAr = locale === "ar";
  const channelOptions = CHANNEL_OPTIONS[locale] ?? CHANNEL_OPTIONS.ar;
  const categoryOptions = CATEGORY_OPTIONS[locale] ?? CATEGORY_OPTIONS.ar;
  const priorityLabel = PRIORITY_LABEL[locale] ?? PRIORITY_LABEL.ar;
  const t = isAr ? {
    channel:"القناة", category:"الفئة", anonymous:"تسجيل مجهول (بدون بيانات مقدّم الشكوى)",
    complainantName:"اسم مقدّم الشكوى", phone:"رقم الهاتف", grant:"المشروع المرتبط (اختياري)",
    noGrant:"بدون ربط", priority:"الأولوية", description:"تفاصيل الشكوى",
    cancel:"إلغاء", saving:"جارِ الحفظ...", submit:"تسجيل الشكوى",
    sensitiveNotice:"هذه الفئة حساسة — سيُقيَّد الوصول إلى تفاصيل الشكوى، وسيتم إعطاؤها أولوية استجابة فورية",
  } : {
    channel:"Channel", category:"Category", anonymous:"Anonymous record (no complainant details)",
    complainantName:"Complainant name", phone:"Phone number", grant:"Related project (optional)",
    noGrant:"No link", priority:"Priority", description:"Complaint details",
    cancel:"Cancel", saving:"Saving...", submit:"Submit complaint",
    sensitiveNotice:"This category is sensitive — access to complaint details will be restricted and it will be given immediate response priority",
  };

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createComplaint({
        organizationId, channel: form.channel as any, category: form.category as any,
        isAnonymous: form.isAnonymous, complainantName: form.complainantName || undefined,
        complainantPhone: form.complainantPhone || undefined, grantId: form.grantId || undefined,
        description: form.description, priority: form.priority as any,
      }, userId);
      if (res.success) router.push(`/cfm/${res.data.id}`);
      else setError(res.error);
    });
  }

  const isSensitive = SENSITIVE.has(form.category);

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}

      {isSensitive && (
        <div className="bg-[#271E0A] border border-[#4A3510] rounded-xl px-4 py-3 text-[13px] text-[#EF9F27] flex items-center gap-2">
          <i className="ti ti-shield-lock"/>{t.sensitiveNotice}
        </div>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.channel} required>
            <select value={form.channel} onChange={e=>upd("channel",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {channelOptions.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={t.category} required>
            <select value={form.category} onChange={e=>upd("category",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {categoryOptions.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#D1D5DB]">
          <input type="checkbox" checked={form.isAnonymous} onChange={e=>upd("isAnonymous",e.target.checked)} />
          {t.anonymous}
        </label>

        {!form.isAnonymous && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.complainantName}><input value={form.complainantName} onChange={e=>upd("complainantName",e.target.value)} className={inputCls}/></Field>
            <Field label={t.phone}><input value={form.complainantPhone} onChange={e=>upd("complainantPhone",e.target.value)} className={inputCls} dir="ltr"/></Field>
          </div>
        )}

        <Field label={t.grant}>
          <select value={form.grantId} onChange={e=>upd("grantId",e.target.value)} className={inputCls+" cursor-pointer"}>
            <option value="">{t.noGrant}</option>
            {orgGrants.map(g=><option key={g.id} value={g.id}>{isAr ? (g.nameAr || g.name) : (g.name || g.nameAr)}</option>)}
          </select>
        </Field>

        <Field label={t.priority}>
          <select value={form.priority} onChange={e=>upd("priority",e.target.value)} className={inputCls+" cursor-pointer"}>
            <option value="low">{priorityLabel.low}</option><option value="medium">{priorityLabel.medium}</option><option value="high">{priorityLabel.high}</option><option value="critical">{priorityLabel.critical}</option>
          </select>
        </Field>

        <Field label={t.description} required>
          <textarea value={form.description} onChange={e=>upd("description",e.target.value)} className={inputCls+" resize-none"} rows={4} required/>
        </Field>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>router.back()} className="text-sm text-[#9CA3AF] hover:text-white px-4 py-2.5">{t.cancel}</button>
        <button type="submit" disabled={isPending} className="text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-xl px-5 py-2.5">
          {isPending ? t.saving : t.submit}
        </button>
      </div>
    </form>
  );
}
