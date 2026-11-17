// src/modules/vendors/components/TenderForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commonCopy } from "@/lib/i18n";
import type { AppLocale } from "@/lib/preferences";
import { createTender } from "@/modules/vendors/actions";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";
function F({ label, required, children }: { label:string; required?:boolean; children:React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required && <span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>;
}

export default function TenderForm({ currencies, organizationId, userId, locale = "ar" }: { currencies:Array<{id:string;code:string;name:string}>; organizationId:string; userId:string; locale?: AppLocale }) {
  const router = useRouter();
  const t = commonCopy[locale];
  const copy = {
    basicInfo: locale === "ar" ? "معلومات المناقصة" : "Tender information",
    code: locale === "ar" ? "الكود" : "Code",
    title: locale === "ar" ? "العنوان" : "Title",
    titleAr: locale === "ar" ? "العنوان بالعربية" : "Arabic title",
    category: locale === "ar" ? "التصنيف" : "Category",
    estimatedValue: locale === "ar" ? "القيمة التقديرية" : "Estimated value",
    currency: locale === "ar" ? "العملة" : "Currency",
    submissionDeadline: locale === "ar" ? "آخر موعد للتقديم" : "Submission deadline",
    openingDate: locale === "ar" ? "تاريخ الفتح" : "Opening date",
    description: locale === "ar" ? "الوصف" : "Description",
    saveTender: locale === "ar" ? "حفظ المناقصة" : "Save tender",
  } as const;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code:"", title:"", titleAr:"", category:"", estimatedValue:"",
    currencyId:"", submissionDeadline:"", openingDate:"", description:"",
  });
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createTender({
        organizationId,
        code:               form.code,
        title:              form.title,
        titleAr:            form.titleAr || undefined,
        category:           form.category,
        description:        form.description || undefined,
        estimatedValue:     form.estimatedValue === "" ? undefined : Number(form.estimatedValue),
        currencyId:         form.currencyId || undefined,
        submissionDeadline: form.submissionDeadline,
        openingDate:        form.openingDate || undefined,
      }, userId);
      if (res.success) router.push(`/vendors/tenders/${res.data.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]"><i className="ti ti-alert-circle" />{error}</div>}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{copy.basicInfo}</h2>
        <div className="grid grid-cols-3 gap-4">
          <F label={copy.code} required><input value={form.code} onChange={e=>upd("code",e.target.value)} className={inputCls} placeholder={locale === "ar" ? "مثال: TND-001" : "e.g. TND-001"} required dir="ltr" /></F>
          <F label={copy.title} required><input value={form.title} onChange={e=>upd("title",e.target.value)} className={inputCls} placeholder={locale === "ar" ? "عنوان المناقصة" : "Tender title"} required /></F>
          <F label={copy.titleAr}><input value={form.titleAr} onChange={e=>upd("titleAr",e.target.value)} className={inputCls} placeholder={locale === "ar" ? "العنوان بالعربية" : "Title in Arabic"} /></F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label={copy.category} required><input value={form.category} onChange={e=>upd("category",e.target.value)} className={inputCls} placeholder={locale === "ar" ? "مثال: إنشاءات" : "e.g. Construction"} required /></F>
          <F label={copy.estimatedValue}><input type="number" min="0" step="0.01" value={form.estimatedValue} onChange={e=>upd("estimatedValue",e.target.value)} className={inputCls} placeholder="0.00" dir="ltr" /></F>
          <F label={copy.currency}>
            <select value={form.currencyId} onChange={e=>upd("currencyId",e.target.value)} className={inputCls+" cursor-pointer"}>
              <option value="">{t.select}</option>
              {currencies.map((c:any) => <option key={c.id} value={c.id}>{c.code}{c.name ? ` — ${c.name}` : ""}</option>)}
            </select>
          </F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label={copy.submissionDeadline} required><input type="date" value={form.submissionDeadline} onChange={e=>upd("submissionDeadline",e.target.value)} className={inputCls} required dir="ltr" /></F>
          <F label={copy.openingDate}><input type="date" value={form.openingDate} onChange={e=>upd("openingDate",e.target.value)} className={inputCls} dir="ltr" /></F>
        </div>
        <F label={copy.description}>
          <textarea value={form.description} onChange={e=>upd("description",e.target.value)} rows={4} className={inputCls+" resize-y"} placeholder={locale === "ar" ? "وصف المناقصة ونطاق العمل" : "Tender description and scope of work"} />
        </F>
      </div>

      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] transition-colors">{t.cancel}</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
          {isPending ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg> : <i className="ti ti-device-floppy" />}
          {copy.saveTender}
        </button>
      </div>
    </form>
  );
}
