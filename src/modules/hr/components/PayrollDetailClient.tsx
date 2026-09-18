"use client";
import { useState, useTransition } from "react";
import ExportButton from "@/components/shared/ExportButton";
import { approvePayroll, markPayrollPaid } from "@/modules/hr/actions";

type Run = { id:string; month:number; year:number; periodName:string; status:string; monthName:string; totalGross:number; totalDeductions:number; totalNet:number; employeeCount:number };
type Line = { id:string; employeeName:string; empCode:string; baseSalary:number; adjustedBase:number; housingAllowance:number; transportAllowance:number; performanceBonus:number; overtimePay:number; otherAllowances:number; totalAllowances:number; absentDeduction:number; incomeTax:number; socialSecurity:number; loanDeduction:number; otherDeductions:number; totalDeductions:number; grossSalary:number; netSalary:number; daysPresent:number; daysAbsent:number; overtimeHours:number; paymentStatus:string; isPaid:boolean };

const STATUS: Record<string,{ label:string; color:string; bg:string; border:string }> = {
  draft:      { label:"مسودة",       color:"text-[#4B5563]",  bg:"bg-[#161B26]", border:"border-[#2D3748]" },
  processing: { label:"قيد المعالجة",color:"text-[#EF9F27]",  bg:"bg-[#1A1400]", border:"border-[#3D2E00]" },
  approved:   { label:"معتمد",       color:"text-[#378ADD]",  bg:"bg-[#0A1628]", border:"border-[#1A3060]" },
  paid:       { label:"مدفوع",       color:"text-[#1D9E75]",  bg:"bg-[#001A12]", border:"border-[#0F3D28]" },
};

export default function PayrollDetailClient({ run, lines, orgId, userId, role }: {
  run:Line extends never ? never : Run; lines:Line[]; orgId:string; userId:string; role:string;
}) {
  const [expanded, setExpanded]   = useState<string|null>(null);
  const [isPending, start]        = useTransition();
  const [msg, setMsg]             = useState("");
  const s = STATUS[run.status] ?? STATUS.draft;
  const fmt = (n:number) => n.toLocaleString("en-US", { maximumFractionDigits:2 });
  const canApprove = (role==="admin"||role==="finance") && run.status==="processing";
  const canPay     = (role==="admin"||role==="finance") && run.status==="approved";

  function doApprove() {
    start(async () => {
      const res = await approvePayroll(run.id, userId, orgId);
      setMsg(res.success ? "✅ تم اعتماد الكشف" : `❌ ${res.error}`);
    });
  }
  function doPay() {
    start(async () => {
      const res = await markPayrollPaid(run.id, userId, orgId);
      setMsg(res.success ? "✅ تم تسجيل الدفع" : `❌ ${res.error}`);
    });
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{run.periodName}</span>
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.bg} ${s.color} ${s.border}`}>{s.label}</span>
          </div>
          <h1 className="text-2xl font-semibold text-white">كشف رواتب {run.monthName} {run.year}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{run.employeeCount} موظف</p>
        </div>
        {/* الإجراءات */}
        <div className="flex items-center gap-2">
          {msg && <p className="text-xs text-[#1D9E75]">{msg}</p>}
          <ExportButton
            apiPath={`/api/export/payroll/${run.id}`}
            filename={`payroll-${run.periodName}`}
          />
          {canApprove && (
            <button onClick={doApprove} disabled={isPending}
              className="flex items-center gap-2 bg-[#378ADD] hover:bg-[#4A9AE8] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
              <i className="ti ti-shield-check" />اعتماد الكشف
            </button>
          )}
          {canPay && (
            <button onClick={doPay} disabled={isPending}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all disabled:opacity-50">
              <i className="ti ti-cash" />تسجيل الدفع
            </button>
          )}
        </div>
      </div>

      {/* ملخص إجمالي */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:"إجمالي الرواتب",  value:run.totalGross,      color:"text-[#D1D5DB]", icon:"ti-moneybag"     },
          { label:"إجمالي الخصومات", value:run.totalDeductions,  color:"text-[#E24B4A]", icon:"ti-minus-circle" },
          { label:"إجمالي الصافي",   value:run.totalNet,        color:"text-[#1D9E75]", icon:"ti-circle-check" },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 text-center">
            <i className={`ti ${icon} text-[22px] ${color} mb-2`} />
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{fmt(value)}</p>
            <p className="text-xs text-[#4B5563] mt-1">{label} — USD</p>
          </div>
        ))}
      </div>

      {/* جدول الموظفين */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F2937] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ti ti-users text-[#0F6E56]" />تفاصيل الموظفين
          </h2>
          <span className="text-xs text-[#4B5563]">{lines.length} موظف</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#161B26]">
              {["الموظف","الراتب الأساسي","إجمالي البدلات","إجمالي الخصومات","الراتب الصافي","الدفع","تفاصيل"].map(h => (
                <th key={h} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <>
                <tr key={l.id}
                  className="border-b border-[#1F2937] hover:bg-[#161B26] transition-colors cursor-pointer"
                  onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#D1D5DB]">{l.employeeName}</p>
                    <p className="text-[10px] font-mono text-[#4B5563]">{l.empCode}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#9CA3AF]">{fmt(l.baseSalary)}</td>
                  <td className="px-4 py-3 tabular-nums text-[#1D9E75]">+{fmt(l.totalAllowances)}</td>
                  <td className="px-4 py-3 tabular-nums text-[#E24B4A]">-{fmt(l.totalDeductions)}</td>
                  <td className="px-4 py-3 tabular-nums font-semibold text-white">{fmt(l.netSalary)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                      l.isPaid ? "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]" :
                      l.paymentStatus === "on_hold" ? "bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]" :
                      "bg-[#1A1400] text-[#EF9F27] border-[#3D2E00]"
                    }`}>
                      {l.isPaid ? "مدفوع" : l.paymentStatus === "on_hold" ? "موقوف" : "معلق"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <i className={`ti ${expanded===l.id?"ti-chevron-up":"ti-chevron-down"} text-[#4B5563] text-[14px]`} />
                  </td>
                </tr>
                {expanded === l.id && (
                  <tr key={`${l.id}-detail`} className="border-b border-[#1F2937] bg-[#0A0F15]">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid grid-cols-2 gap-6">
                        {/* البدلات */}
                        <div>
                          <p className="text-xs font-semibold text-[#1D9E75] mb-2">البدلات والإضافات</p>
                          <div className="space-y-1.5">
                            {[
                              { label:"الراتب الأساسي",      value:l.baseSalary },
                              { label:"تعديل الغياب",         value:l.adjustedBase - l.baseSalary, diff:true },
                              { label:"بدل السكن",            value:l.housingAllowance },
                              { label:"بدل المواصلات",        value:l.transportAllowance },
                              { label:"مكافأة الأداء",        value:l.performanceBonus },
                              { label:"أجر الأوفرتايم",       value:l.overtimePay },
                              { label:"بدلات أخرى",           value:l.otherAllowances },
                            ].filter(r => r.value !== 0).map(({ label, value, diff }) => (
                              <div key={label} className="flex justify-between text-xs">
                                <span className="text-[#6B7280]">{label}</span>
                                <span className={`tabular-nums font-medium ${diff && value < 0 ? "text-[#E24B4A]" : "text-[#D1D5DB]"}`}>
                                  {diff && value > 0 ? "+" : ""}{fmt(value)}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs pt-1.5 border-t border-[#1F2937]">
                              <span className="text-[#9CA3AF] font-medium">الإجمالي</span>
                              <span className="tabular-nums font-bold text-[#1D9E75]">{fmt(l.grossSalary)}</span>
                            </div>
                          </div>
                        </div>
                        {/* الخصومات */}
                        <div>
                          <p className="text-xs font-semibold text-[#E24B4A] mb-2">الخصومات</p>
                          <div className="space-y-1.5">
                            {[
                              { label:"خصم الغياب",            value:l.absentDeduction },
                              { label:"ضريبة الدخل",           value:l.incomeTax },
                              { label:"الضمان الاجتماعي",      value:l.socialSecurity },
                              { label:"خصم القرض",             value:l.loanDeduction },
                              { label:"خصومات أخرى",           value:l.otherDeductions },
                            ].filter(r => r.value > 0).map(({ label, value }) => (
                              <div key={label} className="flex justify-between text-xs">
                                <span className="text-[#6B7280]">{label}</span>
                                <span className="tabular-nums font-medium text-[#E24B4A]">-{fmt(value)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-xs pt-1.5 border-t border-[#1F2937]">
                              <span className="text-[#9CA3AF] font-medium">الصافي النهائي</span>
                              <span className="tabular-nums font-bold text-[#1D9E75]">{fmt(l.netSalary)}</span>
                            </div>
                          </div>
                          {/* الحضور */}
                          <div className="mt-3 pt-3 border-t border-[#1F2937] flex items-center gap-4 text-[10px] text-[#4B5563]">
                            <span className="flex items-center gap-1"><i className="ti ti-calendar-check text-[#1D9E75]" />{l.daysPresent} حاضر</span>
                            <span className="flex items-center gap-1"><i className="ti ti-calendar-x text-[#E24B4A]" />{l.daysAbsent} غائب</span>
                            {l.overtimeHours > 0 && <span className="flex items-center gap-1"><i className="ti ti-clock text-[#EF9F27]" />{l.overtimeHours}س أوفرتايم</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
