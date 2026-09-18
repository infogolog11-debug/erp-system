"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createComplaint } from "@/modules/cfm/actions";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] transition-all";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(<div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required&&<span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>);
}
const CHANNEL_OPTIONS = [
  {value:"hotline",label:"الخط الساخن"},{value:"in_person",label:"حضورياً"},{value:"sms",label:"رسالة نصية"},
  {value:"email",label:"بريد إلكتروني"},{value:"suggestion_box",label:"صندوق اقتراحات"},{value:"community_meeting",label:"اجتماع مجتمعي"},{value:"other",label:"أخرى"},
];
const CATEGORY_OPTIONS = [
  {value:"service_quality",label:"جودة الخدمة"},{value:"staff_conduct",label:"سلوك الموظفين"},
  {value:"corruption_fraud",label:"فساد/احتيال"},{value:"sgbv_protection",label:"حماية/عنف قائم على النوع"},
  {value:"distribution_issue",label:"مشكلة توزيع"},{value:"eligibility_targeting",label:"استهداف/أهلية"},
  {value:"data_privacy",label:"خصوصية البيانات"},{value:"suggestion",label:"اقتراح"},{value:"other",label:"أخرى"},
];
const SENSITIVE = new Set(["corruption_fraud","sgbv_protection"]);

export default function CFMForm({ organizationId, userId, orgGrants }: { organizationId:string; userId:string; orgGrants:any[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    channel:"hotline", category:"service_quality", isAnonymous:false,
    complainantName:"", complainantPhone:"", grantId:"", description:"", priority:"medium",
  });
  const upd = (k:string,v:any) => setForm(p=>({...p,[k]:v}));

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
          <i className="ti ti-shield-lock"/>هذه الفئة حساسة — سيُقيَّد الوصول إلى تفاصيل الشكوى، وسيتم إعطاؤها أولوية استجابة فورية
        </div>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="القناة" required>
            <select value={form.channel} onChange={e=>upd("channel",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {CHANNEL_OPTIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="الفئة" required>
            <select value={form.category} onChange={e=>upd("category",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {CATEGORY_OPTIONS.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-[#D1D5DB]">
          <input type="checkbox" checked={form.isAnonymous} onChange={e=>upd("isAnonymous",e.target.checked)} />
          تسجيل مجهول (بدون بيانات مقدّم الشكوى)
        </label>

        {!form.isAnonymous && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="اسم مقدّم الشكوى"><input value={form.complainantName} onChange={e=>upd("complainantName",e.target.value)} className={inputCls}/></Field>
            <Field label="رقم الهاتف"><input value={form.complainantPhone} onChange={e=>upd("complainantPhone",e.target.value)} className={inputCls} dir="ltr"/></Field>
          </div>
        )}

        <Field label="المشروع المرتبط (اختياري)">
          <select value={form.grantId} onChange={e=>upd("grantId",e.target.value)} className={inputCls+" cursor-pointer"}>
            <option value="">بدون ربط</option>
            {orgGrants.map(g=><option key={g.id} value={g.id}>{g.nameAr || g.name}</option>)}
          </select>
        </Field>

        <Field label="الأولوية">
          <select value={form.priority} onChange={e=>upd("priority",e.target.value)} className={inputCls+" cursor-pointer"}>
            <option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="critical">حرجة</option>
          </select>
        </Field>

        <Field label="تفاصيل الشكوى" required>
          <textarea value={form.description} onChange={e=>upd("description",e.target.value)} className={inputCls+" resize-none"} rows={4} required/>
        </Field>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>router.back()} className="text-sm text-[#9CA3AF] hover:text-white px-4 py-2.5">إلغاء</button>
        <button type="submit" disabled={isPending} className="text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-xl px-5 py-2.5">
          {isPending ? "جارِ الحفظ..." : "تسجيل الشكوى"}
        </button>
      </div>
    </form>
  );
}
