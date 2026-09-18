// شريط تحذير الميزانية — يُعرض في صفحة تفاصيل المنحة وفي نموذج طلب الشراء
"use client";

type WarningLevel = "ok" | "warning" | "critical" | "blocked";

type Props = {
  lineName:        string;
  plannedAmount:   number;
  spentAmount:     number;
  committedAmount: number;
  warningThreshold?: number;  // % افتراضي 80
  blockThreshold?:   number;  // % افتراضي 100
  currency?:         string;
  compact?:          boolean;
};

export default function BudgetWarningBar({
  lineName, plannedAmount, spentAmount, committedAmount,
  warningThreshold = 80, blockThreshold = 100,
  currency = "USD", compact = false,
}: Props) {
  const used     = spentAmount + committedAmount;
  const pct      = plannedAmount > 0 ? (used / plannedAmount) * 100 : 0;
  const remaining = Math.max(0, plannedAmount - used);

  const level: WarningLevel =
    pct >= blockThreshold   ? "blocked"  :
    pct >= 95               ? "critical" :
    pct >= warningThreshold ? "warning"  : "ok";

  const styles: Record<WarningLevel, {
    bar: string; badge: string; icon: string; text: string; bg: string; border: string;
  }> = {
    ok:       { bar:"bg-[#0F6E56]",  badge:"bg-[#001A12] text-[#1D9E75] border-[#0F3D28]", icon:"ti-circle-check",   text:"text-[#1D9E75]", bg:"",            border:"border-[#1F2937]" },
    warning:  { bar:"bg-[#EF9F27]",  badge:"bg-[#271E0A] text-[#EF9F27] border-[#3D2E00]", icon:"ti-alert-triangle", text:"text-[#EF9F27]", bg:"bg-[#0D0A00]", border:"border-[#3D2E00]" },
    critical: { bar:"bg-[#E07020]",  badge:"bg-[#2A1800] text-[#E07020] border-[#4A2800]", icon:"ti-flame",          text:"text-[#E07020]", bg:"bg-[#150900]", border:"border-[#4A2800]" },
    blocked:  { bar:"bg-[#E24B4A]",  badge:"bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]", icon:"ti-lock",           text:"text-[#E24B4A]", bg:"bg-[#150808]", border:"border-[#4A1C20]" },
  };
  const s = styles[level];

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <span className={`text-[11px] font-semibold tabular-nums ${s.text}`}>{pct.toFixed(0)}%</span>
        {level !== "ok" && <i className={`ti ${s.icon} text-[13px] ${s.text}`} />}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${s.border} ${s.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {level !== "ok" && <i className={`ti ${s.icon} text-[16px] ${s.text}`} />}
          <span className="text-sm font-medium text-[#D1D5DB]">{lineName}</span>
        </div>
        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${s.badge}`}>
          {level === "blocked"  ? "🔴 ميزانية مستنفدة" :
           level === "critical" ? "🟠 تحذير حرج"       :
           level === "warning"  ? "🟡 تنبيه ميزانية"   : "✅ ضمن الحد"}
        </span>
      </div>

      {/* شريط التقدم */}
      <div className="space-y-1.5">
        <div className="h-2 bg-[#1F2937] rounded-full overflow-hidden flex">
          {/* المنفق الفعلي */}
          <div className="bg-[#0F6E56] h-full" style={{ width: `${Math.min(spentAmount/plannedAmount*100, 100)}%` }} />
          {/* الملتزم */}
          <div className="bg-[#EF9F27]/60 h-full" style={{ width: `${Math.min(committedAmount/plannedAmount*100, 100 - spentAmount/plannedAmount*100)}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-[#4B5563]">
          <span>{fmt(used)} {currency} مُستخدم</span>
          <span className={`font-semibold ${s.text} tabular-nums`}>{pct.toFixed(1)}%</span>
          <span>{fmt(plannedAmount)} {currency} المخطط</span>
        </div>
      </div>

      {/* تفاصيل */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label:"منفق", value: fmt(spentAmount),     color:"text-[#1D9E75]" },
          { label:"ملتزم", value: fmt(committedAmount), color:"text-[#EF9F27]" },
          { label:"متبقي", value: fmt(remaining),       color: level === "blocked" ? "text-[#E24B4A]" : "text-[#D1D5DB]" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#0F1117] rounded-lg p-2 text-center">
            <p className="text-[10px] text-[#4B5563] mb-0.5">{label}</p>
            <p className={`text-sm font-semibold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {level === "blocked" && (
        <p className="text-xs text-[#E24B4A] flex items-center gap-1 pt-1">
          <i className="ti ti-ban" />
          الطلبات الجديدة على هذا البند محجوبة تلقائياً
        </p>
      )}
    </div>
  );
}
