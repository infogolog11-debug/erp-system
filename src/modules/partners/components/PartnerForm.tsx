"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPartner } from "@/modules/partners/actions";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] transition-all";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(<div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required&&<span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>);
}
const TYPE_OPTIONS = [
  {value:"local_ngo",label:"منظمة محلية"},{value:"international_ngo",label:"منظمة دولية"},
  {value:"government",label:"جهة حكومية"},{value:"community_based",label:"مجتمعية"},
  {value:"private_sector",label:"قطاع خاص"},{value:"un_agency",label:"وكالة أممية"},
];

export default function PartnerForm({ organizationId, userId }: { organizationId:string; userId:string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name:"", nameAr:"", partnerType:"local_ngo", country:"", registrationNumber:"",
    contactPerson:"", email:"", phone:"", capacityAssessmentScore:"",
  });
  const upd = (k:string,v:string) => setForm(p=>({...p,[k]:v}));

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createPartner({
        organizationId, name: form.name, nameAr: form.nameAr || undefined,
        partnerType: form.partnerType as any, country: form.country || undefined,
        registrationNumber: form.registrationNumber || undefined,
        contactPerson: form.contactPerson || undefined,
        email: form.email || undefined, phone: form.phone || undefined,
        capacityAssessmentScore: form.capacityAssessmentScore ? Number(form.capacityAssessmentScore) : undefined,
      }, userId);
      if (res.success) router.push(`/partners/${res.data.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="اسم المنظمة" required><input value={form.name} onChange={e=>upd("name",e.target.value)} className={inputCls} required/></Field>
          <Field label="الاسم بالعربية"><input value={form.nameAr} onChange={e=>upd("nameAr",e.target.value)} className={inputCls}/></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="نوع الشريك" required>
            <select value={form.partnerType} onChange={e=>upd("partnerType",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {TYPE_OPTIONS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="الدولة"><input value={form.country} onChange={e=>upd("country",e.target.value)} className={inputCls}/></Field>
        </div>
        <Field label="رقم التسجيل الرسمي"><input value={form.registrationNumber} onChange={e=>upd("registrationNumber",e.target.value)} className={inputCls} dir="ltr"/></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="الشخص المسؤول"><input value={form.contactPerson} onChange={e=>upd("contactPerson",e.target.value)} className={inputCls}/></Field>
          <Field label="الهاتف"><input value={form.phone} onChange={e=>upd("phone",e.target.value)} className={inputCls} dir="ltr"/></Field>
        </div>
        <Field label="البريد الإلكتروني"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} className={inputCls} dir="ltr"/></Field>
        <Field label="درجة تقييم القدرات المؤسسية (0-100)"><input type="number" min="0" max="100" value={form.capacityAssessmentScore} onChange={e=>upd("capacityAssessmentScore",e.target.value)} className={inputCls} dir="ltr"/></Field>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>router.back()} className="text-sm text-[#9CA3AF] hover:text-white px-4 py-2.5">إلغاء</button>
        <button type="submit" disabled={isPending} className="text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-xl px-5 py-2.5">
          {isPending ? "جارِ الحفظ..." : "تسجيل الشريك"}
        </button>
      </div>
    </form>
  );
}
