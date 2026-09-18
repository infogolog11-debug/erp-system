"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

type LineVM = {
  id: string; name: string; nameAr: string | null; category: string;
  planned: number; committed: number; spent: number;
  warningThreshold: number; blockThreshold: number;
};
type GrantVM = {
  id: string; code: string; name: string; nameAr: string | null;
  currencyCode: string; startDate: string; endDate: string;
  totalAmount: number;
  planned: number; committed: number; spent: number; remaining: number;
  utilizationPct: number;
  lines: LineVM[];
};
type DonorVM = {
  id: string; name: string; nameAr: string | null; donorType: string;
  grants: GrantVM[];
  totalPlanned: number; totalCommitted: number; totalSpent: number;
};

const DONOR_TYPE_AR: Record<string,string> = {
  bilateral: "ثنائي", multilateral: "متعدد الأطراف", private: "خاص", government: "حكومي",
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n/1_000_000).toFixed(2)}M` :
  n >= 1_000     ? `${(n/1_000).toFixed(1)}K` :
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

function utilColor(pct: number, warn: number, block: number) {
  if (pct >= block) return "#E24B4A";   // تجاوز — أحمر
  if (pct >= warn)  return "#EF9F27";   // تحذير — برتقالي
  return "#1D9E75";                     // آمن — أخضر
}

function ProgressRow({ label, planned, committed, spent, warn=80, block=100, currencyCode }: {
  label: string; planned: number; committed: number; spent: number;
  warn?: number; block?: number; currencyCode: string;
}) {
  const used = committed + spent;
  const pct  = planned > 0 ? (used/planned*100) : 0;
  const color = utilColor(pct, warn, block);
  const remaining = planned - used;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-[#D1D5DB]">{label}</span>
        <span className="text-[#9CA3AF] tabular-nums">
          {fmt(used)} / {fmt(planned)} {currencyCode}
          <span className="mx-1.5 text-[#4B5563]">·</span>
          <span style={{ color }} className="font-semibold">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="h-2 bg-[#1F2937] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(pct,100).toFixed(1)}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
        <span>ملتزم: {fmt(committed)}</span>
        <span>منفق: {fmt(spent)}</span>
        <span className={remaining < 0 ? "text-[#E24B4A] font-semibold" : ""}>متبقي: {fmt(remaining)}</span>
      </div>
    </div>
  );
}

function GrantCard({ grant }: { grant: GrantVM }) {
  const [open, setOpen] = useState(false);
  const color = utilColor(grant.utilizationPct, 80, 100);

  return (
    <div className="rounded-lg border border-[#1F2937] bg-[#111827] overflow-hidden">
      <button
        onClick={() => setOpen(o=>!o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1A2332] transition-colors"
      >
        <div className="flex items-center gap-3 text-right">
          <i className={`ti ti-chevron-${open ? "down" : "left"} text-[#6B7280] text-sm`} />
          <div>
            <div className="text-[13px] font-medium text-white">{grant.nameAr || grant.name}</div>
            <div className="text-[11px] text-[#6B7280]">{grant.code} · {grant.currencyCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[11px] text-[#6B7280]">
            {new Date(grant.startDate).toLocaleDateString("ar")} – {new Date(grant.endDate).toLocaleDateString("ar")}
          </span>
          <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
            {grant.utilizationPct.toFixed(0)}%
          </span>
        </div>
      </button>
      <div className="px-4 pb-3">
        <ProgressRow
          label="إجمالي المنحة"
          planned={grant.planned} committed={grant.committed} spent={grant.spent}
          currencyCode={grant.currencyCode}
        />
      </div>
      {open && (
        <div className="border-t border-[#1F2937] px-4 py-3 space-y-3 bg-[#0B0F17]">
          {grant.lines.length === 0 && (
            <p className="text-[11px] text-[#6B7280]">لا توجد بنود ميزانية مُعرّفة لهذه المنحة</p>
          )}
          {grant.lines.map(l => (
            <ProgressRow
              key={l.id}
              label={l.nameAr || l.name}
              planned={l.planned} committed={l.committed} spent={l.spent}
              warn={l.warningThreshold} block={l.blockThreshold}
              currencyCode={grant.currencyCode}
            />
          ))}
          <Link
            href={`/grants/${grant.id}`}
            className="inline-flex items-center gap-1 text-[11px] text-[#0F6E56] hover:text-[#1D9E75] pt-1"
          >
            عرض تفاصيل المنحة <i className="ti ti-arrow-left text-xs" />
          </Link>
        </div>
      )}
    </div>
  );
}

export default function BudgetVsActualView({ donors }: { donors: DonorVM[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(
    () => filter === "all" ? donors : donors.filter(d => d.id === filter),
    [donors, filter]
  );

  const grandPlanned   = donors.reduce((s,d)=>s+d.totalPlanned,0);
  const grandCommitted = donors.reduce((s,d)=>s+d.totalCommitted,0);
  const grandSpent     = donors.reduce((s,d)=>s+d.totalSpent,0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <i className="ti ti-report-money text-[#0F6E56]" />الميزانية مقابل الفعلي حسب المانح
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-1">Budget vs Actual by Donor</p>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-[#111827] border border-[#1F2937] text-[13px] text-[#D1D5DB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#0F6E56]"
        >
          <option value="all">كل المانحين</option>
          {donors.map(d => (
            <option key={d.id} value={d.id}>{d.nameAr || d.name}</option>
          ))}
        </select>
      </div>

      {/* ملخص عام */}
      <div className="rounded-xl border border-[#1F2937] bg-[#111827] p-5">
        <ProgressRow
          label="الإجمالي العام لكل المانحين"
          planned={grandPlanned} committed={grandCommitted} spent={grandSpent}
          currencyCode=""
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[13px] text-[#6B7280] py-10">لا توجد بيانات منح لعرضها</p>
      )}

      <div className="space-y-6">
        {filtered.map(donor => {
          const used = donor.totalCommitted + donor.totalSpent;
          const pct  = donor.totalPlanned > 0 ? (used/donor.totalPlanned*100) : 0;
          const color = utilColor(pct, 80, 100);
          return (
            <div key={donor.id} className="rounded-xl border border-[#1F2937] bg-[#0B0F17] p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <i className="ti ti-building-bank text-[#378ADD]" />
                  <h2 className="text-[15px] font-semibold text-white">{donor.nameAr || donor.name}</h2>
                  <span className="text-[11px] text-[#6B7280] bg-[#1F2937] px-2 py-0.5 rounded-full">
                    {DONOR_TYPE_AR[donor.donorType] ?? donor.donorType}
                  </span>
                </div>
                <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
                  نسبة الصرف الكلية: {pct.toFixed(0)}%
                </span>
              </div>

              <div className="grid gap-3">
                {donor.grants.map(g => <GrantCard key={g.id} grant={g} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
