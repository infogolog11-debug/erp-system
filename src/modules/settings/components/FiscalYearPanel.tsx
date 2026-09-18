"use client";
import { useState, useTransition } from "react";
import { toggleFiscalPeriod }      from "@/modules/settings/fiscal-year-actions";

type Year   = { id:string; name:string; year:number; startDate:string; endDate:string; status:string; isCurrent:boolean };
type Period = { id:string; name:string; monthNumber:number; fiscalYearId:string; startDate:string; endDate:string; isClosed:boolean; closedAt:string|null; closedBy:string|null };

const MONTH_AR = ["","يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

export default function FiscalYearPanel({ orgId, userId, years, periods }: {
  orgId:string; userId:string; years:Year[]; periods:Period[];
}) {
  const [activeYear, setActiveYear] = useState(years.find(y => y.isCurrent)?.id ?? years[0]?.id ?? "");
  const [localPeriods, setLocalPeriods] = useState(periods);
  const [isPending, start]  = useTransition();
  const [toggling, setTog]  = useState<string|null>(null);
  const [msg, setMsg]       = useState("");

  const currentYear   = years.find(y => y.id === activeYear);
  const yearPeriods   = localPeriods.filter(p => p.fiscalYearId === activeYear)
    .sort((a,b) => a.monthNumber - b.monthNumber);
  const closedCount   = yearPeriods.filter(p => p.isClosed).length;
  const openCount     = yearPeriods.filter(p => !p.isClosed).length;

  function toggle(p: Period) {
    setTog(p.id); setMsg("");
    start(async () => {
      const res = await toggleFiscalPeriod(p.id, !p.isClosed, userId, orgId);
      if (res.success) {
        setLocalPeriods(prev => prev.map(lp => lp.id === p.id
          ? { ...lp, isClosed:!p.isClosed, closedAt:!p.isClosed ? new Date().toISOString() : null, closedBy:!p.isClosed ? userId : null }
          : lp
        ));
        setMsg(res.data?.msg ?? "");
      }
      setTog(null);
    });
  }

  function closeAll() {
    const open = yearPeriods.filter(p => !p.isClosed);
    open.forEach(p => toggle(p));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-calendar-stats text-[#0F6E56]" />السنة المالية والفترات
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">إقفال الفترات المحاسبية — يمنع إضافة قيود على فترات مقفلة</p>
        </div>
        {msg && <p className="text-xs text-[#1D9E75] flex items-center gap-1"><i className="ti ti-check" />{msg}</p>}
      </div>

      {/* اختيار السنة */}
      <div className="flex gap-2">
        {years.map(y => (
          <button key={y.id} onClick={() => setActiveYear(y.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeYear === y.id ? "bg-[#0F6E56] text-white font-medium" : "bg-[#0F1117] border border-[#1F2937] text-[#6B7280] hover:text-white"
            }`}>
            <i className={`ti ti-calendar text-[13px]`} />
            {y.year} — {y.name}
            {y.isCurrent && <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md">الحالية</span>}
          </button>
        ))}
      </div>

      {currentYear && (
        <>
          {/* ملخص السنة */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label:"السنة",        value:currentYear.year.toString(),    icon:"ti-calendar",       color:"text-[#D1D5DB]" },
              { label:"من",           value:currentYear.startDate,          icon:"ti-calendar-event", color:"text-[#9CA3AF]"  },
              { label:"إلى",          value:currentYear.endDate,            icon:"ti-calendar-due",   color:"text-[#9CA3AF]"  },
              { label:"الفترات المقفلة",value:`${closedCount} / ${yearPeriods.length}`, icon:"ti-lock", color:closedCount===yearPeriods.length?"text-[#E24B4A]":closedCount>0?"text-[#EF9F27]":"text-[#1D9E75]" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-[#0F1117] border border-[#1F2937] rounded-xl p-4 text-center">
                <i className={`ti ${icon} ${color} text-[18px] mb-1`} />
                <p className={`text-sm font-semibold ${color}`}>{value}</p>
                <p className="text-[10px] text-[#4B5563] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* جدول الفترات */}
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
              <h2 className="text-sm font-semibold text-white">الفترات المحاسبية — {currentYear.year}</h2>
              {openCount > 0 && (
                <button onClick={closeAll} disabled={isPending}
                  className="flex items-center gap-1.5 text-xs text-[#E24B4A] border border-[#4A1C20] bg-[#2A1215] hover:bg-[#3A1A1E] px-3 py-1.5 rounded-lg transition-all">
                  <i className="ti ti-lock" />إقفال جميع الفترات المفتوحة ({openCount})
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#1F2937]">
              {yearPeriods.map(p => {
                const isToggling = toggling === p.id;
                return (
                  <div key={p.id}
                    className={`p-4 flex items-center justify-between transition-colors ${
                      p.isClosed ? "bg-[#0A0F15]" : "bg-[#0F1117] hover:bg-[#141920]"
                    }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${p.isClosed ? "text-[#4B5563]" : "text-[#D1D5DB]"}`}>
                          {MONTH_AR[p.monthNumber]}
                        </span>
                        {p.isClosed && (
                          <span className="text-[10px] bg-[#2A1215] text-[#E24B4A] border border-[#4A1C20] px-1.5 py-0.5 rounded-md font-medium">
                            مقفلة
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#4B5563] mt-0.5">
                        {p.startDate} — {p.endDate}
                      </p>
                      {p.closedAt && (
                        <p className="text-[10px] text-[#2D3748] mt-0.5">
                          أُقفلت: {new Date(p.closedAt).toLocaleDateString("ar")}
                        </p>
                      )}
                    </div>
                    <button onClick={() => toggle(p)} disabled={isToggling || isPending}
                      className={`p-2 rounded-xl transition-all ${
                        p.isClosed
                          ? "text-[#4B5563] hover:text-[#1D9E75] hover:bg-[#001A12]"
                          : "text-[#1D9E75] hover:text-[#E24B4A] hover:bg-[#2A1215]"
                      } disabled:opacity-40`}
                      title={p.isClosed ? "إعادة فتح" : "إقفال"}>
                      {isToggling
                        ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        : <i className={`ti ${p.isClosed ? "ti-lock-open" : "ti-lock"} text-[18px]`} />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
