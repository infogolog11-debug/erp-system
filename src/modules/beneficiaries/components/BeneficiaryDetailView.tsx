"use client";
import { useState, useTransition } from "react";
import {
  verifyBeneficiary, createCase, addCaseNote, updateCaseStatus, createDistribution,
} from "@/modules/beneficiaries/actions";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";

const STATUS_STYLE: Record<string,string> = {
  pending:"bg-[#271E0A] text-[#EF9F27]", verified:"bg-[#001A12] text-[#1D9E75]",
  rejected:"bg-[#2A1215] text-[#E24B4A]", flagged_duplicate:"bg-[#2A1215] text-[#E24B4A]",
};
const STATUS_LABEL: Record<string,string> = {
  pending:"قيد المراجعة", verified:"موثّق", rejected:"مرفوض", flagged_duplicate:"ازدواجية محتملة",
};
const CASE_TYPE_LABEL: Record<string,string> = {
  protection:"حماية", referral:"إحالة", complaint:"شكوى", assistance_request:"طلب مساعدة", follow_up:"متابعة", other:"أخرى",
};
const CASE_STATUS_LABEL: Record<string,string> = { open:"مفتوحة", in_progress:"قيد المعالجة", referred:"مُحالة", closed:"مغلقة" };
const CASE_STATUS_STYLE: Record<string,string> = {
  open:"bg-[#271E0A] text-[#EF9F27]", in_progress:"bg-[#0B1A2A] text-[#378ADD]",
  referred:"bg-[#1F2937] text-[#9CA3AF]", closed:"bg-[#001A12] text-[#1D9E75]",
};

export default function BeneficiaryDetailView({ beneficiary, availableItems, orgGrants, userId, organizationId }: {
  beneficiary: any; availableItems: any[]; orgGrants: any[]; userId: string; organizationId: string;
}) {
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
            {STATUS_LABEL[beneficiary.verificationStatus]}
          </span>
          {beneficiary.verificationStatus !== "verified" && (
            <button onClick={()=>handleVerify("verified")} disabled={isPending} className="text-[12px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3 py-1.5">توثيق</button>
          )}
          {beneficiary.verificationStatus !== "rejected" && (
            <button onClick={()=>handleVerify("rejected")} disabled={isPending} className="text-[12px] font-medium text-[#E24B4A] border border-[#4A1C20] hover:bg-[#2A1215] rounded-lg px-3 py-1.5">رفض</button>
          )}
        </div>
      </div>

      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}

      <div className="flex gap-1 border-b border-[#1F2937]">
        {[["profile","الملف الشخصي"],["cases",`الحالات (${beneficiary.cases.length})`],["distributions",`التوزيعات (${beneficiary.distributions.length})`]].map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab===k?"border-[#0F6E56] text-white":"border-transparent text-[#6B7280] hover:text-[#D1D5DB]"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab beneficiary={beneficiary} />}
      {tab === "cases" && <CasesTab beneficiary={beneficiary} userId={userId} organizationId={organizationId} />}
      {tab === "distributions" && <DistributionsTab beneficiary={beneficiary} availableItems={availableItems} orgGrants={orgGrants} userId={userId} organizationId={organizationId} />}
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

function ProfileTab({ beneficiary }: { beneficiary: any }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937] mb-2">البيانات الأساسية</h2>
        <InfoRow label="الجنس" value={beneficiary.gender === "female" ? "أنثى" : "ذكر"} />
        <InfoRow label="تاريخ الميلاد" value={beneficiary.dateOfBirth} />
        <InfoRow label="رقم الهوية" value={beneficiary.nationalId} />
        <InfoRow label="الهاتف" value={beneficiary.phone} />
        <InfoRow label="حجم الأسرة" value={beneficiary.householdSize} />
        <InfoRow label="درجة الضعف" value={`${beneficiary.vulnerabilityScore}/100`} />
      </div>
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937] mb-2">أفراد الأسرة ({beneficiary.householdMembers.length})</h2>
        {beneficiary.householdMembers.length === 0 && <p className="text-[12px] text-[#6B7280]">لا يوجد أفراد مسجّلون</p>}
        {beneficiary.householdMembers.map((m:any) => (
          <div key={m.id} className="flex items-center justify-between py-2 border-b border-[#1F2937] last:border-none">
            <span className="text-[13px] text-[#D1D5DB]">{m.fullName}</span>
            <span className="text-[12px] text-[#6B7280]">{m.relationship} · {m.age ?? "—"} سنة{m.isVulnerable && " · ضعيف"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CasesTab({ beneficiary, userId, organizationId }: { beneficiary:any; userId:string; organizationId:string }) {
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
          <i className="ti ti-plus"/>حالة جديدة
        </button>
      </div>
      {showForm && (
        <form onSubmit={submitCase} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.caseType} onChange={e=>setForm(p=>({...p,caseType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              {Object.entries(CASE_TYPE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.priority} onChange={e=>setForm(p=>({...p,priority:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="low">أولوية منخفضة</option><option value="medium">متوسطة</option><option value="high">عالية</option><option value="urgent">عاجلة</option>
            </select>
          </div>
          <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="وصف الحالة..." className={inputCls+" resize-none"} rows={2} required/>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-lg px-4 py-2">حفظ الحالة</button>
        </form>
      )}

      {beneficiary.cases.length === 0 && <p className="text-[13px] text-[#6B7280] text-center py-8">لا توجد حالات مسجّلة</p>}
      {beneficiary.cases.map((c:any) => (
        <div key={c.id} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[#4B5563]">{c.code}</span>
              <span className="text-[13px] text-white font-medium">{CASE_TYPE_LABEL[c.caseType]}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${CASE_STATUS_STYLE[c.caseStatus]}`}>{CASE_STATUS_LABEL[c.caseStatus]}</span>
            </div>
            {c.caseStatus !== "closed" && (
              <select value={c.caseStatus} onChange={e=>changeStatus(c.id, e.target.value)} className="bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1 text-[12px] text-[#D1D5DB] cursor-pointer">
                <option value="open">مفتوحة</option><option value="in_progress">قيد المعالجة</option><option value="referred">مُحالة</option><option value="closed">إغلاق</option>
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
                placeholder="إضافة ملاحظة متابعة..."
                className={inputCls}
              />
              <button onClick={()=>submitNote(c.id)} disabled={isPending} className="text-[12px] text-[#0F6E56] hover:text-[#1D9E75] shrink-0 px-2">إضافة</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DistributionsTab({ beneficiary, availableItems, orgGrants, userId, organizationId }: {
  beneficiary:any; availableItems:any[]; orgGrants:any[]; userId:string; organizationId:string;
}) {
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
          <i className="ti ti-plus"/>تسجيل توزيع
        </button>
      </div>
      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.grantId} onChange={e=>setForm(p=>({...p,grantId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
              <option value="">اختر المشروع/المنحة...</option>
              {orgGrants.map((g:any)=><option key={g.id} value={g.id}>{g.nameAr || g.name}</option>)}
            </select>
            <select value={form.distributionType} onChange={e=>setForm(p=>({...p,distributionType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="in_kind">عيني</option><option value="cash">نقدي</option><option value="voucher">قسيمة</option><option value="service">خدمة</option>
            </select>
          </div>
          {form.distributionType === "cash" ? (
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" placeholder="المبلغ" value={form.cashAmount} onChange={e=>setForm(p=>({...p,cashAmount:e.target.value}))} className={inputCls} dir="ltr" required/>
              <input value={form.currencyCode} onChange={e=>setForm(p=>({...p,currencyCode:e.target.value}))} placeholder="العملة (USD)" className={inputCls} dir="ltr"/>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <select value={form.itemId} onChange={e=>setForm(p=>({...p,itemId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
                <option value="">اختر الصنف...</option>
                {availableItems.map((it:any)=><option key={it.id} value={it.id}>{it.nameAr || it.name} (متاح: {it.currentStock} {it.unit})</option>)}
              </select>
              <input type="number" step="0.001" placeholder="الكمية" value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))} className={inputCls} dir="ltr" required/>
            </div>
          )}
          <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} placeholder="موقع التوزيع (اختياري)" className={inputCls}/>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] disabled:opacity-50 rounded-lg px-4 py-2">حفظ التوزيع</button>
        </form>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">
            {["التاريخ","النوع","الصنف/المبلغ","الموقع"].map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {beneficiary.distributions.map((d:any) => (
              <tr key={d.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(d.distributionDate).toLocaleDateString("ar")}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{d.distributionType}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">
                  {d.distributionType === "cash" ? `${d.cashAmount} ${d.currencyCode ?? ""}` : `${d.item?.nameAr || d.item?.name || "—"} × ${d.quantity}`}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{d.location ?? "—"}</td>
              </tr>
            ))}
            {beneficiary.distributions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">لا توجد توزيعات مسجّلة</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
