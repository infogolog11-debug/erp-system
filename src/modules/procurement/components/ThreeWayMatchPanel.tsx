// لوحة المطابقة الثلاثية — تُعرض في صفحة الفاتورة
"use client";
import { useState, useTransition } from "react";
import { applyMatchingResult } from "@/lib/procurement/three-way-match";
import type { AppLocale } from "@/lib/preferences";
import { getLocaleTag } from "@/lib/i18n";

type Variance = {
  itemDescription: string;
  poQty: number; receivedQty: number; invoicedQty: number;
  poUnitPrice: number; invoiceUnitPrice: number;
  qtyVariance: number; priceVariance: number;
  qtyVariancePct: number; priceVariancePct: number;
  status: "matched"|"qty_over"|"qty_short"|"price_mismatch"|"not_received";
};

type MatchResult = {
  overallStatus:    "fully_matched"|"partial_match"|"mismatch"|"pending_grn";
  canApprovePayment: boolean;
  totalPoAmount:     number;
  totalReceivedValue: number;
  totalInvoiceAmount: number;
  amountVariance:    number;
  variances:         Variance[];
  summary:           string;
};

export default function ThreeWayMatchPanel({
  invoiceId, userId, initialResult, locale = "ar",
}: {
  invoiceId: string; userId: string; initialResult?: MatchResult | null; locale?: AppLocale;
}) {
  const [result, setResult] = useState<MatchResult | null>(initialResult ?? null);
  const [isPending, start]  = useTransition();
  const [error, setError]   = useState("");
  const localeTag = getLocaleTag(locale);
  const statusItem: Record<string, { icon: string; color: string; label: string }> = locale === "ar"
    ? {
        matched:       { icon:"ti-check",          color:"text-[#1D9E75]", label:"مطابق" },
        qty_over:      { icon:"ti-arrow-up",       color:"text-[#EF9F27]", label:"كمية زائدة" },
        qty_short:     { icon:"ti-arrow-down",     color:"text-[#E24B4A]", label:"كمية ناقصة" },
        price_mismatch:{ icon:"ti-currency-dollar",color:"text-[#E24B4A]", label:"سعر مختلف" },
        not_received:  { icon:"ti-package-off",    color:"text-[#E24B4A]", label:"لم يُستلم" },
      }
    : {
        matched:       { icon:"ti-check",          color:"text-[#1D9E75]", label:"Matched" },
        qty_over:      { icon:"ti-arrow-up",       color:"text-[#EF9F27]", label:"Qty over" },
        qty_short:     { icon:"ti-arrow-down",     color:"text-[#E24B4A]", label:"Qty short" },
        price_mismatch:{ icon:"ti-currency-dollar",color:"text-[#E24B4A]", label:"Price mismatch" },
        not_received:  { icon:"ti-package-off",    color:"text-[#E24B4A]", label:"Not received" },
      };
  const t = locale === "ar"
    ? {
        title: "المطابقة الثلاثية",
        rerun: "إعادة المطابقة",
        run: "تشغيل المطابقة",
        empty: "اضغط \"تشغيل المطابقة\" للتحقق من PO · GRN · الفاتورة",
        poValue: "قيمة PO",
        receivedValue: "قيمة المستلم",
        invoiceValue: "قيمة الفاتورة",
        difference: "فارق",
        invoiceHigher: "الفاتورة أعلى",
        invoiceLower: "الفاتورة أقل",
        item: "الصنف",
        poQty: "كمية PO",
        received: "مستلم",
        invoiced: "فاتورة",
        poPrice: "سعر PO",
        invoicePrice: "سعر فاتورة",
        status: "الحالة",
        paymentAllowed: "مؤهل للدفع — المطابقة ناجحة",
        paymentBlocked: "محجوب من الدفع — يتطلب مراجعة",
      }
    : {
        title: "Three-way match",
        rerun: "Run again",
        run: "Run match",
        empty: "Click \"Run match\" to validate PO · GRN · Invoice",
        poValue: "PO value",
        receivedValue: "Received value",
        invoiceValue: "Invoice value",
        difference: "Difference",
        invoiceHigher: "Invoice is higher",
        invoiceLower: "Invoice is lower",
        item: "Item",
        poQty: "PO qty",
        received: "Received",
        invoiced: "Invoice",
        poPrice: "PO price",
        invoicePrice: "Invoice price",
        status: "Status",
        paymentAllowed: "Eligible for payment — match successful",
        paymentBlocked: "Blocked from payment — review required",
      };

  function runMatch() {
    setError("");
    start(async () => {
      const res = await applyMatchingResult(invoiceId, userId);
      if (res.success) setResult(res.data);
      else setError(res.error);
    });
  }

  const overallStyles: Record<string, { badge: string; bg: string; border: string }> = {
    fully_matched:  { badge:"bg-[#001A12] text-[#1D9E75] border-[#0F3D28]", bg:"",             border:"border-[#1F2937]" },
    partial_match:  { badge:"bg-[#271E0A] text-[#EF9F27] border-[#3D2E00]", bg:"bg-[#0D0A00]", border:"border-[#3D2E00]" },
    mismatch:       { badge:"bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]", bg:"bg-[#150808]", border:"border-[#4A1C20]" },
    pending_grn:    { badge:"bg-[#0A1628] text-[#378ADD] border-[#1A3060]", bg:"",             border:"border-[#1A3060]" },
  };

  const fmt = (n: number) => n.toLocaleString(localeTag, { maximumFractionDigits: 2 });

  return (
    <div className={`bg-[#0F1117] border rounded-2xl p-5 space-y-4 ${result ? overallStyles[result.overallStatus].border : "border-[#1F2937]"}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-git-compare text-[#0F6E56]" />
          {t.title}
        </h2>
        <button onClick={runMatch} disabled={isPending}
          className="flex items-center gap-1.5 text-xs bg-[#161B26] hover:bg-[#1F2937] border border-[#2D3748] text-[#D1D5DB] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
          {isPending
            ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            : <i className="ti ti-refresh" />
          }
          {result ? t.rerun : t.run}
        </button>
      </div>

      {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

      {!result && !isPending && (
        <div className="text-center py-8 text-[#4B5563]">
          <i className="ti ti-git-compare text-[40px] text-[#1F2937]" />
          <p className="text-sm mt-2">{t.empty}</p>
        </div>
      )}

      {result && (
        <>
          {/* الملخص */}
          <div className="p-3 rounded-xl bg-[#161B26] border border-[#2D3748]">
            <p className="text-sm text-white">{result.summary}</p>
          </div>

          {/* الأرقام الثلاثة */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label:t.poValue,       value: result.totalPoAmount,        color:"text-[#D1D5DB]" },
              { label:t.receivedValue,  value: result.totalReceivedValue,   color:"text-[#1D9E75]" },
              { label:t.invoiceValue, value: result.totalInvoiceAmount,   color: Math.abs(result.amountVariance) > 0 ? "text-[#E24B4A]" : "text-[#1D9E75]" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0F1117] border border-[#1F2937] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[#4B5563] mb-1">{label}</p>
                <p className={`text-sm font-semibold tabular-nums ${color}`}>{fmt(value)}</p>
              </div>
            ))}
          </div>
          {Math.abs(result.amountVariance) > 0 && (
            <p className="text-xs text-[#E24B4A] flex items-center gap-1">
              <i className="ti ti-alert-triangle" />
              {t.difference}: {fmt(Math.abs(result.amountVariance))} ({result.amountVariance > 0 ? t.invoiceHigher : t.invoiceLower})
            </p>
          )}

          {/* جدول البنود */}
          <div className="overflow-hidden rounded-xl border border-[#1F2937]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1F2937] bg-[#161B26]">
                  {[t.item,t.poQty,t.received,t.invoiced,t.poPrice,t.invoicePrice,t.status].map(h => (
                    <th key={h} className="text-right text-[#6B7280] font-medium px-3 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.variances.map((v, i) => {
                  const st = statusItem[v.status];
                  return (
                    <tr key={i} className={`border-b border-[#1F2937] last:border-0 ${v.status !== "matched" ? "bg-[#150808]" : ""}`}>
                      <td className="px-3 py-2.5 text-[#D1D5DB] font-medium max-w-[120px] truncate">{v.itemDescription}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#9CA3AF]">{v.poQty}</td>
                      <td className={`px-3 py-2.5 tabular-nums font-medium ${v.qtyVariance !== 0 ? "text-[#E24B4A]" : "text-[#1D9E75]"}`}>{v.receivedQty}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#9CA3AF]">{v.invoicedQty}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#9CA3AF]">{fmt(v.poUnitPrice)}</td>
                      <td className={`px-3 py-2.5 tabular-nums ${v.priceVariance !== 0 ? "text-[#E24B4A]" : "text-[#9CA3AF]"}`}>{fmt(v.invoiceUnitPrice)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`flex items-center gap-1 ${st.color}`}>
                          <i className={`ti ${st.icon} text-[12px]`} />{st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* القرار النهائي */}
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${result.canApprovePayment ? "border-[#0F3D28] bg-[#001A12]" : "border-[#4A1C20] bg-[#2A1215]"}`}>
            <i className={`ti text-[20px] ${result.canApprovePayment ? "ti-check text-[#1D9E75]" : "ti-ban text-[#E24B4A]"}`} />
            <p className={`text-sm font-medium ${result.canApprovePayment ? "text-[#1D9E75]" : "text-[#E24B4A]"}`}>
              {result.canApprovePayment ? t.paymentAllowed : t.paymentBlocked}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
