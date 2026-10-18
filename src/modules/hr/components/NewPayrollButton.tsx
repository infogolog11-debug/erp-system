"use client";
import { useState, useTransition } from "react";
import { processPayroll }          from "@/modules/hr/actions";
import { useRouter }               from "next/navigation";
import type { AppLocale }          from "@/lib/preferences";

export default function NewPayrollButton({ orgId, userId, locale = "ar" }: { orgId:string; userId:string; locale?:AppLocale }) {
  const [show, setShow]   = useState(false);
  const now               = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [isPending, start]= useTransition();
  const [error, setError] = useState("");
  const router            = useRouter();

  const isAr = locale === "ar";
  const monthNames = isAr
    ? ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"]
    : ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const t = isAr ? {
    open:"معالجة كشف جديد",
    title:"معالجة كشف رواتب",
    month:"الشهر",
    year:"السنة",
    hint:"سيتم احتساب الرواتب لجميع الموظفين النشطين بناءً على الإعدادات الديناميكية الحالية (نسب الضريبة، الضمان، الأوفرتايم).",
    start:"بدء المعالجة",
    errorFallback:"حدث خطأ",
  } : {
    open:"Process new run",
    title:"Process payroll run",
    month:"Month",
    year:"Year",
    hint:"Payroll will be calculated for all active employees based on the current dynamic settings (tax rates, insurance, overtime).",
    start:"Start processing",
    errorFallback:"An error occurred",
  };

  function submit() {
    setError("");
    start(async () => {
      const res = await processPayroll(orgId, month, year, userId);
      if (res.success) { setShow(false); router.refresh(); }
      else setError(res.error ?? t.errorFallback);
    });
  }

  return (
    <>
      <button onClick={() => setShow(true)}
        className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
        <i className="ti ti-plus" />{t.open}
      </button>
      {show && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{t.title}</h2>
              <button onClick={() => setShow(false)} className="text-[#4B5563] hover:text-white">
                <i className="ti ti-x text-[18px]" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#6B7280] block mb-1.5">{t.month}</label>
                <select value={month} onChange={e => setMonth(Number(e.target.value))}
                  className="w-full bg-[#161B26] border border-[#2D3748] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0F6E56]">
                  {monthNames.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#6B7280] block mb-1.5">{t.year}</label>
                <select value={year} onChange={e => setYear(Number(e.target.value))}
                  className="w-full bg-[#161B26] border border-[#2D3748] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#0F6E56]">
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-[#161B26] border border-[#2D3748] rounded-xl p-3 text-xs text-[#9CA3AF]">
              {t.hint}
            </div>
            {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
            <button onClick={submit} disabled={isPending}
              className="w-full flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all">
              {isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                : <i className="ti ti-moneybag" />
              }
              {t.start}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
