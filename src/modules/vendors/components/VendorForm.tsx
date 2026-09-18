// src/modules/vendors/components/VendorForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";
function F({ label, required, children }: { label:string; required?:boolean; children:React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required && <span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>;
}

const VENDOR_TYPES = [
  {v:"supplier",l:"مورد بضائع"},{v:"contractor",l:"مقاول"},{v:"consultant",l:"استشاري"},{v:"individual",l:"فرد"},
];

export default function VendorForm({ currencies, organizationId, userId }: { currencies:Array<{id:string;code:string}>; organizationId:string; userId:string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name:"", nameAr:"", code:"", vendorType:"supplier",
    taxNumber:"", registrationNo:"", country:"", city:"", address:"",
    phone:"", email:"", website:"", preferredCurrencyId:"", paymentTermsDays:"30",
    contactName:"", contactTitle:"", contactEmail:"", contactPhone:"",
  });
  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      // TODO: استدعاء createVendor action
      router.push("/vendors");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]"><i className="ti ti-alert-circle" />{error}</div>}

      {/* المعلومات الأساسية */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">معلومات المورد</h2>
        <div className="grid grid-cols-2 gap-4">
          <F label="اسم المورد" required><input value={form.name} onChange={e=>upd("name",e.target.value)} className={inputCls} placeholder="Vendor Name" required /></F>
          <F label="الاسم بالعربية"><input value={form.nameAr} onChange={e=>upd("nameAr",e.target.value)} className={inputCls} placeholder="اسم المورد بالعربية" /></F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="الكود" required><input value={form.code} onChange={e=>upd("code",e.target.value)} className={inputCls} placeholder="VND-001" required dir="ltr" /></F>
          <F label="نوع المورد" required>
            <select value={form.vendorType} onChange={e=>upd("vendorType",e.target.value)} className={inputCls+" cursor-pointer"} required>
              {VENDOR_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </F>
          <F label="شروط الدفع (يوم)"><input type="number" value={form.paymentTermsDays} onChange={e=>upd("paymentTermsDays",e.target.value)} className={inputCls} placeholder="30" min="0" dir="ltr" /></F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="الرقم الضريبي"><input value={form.taxNumber} onChange={e=>upd("taxNumber",e.target.value)} className={inputCls} placeholder="رقم ضريبي" dir="ltr" /></F>
          <F label="رقم التسجيل التجاري"><input value={form.registrationNo} onChange={e=>upd("registrationNo",e.target.value)} className={inputCls} placeholder="رقم التسجيل" dir="ltr" /></F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="الدولة"><input value={form.country} onChange={e=>upd("country",e.target.value)} className={inputCls} placeholder="الأردن" /></F>
          <F label="المدينة"><input value={form.city} onChange={e=>upd("city",e.target.value)} className={inputCls} placeholder="عمان" /></F>
          <F label="العملة المفضلة">
            <select value={form.preferredCurrencyId} onChange={e=>upd("preferredCurrencyId",e.target.value)} className={inputCls+" cursor-pointer"}>
              <option value="">اختر...</option>
              {currencies.map((c:any) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </F>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="الهاتف"><input value={form.phone} onChange={e=>upd("phone",e.target.value)} className={inputCls} placeholder="+962..." dir="ltr" /></F>
          <F label="البريد الإلكتروني"><input type="email" value={form.email} onChange={e=>upd("email",e.target.value)} className={inputCls} placeholder="info@vendor.com" dir="ltr" /></F>
          <F label="الموقع الإلكتروني"><input value={form.website} onChange={e=>upd("website",e.target.value)} className={inputCls} placeholder="https://..." dir="ltr" /></F>
        </div>
      </div>

      {/* جهة الاتصال الأساسية */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">جهة الاتصال الأساسية</h2>
        <div className="grid grid-cols-2 gap-4">
          <F label="الاسم"><input value={form.contactName} onChange={e=>upd("contactName",e.target.value)} className={inputCls} placeholder="اسم المسؤول" /></F>
          <F label="المسمى الوظيفي"><input value={form.contactTitle} onChange={e=>upd("contactTitle",e.target.value)} className={inputCls} placeholder="مدير المبيعات" /></F>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <F label="البريد الإلكتروني"><input type="email" value={form.contactEmail} onChange={e=>upd("contactEmail",e.target.value)} className={inputCls} placeholder="contact@vendor.com" dir="ltr" /></F>
          <F label="الهاتف"><input value={form.contactPhone} onChange={e=>upd("contactPhone",e.target.value)} className={inputCls} placeholder="+962..." dir="ltr" /></F>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] transition-colors">إلغاء</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
          {isPending ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg> : <i className="ti ti-device-floppy" />}
          حفظ المورد
        </button>
      </div>
    </form>
  );
}
