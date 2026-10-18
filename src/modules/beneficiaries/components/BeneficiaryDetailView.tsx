"use client";
import { useState, useTransition } from "react";
import {
  verifyBeneficiary, createCase, addCaseNote, updateCaseStatus, createDistribution,
} from "@/modules/beneficiaries/actions";
import type { AppLocale } from "@/lib/preferences";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";

const STATUS_STYLE: Record<string,string> = {
  pending:"bg-[#271E0A] text-[#EF9F27]", verified:"bg-[#001A12] text-[#1D9E75]",
  rejected:"bg-[#2A1215] text-[#E24B4A]", flagged_duplicate:"bg-[#2A1215] text-[#E24B4A]",
};
const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { pending:"قيد المراجعة", verified:"موثّق", rejected:"مرفوض", flagged_duplicate:"ازدواجية محتملة" },
  en: { pending:"Under review", verified:"Verified", rejected:"Rejected", flagged_duplicate:"Possible duplicate" },
};
const CASE_TYPE_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { protection:"حماية", referral:"إحالة", complaint:"شكوى", assistance_request:"طلب مساعدة", follow_up:"متابعة", other:"أخرى" },
  en: { protection:"Protection", referral:"Referral", complaint:"Complaint", assistance_request:"Assistance request", follow_up:"Follow-up", other:"Other" },
};
const CASE_STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { open:"مفتوحة", in_progress:"قيد المعالجة", referred:"مُحالة", closed:"مغلقة" },
  en: { open:"Open", in_progress:"In progress", referred:"Referred", closed:"Closed" },
};
const CASE_STATUS_STYLE: Record<string,string> = {
  open:"bg-[#271E0A] text-[#EF9F27]", in_progress:"bg-[#0B1A2A] text-[#378ADD]",
  referred:"bg-[#1F2937] text-[#9CA3AF]", closed:"bg-[#001A12] text-[#1D9E75]",
};

export default function BeneficiaryDetailView({ beneficiary, availableItems, orgGrants, userId, organizationId, locale = "ar" }: {
  beneficiary: any; availableItems: any[]; orgGrants: any[]; userId: string; organizationId: string; locale?: AppLocale;
}) {
  const isAr = locale === "ar";
  const statusLabelMap = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const t = isAr
    ? { profile:"الملف الشخصي", cases:"الحالات", distributions:"التوزيعات", verify:"توثيق", reject:"رفض" }
    : { profile:"Profile", cases:"Cases", distributions:"Distributions", verify:"Verify", reject:"Reject" };
  const [tab, setTab] = useState<"profile"|"cases"|"distributions">("profile");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleVerify(decision: "verified"|"rejected") {
    startTransition(async () => {
      const res = await verifyBeneficiary(beneficiary.id, userId, organizationId, decision);
      if (!res.success) setError(res.error);
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{beneficiary.code}</span>
          <h1 className="text-xl font-semibold text-white mt-1.5">{beneficiary.fullNameAr || `${beneficiary.firstName} ${beneficiary.lastName}`}</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            {[beneficiary.governorate, beneficiary.district, beneficiary.community].filter(Boolean).join(" / ") || "—"}
            {beneficiary.grant && <> · {beneficiary.grant.nameAr || beneficiary.grant.name}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-medium px-2.5 py-1 rounded-full ${STATUS_STYLE[beneficiary.verificationStatus]}`}>
            {statusLabelMap[beneficiary.verificationStatus]}
          </span>
          {beneficiary.verificationStatus !== "verified" && (
            <button onClick={()=>handleVerify("verified")} disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3 py-1.5">{t.verify}</button>
          )}
          {beneficiary.verificationStatus !== "rejected" && (
            <button onClick={()=>handleVerify("rejected")} disabled={isPending} className="text-[12px] font-medium text-[#E24B4A] border border-[#4A1C20] hover:bg-[#2A1215] rounded-lg px-3 py-1.5">{t.reject}</button>
          )}
        </div>
      </div>

      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}

      <div className="flex gap-1 border-b border-[#1F2937]">
        {[["profile",t.profile],["cases",`${t.cases} (${beneficiary.cases.length})`],["distributions",`${t.distributions} (${beneficiary.distributions.length})`]].map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab===k?"border-[#0F6E56] text-white":"border-transparent text-[#6B7280] hover:text-[#D1D5DB]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab beneficiary={beneficiary} locale={locale} />}
      {tab === "cases" && <CasesTab beneficiary={beneficiary} userId={userId} organizationId={organizationId} locale={locale} />}
      {tab === "distributions" && <DistributionsTab beneficiary={beneficiary} availableItems={availableItems} orgGrants={orgGrants} userId={userId} organizationId={organizationId} locale={locale} />}
    </div>
  );
}

function InfoRow({ label, value }: { label:string; value:any }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1F2937] last:border-none">
      <span className="text-[12px] text-[#6B7280]">{label}</span>
      <span className="text-[13px] text-[#D1D5DB]">{value ?? "—"}</span>
    </div>
  );
}

function ProfileTab({ beneficiary, locale = "ar" }: { beneficiary: any; locale?: AppLocale }) {
  const isAr = locale === "ar";
  const t = isAr
    ? { basicData:"البيانات الأساسية", gender:"الجنس", female:"أنثى", male:"ذكر", dob:"تاريخ الميلاد", nationalId:"رقم الهوية", phone:"الهاتف", householdSize:"حجم الأسرة", vulnerabilityScore:"درجة الضعف", householdMembers:"أفراد الأسرة", noMembers:"لا يوجد أفراد مسجّلون", years:"سنة", vulnerableSuffix:" · ضعيف" }
    : { basicData:"Basic data", gender:"Gender", female:"Female", male:"Male", dob:"Date of birth", nationalId:"National ID", phone:"Phone", householdSize:"Household size", vulnerabilityScore:"Vulnerability score", householdMembers:"Household members", noMembers:"No registered members", years:"years", vulnerableSuffix:" · vulnerable" };
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937] mb-2">{t.basicData}</h2>
        <InfoRow label={t.gender} value={beneficiary.gender === "female" ? t.female : t.male} />
        <InfoRow label={t.dob} value={beneficiary.dateOfBirth} />
        <InfoRow label={t.nationalId} value={beneficiary.nationalId} />
        <InfoRow label={t.phone} value={beneficiary.phone} />
        <InfoRow label={t.householdSize} value={beneficiary.householdSize} />
        <InfoRow label={t.vulnerabilityScore} value={`${beneficiary.vulnerabilityScore}/100`} />
      </div>
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937] mb-2">{t.householdMembers} ({beneficiary.householdMembers.length})</h2>
        {beneficiary.householdMembers.length === 0 && <p className="text-[12px] text-[#6B7280]">{t.noMembers}</p>}
        {beneficiary.householdMembers.map((m:any) => (
          <div key={m.id} className="flex items-center justify-between py-2 border-b border-[#1F2937] last:border-none">
            <span className="text-[13px] text-[#D1D5DB]">{m.fullName}</span>
            <span className="text-[12px] text-[#6B7280]">{m.relationship} · {m.age ?? "—"} {t.years}{m.isVulnerable && t.vulnerableSuffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CasesTab({ beneficiary, userId, organizationId, locale = "ar" }: { beneficiary:any; userId:string; organizationId:string; locale?: AppLocale }) {
  const isAr = locale === "ar";
  const caseTypeLabelMap = CASE_TYPE_LABEL[locale] ?? CASE_TYPE_LABEL.ar;
  const caseStatusLabelMap = CASE_STATUS_LABEL[locale] ?? CASE_STATUS_LABEL.ar;
  const t = isAr
    ? { newCase:"حالة جديدة", saveCase:"حفظ الحالة", noCases:"لا توجد حالات مسجّلة", priorityLow:"أولوية منخفضة", priorityMedium:"متوسطة", priorityHigh:"عالية", priorityUrgent:"عاجلة", descPlaceholder:"وصف الحالة...", addNotePlaceholder:"إضافة ملاحظة متابعة...", add:"إضافة", closeStatus:"إغلاق" }
    : { newCase:"New case", saveCase:"Save case", noCases:"No registered cases", priorityLow:"Low priority", priorityMedium:"Medium", priorityHigh:"High", priorityUrgent:"Urgent", descPlaceholder:"Case description...", addNotePlaceholder:"Add a follow-up note...", add:"Add", closeStatus:"Close" };
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ caseType:"assistance_request", priority:"medium", description:"" });
  const [noteDrafts, setNoteDrafts] = useState<Record<string,string>>({});

  function submitCase(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createCase({ organizationId, beneficiaryId: beneficiary.id, caseType: form.caseType as any, priority: form.priority as any, description: form.description, isConfidential: true }, userId);
      setShowForm(false); setForm({ caseType:"assistance_request", priority:"medium", description:"" });
    });
  }
  function submitNote(caseId: string) {
    const note = noteDrafts[caseId];
    if (!note?.trim()) return;
    startTransition(async () => {
      await addCaseNote(caseId, organizationId, beneficiary.id, note, userId);
      setNoteDrafts(p => ({ ...p, [caseId]: "" }));
    });
  }
  function changeStatus(caseId: string, status: string) {
    startTransition(async () => { await updateCaseStatus(caseId, organizationId, beneficiary.id, status as any, userId); });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3.5 py-2 flex items-center gap-1.5">
          <i className="ti ti-plus"/>{t.newCase}
        </button>
      </div>
      {showForm && (
        <form onSubmit={submitCase} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.caseType} onChange={e=>setForm(p=>({...p,caseType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              {Object.entries(caseTypeLabelMap).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="low">{t.priorityLow}</option><option value="medium">{t.priorityMedium}</option><option value="high">{t.priorityHigh}</option><option value="urgent">{t.priorityUrgent}</option>
            </select>
          </div>
          <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder={t.descPlaceholder} className={inputCls+" resize-none"} rows={2} required/>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-lg px-4 py-2">{t.saveCase}</button>
        </form>
      )}

      {beneficiary.cases.length === 0 && <p className="text-[13px] text-[#6B7280] text-center py-8">{t.noCases}</p>}
      {beneficiary.cases.map((c:any) => (
        <div key={c.id} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#4B5563]">{c.code}</span>
              <span className="text-[13px] text-white font-medium">{caseTypeLabelMap[c.caseType]}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CASE_STATUS_STYLE[c.caseStatus]}`}>{caseStatusLabelMap[c.caseStatus]}</span>
            </div>
            {c.caseStatus !== "closed" && (
              <select value={c.caseStatus} onChange={e=>changeStatus(c.id, e.target.value)} className="bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1 text-[12px] text-[#D1D5DB] cursor-pointer">
                <option value="open">{caseStatusLabelMap.open}</option><option value="in_progress">{caseStatusLabelMap.in_progress}</option><option value="referred">{caseStatusLabelMap.referred}</option><option value="closed">{t.closeStatus}</option>
              </select>
            )}
          </div>
          <p className="text-[13px] text-[#D1D5DB]">{c.description}</p>
          <div className="space-y-1.5 pt-2 border-t border-[#1F2937]">
            {c.notes.map((n:any) => (
              <p key={n.id} className="text-[12px] text-[#9CA3AF]">— {n.note}</p>
            ))}
            <div className="flex gap-2 pt-1">
              <input
                value={noteDrafts[c.id] ?? ""}
                onChange={e=>setNoteDrafts(p=>({...p,[c.id]:e.target.value}))}
                placeholder={t.addNotePlaceholder}
                className={inputCls}
              />
              <button onClick={()=>submitNote(c.id)} disabled={isPending} className="text-[12px] text-[#0F6E56] hover:text-[#1D9E75] shrink-0 px-2">{t.add}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionsTab({ beneficiary, availableItems, orgGrants, userId, organizationId, locale = "ar" }: {
  beneficiary:any; availableItems:any[]; orgGrants:any[]; userId:string; organizationId:string; locale?:AppLocale;
}) {
  const isAr = locale === "ar";
  const t = isAr
    ? { recordDistribution:"تسجيل توزيع", selectGrant:"اختر المشروع/المنحة...", inKind:"عيني", cash:"نقدي", voucher:"قسيمة", service:"خدمة", amountPlaceholder:"المبلغ", currencyPlaceholder:"العملة (USD)", selectItem:"اختر الصنف...", available:"متاح", quantityPlaceholder:"الكمية", locationPlaceholder:"موقع التوزيع (اختياري)", saveDistribution:"حفظ التوزيع", thDate:"التاريخ", thType:"النوع", thItemAmount:"الصنف/المبلغ", thLocation:"الموقع", noDistributions:"لا توجد توزيعات مسجّلة" }
    : { recordDistribution:"Record distribution", selectGrant:"Select project/grant...", inKind:"In-kind", cash:"Cash", voucher:"Voucher", service:"Service", amountPlaceholder:"Amount", currencyPlaceholder:"Currency (USD)", selectItem:"Select item...", available:"available", quantityPlaceholder:"Quantity", locationPlaceholder:"Distribution location (optional)", saveDistribution:"Save distribution", thDate:"Date", thType:"Type", thItemAmount:"Item/Amount", thLocation:"Location", noDistributions:"No registered distributions" };
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    grantId: beneficiary.grantId ?? "", distributionType:"in_kind", itemId:"", quantity:"", cashAmount:"", currencyCode:"USD", location:"",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createDistribution({
        organizationId, beneficiaryId: beneficiary.id,
        grantId: form.grantId,
        itemId: form.itemId || undefined,
        distributionType: form.distributionType as any,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        cashAmount: form.cashAmount ? Number(form.cashAmount) : undefined,
        currencyCode: form.distributionType === "cash" ? form.currencyCode : undefined,
        location: form.location || undefined,
      }, userId);
      if (res.success) setShowForm(false);
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3.5 py-2 flex items-center gap-1.5">
          <i className="ti ti-plus"/>{t.recordDistribution}
        </button>
      </div>
      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.grantId} onChange={e=>setForm(p=>({...p,grantId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
              <option value="">{t.selectGrant}</option>
              {orgGrants.map((g:any)=><option key={g.id} value={g.id}>{g.nameAr || g.name}</option>)}
            </select>
            <select value={form.distributionType} onChange={e=>setForm(p=>({...p,distributionType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="in_kind">{t.inKind}</option><option value="cash">{t.cash}</option><option value="voucher">{t.voucher}</option><option value="service">{t.service}</option>
            </select>
          </div>
          {form.distributionType === "cash" ? (
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" placeholder={t.amountPlaceholder} value={form.cashAmount} onChange={e=>setForm(p=>({...p,cashAmount:e.target.value}))} className={inputCls} dir="ltr" required/>
              <input value={form.currencyCode} onChange={e=>setForm(p=>({...p,currencyCode:e.target.value}))} placeholder={t.currencyPlaceholder} className={inputCls} dir="ltr"/>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <select value={form.itemId} onChange={e=>setForm(p=>({...p,itemId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
                <option value="">{t.selectItem}</option>
                {availableItems.map((it:any)=><option key={it.id} value={it.id}>{it.nameAr || it.name} ({t.available}: {it.currentStock} {it.unit})</option>)}
              </select>
              <input type="number" step="0.001" placeholder={t.quantityPlaceholder} value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} className={inputCls} dir="ltr" required/>
            </div>
          )}
          <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder={t.locationPlaceholder} className={inputCls}/>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-lg px-4 py-2">{t.saveDistribution}</button>
        </form>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">
            {[t.thDate,t.thType,t.thItemAmount,t.thLocation].map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {beneficiary.distributions.map((d:any) => (
              <tr key={d.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(d.distributionDate).toLocaleDateString(isAr ? "ar" : "en-US")}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{d.distributionType}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">
                  {d.distributionType === "cash" ? `${d.cashAmount} ${d.currencyCode ?? ""}` : `${d.item?.nameAr || d.item?.name || "—"} × ${d.quantity}`}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{d.location ?? "—"}</td>
              </tr>
            ))}
            {beneficiary.distributions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">{t.noDistributions}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
