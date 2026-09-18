// src/modules/grants/components/GrantKanban.tsx
"use client";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const COLUMNS = [
  { status:"draft",     label:"مسودة",    color:"#4B5563", bg:"#161B26",     border:"#2D3748" },
  { status:"submitted", label:"قيد المراجعة", color:"#EF9F27", bg:"#1A1400",  border:"#3D2E00" },
  { status:"approved",  label:"معتمدة",   color:"#1D9E75", bg:"#001A12",     border:"#0F3D28" },
  { status:"done",      label:"مكتملة",   color:"#6B7280", bg:"#111318",     border:"#1F2937" },
];

import type { GrantDisplay, BudgetLineDisplay } from "@/types/db";

function BudgetBar({ lines }: { lines: BudgetLineDisplay[] }) {
  const total     = lines.reduce((s, l) => s + Number(l.plannedAmount), 0);
  const spent     = lines.reduce((s, l) => s + Number(l.spentAmount), 0);
  const committed = lines.reduce((s, l) => s + Number(l.committedAmount), 0);
  const pct = total > 0 ? ((spent + committed) / total) * 100 : 0;
  const isWarn = pct > 80;

  if (total === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[10px] text-[#4B5563] mb-1">
        <span>الميزانية</span>
        <span className={isWarn ? "text-[#EF9F27]" : ""}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
        <div className="h-full flex">
          <div className="bg-[#0F6E56] rounded-full" style={{ width:`${Math.min(spent/total*100,100)}%` }} />
          <div className="bg-[#0F6E56]/30" style={{ width:`${Math.min(committed/total*100,100-spent/total*100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function GrantCard({ grant }: { grant: GrantDisplay }) {
  const daysLeft = Math.ceil(
    (new Date(grant.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isExpiring = daysLeft <= 30 && daysLeft > 0;
  const isExpired  = daysLeft <= 0;

  return (
    <Link href={`/grants/${grant.id}`}>
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-xl p-4 hover:border-[#2D3748] hover:bg-[#141920] transition-all cursor-pointer group">

        {/* الرأس */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-[10px] font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
            {grant.code}
          </span>
          {(isExpiring || isExpired) && (
            <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
              isExpired ? "bg-[#2A1215] text-[#E24B4A]" : "bg-[#271E0A] text-[#EF9F27]"
            }`}>
              {isExpired ? "منتهية" : `${daysLeft} يوم`}
            </span>
          )}
        </div>

        {/* الاسم */}
        <h3 className="text-sm font-medium text-[#D1D5DB] group-hover:text-white transition-colors line-clamp-2 mb-1">
          {grant.name}
        </h3>

        {/* المانح */}
        <p className="text-xs text-[#4B5563]">{grant.donor?.name}</p>

        {/* المبلغ */}
        <div className="mt-3 pt-3 border-t border-[#1F2937]">
          <p className="text-sm font-semibold text-[#1D9E75] tabular-nums">
            {formatCurrency(grant.totalAmount)}
          </p>
        </div>

        {/* شريط الميزانية */}
        <BudgetBar lines={grant.budgetLines ?? []} />

      </div>
    </Link>
  );
}

export default function GrantKanban({ grants }: { grants: GrantDisplay[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const colGrants = grants.filter((g) => g.status === col.status);
        return (
          <div key={col.status} className="flex flex-col min-h-[400px]">
            {/* رأس العمود */}
            <div
              className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3"
              style={{ background: col.bg, border: `1px solid ${col.border}` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                <span className="text-xs font-medium" style={{ color: col.color }}>
                  {col.label}
                </span>
              </div>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-md tabular-nums"
                style={{ background: `${col.color}20`, color: col.color }}
              >
                {colGrants.length}
              </span>
            </div>

            {/* البطاقات */}
            <div className="flex flex-col gap-2 flex-1">
              {colGrants.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border border-dashed border-[#1F2937] rounded-xl">
                  <p className="text-xs text-[#374151]">لا توجد منح</p>
                </div>
              ) : (
                colGrants.map((g) => <GrantCard key={g.id} grant={g} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
