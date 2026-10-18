"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBeneficiary, checkDuplicates } from "@/modules/beneficiaries/actions";
import { commonCopy } from "@/lib/i18n";
import type { AppLocale } from "@/lib/preferences";

interface HHMember { fullName:string; relationship:string; age:string; gender:string; isVulnerable:boolean; }
interface DupMatch { id:string; code:string; fullName:string; similarity:number; verificationStatus:string; }

const VULN_OPTIONS = {
  ar: [
    {value:"none",label:"لا يوجد"},{value:"elderly",label:"كبار السن"},{value:"disability",label:"إعاقة"},
    {value:"chronic_illness",label:"مرض مزمن"},{value:"female_headed_household",label:"أسرة تعيلها امرأة"},
    {value:"child_headed_household",label:"أسرة يعيلها طفل"},{value:"unaccompanied_minor",label:"قاصر غير مصحوب"},
    {value:"pregnant_lactating",label:"حامل/مرضعة"},{value:"other",label:"أخرى"},
  ],
  en: [
    {value:"none",label:"None"},{value:"elderly",label:"Older person"},{value:"disability",label:"Disability"},
    {value:"chronic_illness",label:"Chronic illness"},{value:"female_headed_household",label:"Female-headed household"},
    {value:"child_headed_household",label:"Child-headed household"},{value:"unaccompanied_minor",label:"Unaccompanied minor"},
    {value:"pregnant_lactating",label:"Pregnant/lactating"},{value:"other",label:"Other"},
  ],
} as const;
const RELATIONSHIPS = {
  ar: ["زوج/زوجة","ابن/ابنة","والد/والدة","أخ/أخت","أخرى"],
  en: ["Spouse","Child","Parent","Sibling","Other"],
} as const;

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(<div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required&&<span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>);
}

export default function BeneficiaryForm({ grants, organizationId, userId, locale = "ar" }: { grants:any[]; organizationId:string; userId:string; locale?: AppLocale }) {
  const router = useRouter();
  const t = commonCopy[locale];
  const copy = {
    basicInfo: locale === "ar" ? "البيانات الأساسية" : "Basic information",
    firstName: locale === "ar" ? "الاسم الأول" : "First name",
    lastName: locale === "ar" ? "اسم العائلة" : "Last name",
    fullNameAr: locale === "ar" ? "الاسم الكامل بالعربية" : "Full name in Arabic",
    birthDate: locale === "ar" ? "تاريخ الميلاد" : "Date of birth",
    gender: locale === "ar" ? "الجنس" : "Gender",
    nationalId: locale === "ar" ? "رقم الهوية" : "National ID",
    duplicateCheck: locale === "ar" ? "جارِ فحص الازدواجية..." : "Checking duplicates...",
    strongDuplicate: locale === "ar" ? "مطابقة قوية محتملة — راجع قبل المتابعة" : "Strong possible duplicate detected. Review before proceeding.",
    weakDuplicate: locale === "ar" ? "مطابقات محتملة موجودة" : "Possible matches found",
    similarity: locale === "ar" ? "تشابه" : "Similarity",
    overrideDuplicate: locale === "ar" ? "تأكيد أن هذا مستفيد مختلف فعلاً — المتابعة رغم التحذير" : "Confirm this is a different beneficiary and continue anyway",
    phone: locale === "ar" ? "الهاتف" : "Phone",
    grant: locale === "ar" ? "المشروع/المنحة" : "Project / grant",
    locationFamily: locale === "ar" ? "الموقع والأسرة" : "Location and household",
    governorate: locale === "ar" ? "المحافظة" : "Governorate",
    district: locale === "ar" ? "المنطقة" : "District",
    community: locale === "ar" ? "المجتمع/الحي" : "Community / neighborhood",
    address: locale === "ar" ? "تفاصيل العنوان" : "Address details",
    latitude: locale === "ar" ? "خط العرض (Latitude) — اختياري" : `Latitude (${t.optional})`,
    longitude: locale === "ar" ? "خط الطول (Longitude) — اختياري" : `Longitude (${t.optional})`,
    householdSize: locale === "ar" ? "حجم الأسرة" : "Household size",
    vulnerabilityCategory: locale === "ar" ? "فئة الضعف" : "Vulnerability category",
    vulnerabilityScore: locale === "ar" ? "درجة الضعف (0-100)" : "Vulnerability score (0-100)",
    householdMembers: locale === "ar" ? "أفراد الأسرة" : "Household members",
    addMember: locale === "ar" ? "إضافة فرد" : "Add member",
    noMembers: locale === "ar" ? "لا يوجد أفراد مضافون" : "No household members added",
    name: locale === "ar" ? "الاسم" : "Name",
    relationship: locale === "ar" ? "القرابة" : "Relationship",
    age: locale === "ar" ? "العمر" : "Age",
    savePending: locale === "ar" ? "جارِ الحفظ..." : "Saving...",
    saveBeneficiary: locale === "ar" ? "تسجيل المستفيد" : "Register beneficiary",
  } as const;
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<DupMatch[]>([]);
  const [overrideDup, setOverrideDup] = useState(false);
  const [members, setMembers] = useState<HHMember[]>([]);
  const [form, setForm] = useState({
    grantId:"", firstName:"", lastName:"", fullNameAr:"", dateOfBirth:"", gender:"female",
    nationalId:"", phone:"", governorate:"", district:"", community:"", addressDetail:"",
    latitude:"", longitude:"",
    householdSize:"1", vulnerabilityCategory:"none", vulnerabilityScore:"0",
  });
  const upd = (k:string,v:string) => setForm(p=>({...p,[k]:v}));
  const addMember = () => setMembers(p=>[...p,{fullName:"",relationship:RELATIONSHIPS[locale][1],age:"",gender:"male",isVulnerable:false}]);
  const updMember = (i:number,k:keyof HHMember,v:any) => setMembers(p=>p.map((m,idx)=>idx===i?{...m,[k]:v}:m));
  const remMember = (i:number) => setMembers(p=>p.filter((_,idx)=>idx!==i));

  async function runDuplicateCheck() {
    if (!form.firstName || !form.lastName) return;
    setIsChecking(true);
    const res = await checkDuplicates(organizationId, form.firstName, form.lastName, form.dateOfBirth, form.nationalId);
    setDuplicates(res);
    setIsChecking(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");

    const payload = {
      organizationId,
      grantId: form.grantId || undefined,
      firstName: form.firstName,
      lastName: form.lastName,
      fullNameAr: form.fullNameAr || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender as "male"|"female",
      nationalId: form.nationalId || undefined,
      phone: form.phone || undefined,
      governorate: form.governorate || undefined,
      district: form.district || undefined,
      community: form.community || undefined,
      addressDetail: form.addressDetail || undefined,
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      householdSize: Number(form.householdSize) || 1,
      vulnerabilityCategory: form.vulnerabilityCategory as any,
      vulnerabilityScore: Number(form.vulnerabilityScore) || 0,
      householdMembers: members.map(m => ({
        fullName: m.fullName, relationship: m.relationship,
        age: m.age ? Number(m.age) : undefined,
        gender: m.gender as "male"|"female",
        isVulnerable: m.isVulnerable,
      })),
      overrideDuplicateWarning: overrideDup,
    };

    // بدون اتصال — تُحفظ البيانات محلياً وتُرسَل تلقائياً عند عودة الشبكة (لا يوجد فحص ازدواجية فوري في هذه الحالة)
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      startTransition(async () => {
        const { enqueue } = await import("@/lib/offline/indexeddb-queue");
        await enqueue("beneficiary_registration", payload);
        router.push("/beneficiaries");
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await createBeneficiary(payload, userId);
        if (res.success) router.push(`/beneficiaries/${res.data.id}`);
        else setError(res.error);
      } catch {
        // فشل الاتصال أثناء الإرسال (مثلاً انقطاع مفاجئ) — نحفظ محلياً بدل فقدان البيانات المُدخَلة
        const { enqueue } = await import("@/lib/offline/indexeddb-queue");
        await enqueue("beneficiary_registration", payload);
        router.push("/beneficiaries");
      }
    });
  }

  const strongDuplicate = duplicates.find(d => d.similarity >= 80);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]"><i className="ti ti-alert-circle"/>{error}</div>}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{copy.basicInfo}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={copy.firstName} required>
            <input value={form.firstName} onChange={e=>upd("firstName",e.target.value)} onBlur={runDuplicateCheck} className={inputCls} required/>
          </Field>
          <Field label={copy.lastName} required>
            <input value={form.lastName} onChange={e=>upd("lastName",e.target.value)} onBlur={runDuplicateCheck} className={inputCls} required/>
          </Field>
        </div>
        <Field label={copy.fullNameAr}><input value={form.fullNameAr} onChange={e=>upd("fullNameAr",e.target.value)} className={inputCls}/></Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label={copy.birthDate}><input type="date" value={form.dateOfBirth} onChange={e=>upd("dateOfBirth",e.target.value)} onBlur={runDuplicateCheck} className={inputCls} dir="ltr"/></Field>
          <Field label={copy.gender} required>
            <select value={form.gender} onChange={e=>upd("gender",e.target.value)} className={inputCls+" cursor-pointer"} required>
              <option value="female">{locale === "ar" ? "أنثى" : "Female"}</option><option value="male">{locale === "ar" ? "ذكر" : "Male"}</option>
            </select>
          </Field>
          <Field label={copy.nationalId}><input value={form.nationalId} onChange={e=>upd("nationalId",e.target.value)} onBlur={runDuplicateCheck} className={inputCls} dir="ltr"/></Field>
        </div>

        {isChecking && <p className="text-[12px] text-[#6B7280] flex items-center gap-1.5"><i className="ti ti-loader-2 animate-spin"/>{copy.duplicateCheck}</p>}

        {duplicates.length > 0 && (
          <div className={`rounded-xl p-4 border space-y-2 ${strongDuplicate ? "bg-[#2A1215] border-[#4A1C20]" : "bg-[#271E0A] border-[#4A3510]"}`}>
            <p className={`text-[13px] font-medium flex items-center gap-1.5 ${strongDuplicate ? "text-[#E24B4A]" : "text-[#EF9F27]"}`}>
              <i className="ti ti-alert-triangle"/>
              {strongDuplicate ? copy.strongDuplicate : copy.weakDuplicate}
            </p>
            <ul className="space-y-1">
              {duplicates.map(d => (
                <li key={d.id} className="text-[12px] text-[#D1D5DB] flex items-center justify-between">
                  <span>{d.fullName} ({d.code})</span>
                  <span className="text-[#9CA3AF]">{copy.similarity} {d.similarity}%</span>
                </li>
              ))}
            </ul>
            {strongDuplicate && (
              <label className="flex items-center gap-2 text-[12px] text-[#D1D5DB] pt-1">
                <input type="checkbox" checked={overrideDup} onChange={e=>setOverrideDup(e.target.checked)} />
                {copy.overrideDuplicate}
              </label>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label={copy.phone}><input value={form.phone} onChange={e=>upd("phone",e.target.value)} className={inputCls} dir="ltr"/></Field>
          <Field label={copy.grant}>
            <select value={form.grantId} onChange={e=>upd("grantId",e.target.value)} className={inputCls+" cursor-pointer"}>
              <option value="">{locale === "ar" ? "بدون ربط" : "Not linked"}</option>
              {grants.map(g => <option key={g.id} value={g.id}>{locale === "ar" ? (g.nameAr || g.name) : (g.name || g.nameAr)}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{copy.locationFamily}</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label={copy.governorate}><input value={form.governorate} onChange={e=>upd("governorate",e.target.value)} className={inputCls}/></Field>
          <Field label={copy.district}><input value={form.district} onChange={e=>upd("district",e.target.value)} className={inputCls}/></Field>
          <Field label={copy.community}><input value={form.community} onChange={e=>upd("community",e.target.value)} className={inputCls}/></Field>
        </div>
        <Field label={copy.address}><textarea value={form.addressDetail} onChange={e=>upd("addressDetail",e.target.value)} className={inputCls+" resize-none"} rows={2}/></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={copy.latitude}><input type="number" step="0.0000001" value={form.latitude} onChange={e=>upd("latitude",e.target.value)} className={inputCls} dir="ltr" placeholder="e.g. 33.5138"/></Field>
          <Field label={copy.longitude}><input type="number" step="0.0000001" value={form.longitude} onChange={e=>upd("longitude",e.target.value)} className={inputCls} dir="ltr" placeholder="e.g. 36.2765"/></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label={copy.householdSize} required><input type="number" min="1" value={form.householdSize} onChange={e=>upd("householdSize",e.target.value)} className={inputCls} dir="ltr"/></Field>
          <Field label={copy.vulnerabilityCategory}>
            <select value={form.vulnerabilityCategory} onChange={e=>upd("vulnerabilityCategory",e.target.value)} className={inputCls+" cursor-pointer"}>
              {VULN_OPTIONS[locale].map(v=><option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </Field>
          <Field label={copy.vulnerabilityScore}><input type="number" min="0" max="100" value={form.vulnerabilityScore} onChange={e=>upd("vulnerabilityScore",e.target.value)} className={inputCls} dir="ltr"/></Field>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
          <h2 className="text-sm font-semibold text-white">{copy.householdMembers}</h2>
          <button type="button" onClick={addMember} className="text-[12px] text-[#0F6E56] hover:text-[#1D9E75] flex items-center gap-1">
            <i className="ti ti-plus"/>{copy.addMember}
          </button>
        </div>
        {members.length === 0 && <p className="text-[12px] text-[#6B7280]">{copy.noMembers}</p>}
        {members.map((m,i) => (
          <div key={i} className="grid grid-cols-5 gap-2 items-end">
            <div className="col-span-2"><Field label={copy.name}><input value={m.fullName} onChange={e=>updMember(i,"fullName",e.target.value)} className={inputCls}/></Field></div>
            <Field label={copy.relationship}>
              <select value={m.relationship} onChange={e=>updMember(i,"relationship",e.target.value)} className={inputCls+" cursor-pointer"}>
                {RELATIONSHIPS[locale].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label={copy.age}><input type="number" min="0" value={m.age} onChange={e=>updMember(i,"age",e.target.value)} className={inputCls} dir="ltr"/></Field>
            <button type="button" onClick={()=>remMember(i)} className="text-[#E24B4A] hover:text-[#F87171] p-2.5"><i className="ti ti-trash"/></button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>router.back()} className="text-sm text-[#9CA3AF] hover:text-white px-4 py-2.5">{t.cancel}</button>
        <button type="submit" disabled={isPending} className="text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-xl px-5 py-2.5 flex items-center gap-2">
          {isPending ? <><i className="ti ti-loader-2 animate-spin"/>{copy.savePending}</> : copy.saveBeneficiary}
        </button>
      </div>
    </form>
  );
}
