// src/modules/procurement/components/PRKanban.tsx
"use client";
import Link from "next/link";

const COLUMNS = [
  { status:"draft",     label:"مسودة",         color:"#4B5563", bg:"#161B26",  border:"#2D3748" },
  { status:"submitted", label:"بانتظار الموافقة", color:"#EF9F27", bg:"#1A1400", border:"#3D2E00" },
  { status:"approved",  label:"معتمدة",         color:"#1D9E75", bg:"#001A12",  border:"#0F3D28" },
  { status:"done",      label:"منجزة",          color:"#6B7280", bg:"#111318",  border:"#1F2937" },
];

const PRIORITY_STYLE: Record<string,string> = {
  urgent:"bg-[#2A1215] text-[#E24B4A]",
  high:"bg-[#271E0A] text-[#EF9F27]",
  medium:"bg-[#0A1628] text-[#378ADD]",
  low:"bg-[#161B26] text-[#6B7280]",
};
const PRIORITY_LABEL: Record<string,string> = {urgent:"عاجل",high:"عالية",medium:"متوسطة",low:"منخفضة"};

import type { PRDisplay } from "@/types/db";

function PRCard({ pr }: { pr: PRDisplay }) {
  return (
    <Link href={`/procurement/requests/${pr.id}`}>
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-xl p-4 hover:border-[#2D3748] hover:bg-[#141920] transition-all group">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono text-[#4B5563]">{pr.code}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${PRIORITY_STYLE[pr.priority ?? "medium"]}`}>
            {PRIORITY_LABEL[pr.priority ?? "medium"]}
          </span>
        </div>
        <h3 className="text-sm font-medium text-[#D1D5DB] group-hover:text-white line-clamp-2 mb-2">{pr.title}</h3>
        {pr.grant && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#4B5563]">
            <i className="ti ti-coins text-[11px]" aria-hidden="true"/>
            {pr.grant.name}
          </div>
        )}
        {pr.estimatedTotal && (
          <div className="mt-3 pt-3 border-t border-[#1F2937]">
            <p className="text-xs font-semibold text-[#EF9F27] tabular-nums">
              {Number(pr.estimatedTotal).toLocaleString("ar-SA")}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

function PRTable({ prs }: { prs: PRDisplay[] }) {
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","العنوان","المنحة","المبلغ التقديري","الأولوية","الحالة"].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prs.map((pr,i)=>(
            <tr key={pr.id} className={`hover:bg-[#161B26] transition-colors ${i<prs.length-1?"border-b border-[#1F2937]":""}`}>
              <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{pr.code}</td>
              <td className="px-4 py-3"><Link href={`/procurement/requests/${pr.id}`} className="text-[#D1D5DB] hover:text-white">{pr.title}</Link></td>
              <td className="px-4 py-3 text-xs text-[#6B7280]">{pr.grant?.name ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-[#EF9F27] tabular-nums">{pr.estimatedTotal ? Number(pr.estimatedTotal).toLocaleString("ar-SA") : "—"}</td>
              <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-md ${PRIORITY_STYLE[pr.priority??"medium"]}`}>{PRIORITY_LABEL[pr.priority??"medium"]}</span></td>
              <td className="px-4 py-3 text-xs text-[#6B7280]">{pr.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PRKanban({ prs, currentView }: { prs: PRDisplay[]; currentView: string }) {
  if (currentView === "list") return <PRTable prs={prs} />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const items = prs.filter(p => p.status === col.status);
        return (
          <div key={col.status} className="flex flex-col">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-3" style={{background:col.bg,border:`1px solid ${col.border}`}}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{background:col.color}}/>
                <span className="text-xs font-medium" style={{color:col.color}}>{col.label}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md tabular-nums" style={{background:`${col.color}20`,color:col.color}}>{items.length}</span>
            </div>
            <div className="flex flex-col gap-2 min-h-[200px]">
              {items.length===0
                ? <div className="flex-1 flex items-center justify-center border border-dashed border-[#1F2937] rounded-xl"><p className="text-xs text-[#374151]">لا توجد طلبات</p></div>
                : items.map(pr=><PRCard key={pr.id} pr={pr}/>)
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}
