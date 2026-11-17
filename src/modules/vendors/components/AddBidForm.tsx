// src/modules/vendors/components/AddBidForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { commonCopy } from "@/lib/i18n";
import type { AppLocale } from "@/lib/preferences";
import { addTenderBid } from "@/modules/vendors/actions";

const inputCls = "w-full bg-[#161B26] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] transition-all";

export default function AddBidForm({
  tenderId, organizationId, userId, vendors, currencies, locale = "ar",
}: {
  tenderId:string; organizationId:string; userId:string;
  vendors:Array<{id:string;name:string;code:string}>;
  currencies:Array<{id:string;code:string;name:string}>;
  locale?: AppLocale;
}) {
  const router = useRouter();
  const t = commonCopy[locale];
  const copy = {
    title: locale === "ar" ? "إضافة عرض" : "Add bid",
    vendor: locale === "ar" ? "المورد" : "Vendor",
    amount: locale === "ar" ? "قيمة العرض" : "Bid amount",
    currency: locale === "ar" ? "العملة" : "Currency",
    add: locale === "ar" ? "إضافة العرض" : "Add bid",
    noVendors: locale === "ar" ? "لا يوجد موردون مسجلون" : "No registered vendors",
  } as const;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [vendorId, setVendorId]     = useState("");
  const [bidAmount, setBidAmount]   = useState("");
  const [currencyId, setCurrencyId] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (!vendorId) { setError(copy.noVendors); return; }
    if (!currencyId) { setError(locale === "ar" ? "الرجاء اختيار العملة" : "Please select a currency"); return; }
    startTransition(async () => {
      const res = await addTenderBid({
        tenderId, organizationId,
        vendorId,
        bidAmount: Number(bidAmount),
        currencyId,
      }, userId);
      if (res.success) {
        setVendorId(""); setBidAmount(""); setCurrencyId("");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <i className="ti ti-file-plus text-[#0F6E56]" />{copy.title}
      </h2>

      {vendors.length === 0 ? (
        <p className="text-xs text-[#4B5563] py-1">{copy.noVendors}</p>
      ) : (
        <>
          <div>
            <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">{copy.vendor}</label>
            <select value={vendorId} onChange={e=>setVendorId(e.target.value)} className={inputCls+" cursor-pointer"}>
              <option value="">{t.select}</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.code} — {v.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">{copy.amount}</label>
              <input type="number" min="0" step="0.01" value={bidAmount} onChange={e=>setBidAmount(e.target.value)} className={inputCls} placeholder="0.00" dir="ltr" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[#9CA3AF] mb-1">{copy.currency}</label>
              <select value={currencyId} onChange={e=>setCurrencyId(e.target.value)} className={inputCls+" cursor-pointer"}>
                <option value="">{t.select}</option>
                {currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

          <button type="submit" disabled={isPending} className="w-full flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all">
            {isPending && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {copy.add}
          </button>
        </>
      )}
    </form>
  );
}
