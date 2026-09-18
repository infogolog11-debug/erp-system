// src/modules/vendors/components/VendorList.tsx
import Link from "next/link";

const STATUS_STYLE: Record<string,{bg:string;text:string;label:string}> = {
  pending:     { bg:"bg-[#271E0A]", text:"text-[#EF9F27]", label:"قيد المراجعة" },
  approved:    { bg:"bg-[#001A12]", text:"text-[#1D9E75]", label:"معتمد" },
  preferred:   { bg:"bg-[#0A1628]", text:"text-[#378ADD]", label:"مفضل" },
  restricted:  { bg:"bg-[#2A1215]", text:"text-[#E24B4A]", label:"مقيد" },
  blacklisted: { bg:"bg-[#1A0000]", text:"text-[#FF4444]", label:"قائمة سوداء" },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score, 100);
  const color = pct >= 80 ? "#1D9E75" : pct >= 60 ? "#EF9F27" : "#E24B4A";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span className="text-[10px] font-medium tabular-nums" style={{ color }}>{score.toFixed(0)}</span>
    </div>
  );
}

import type { VendorDisplay } from "@/types/db";

export default function VendorList({ vendors }: { vendors: VendorDisplay[] }) {
  if (vendors.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-truck text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">لا يوجد موردون بعد</p>
      <Link href="/vendors/new" className="inline-flex items-center gap-2 mt-4 text-sm text-[#0F6E56] hover:text-[#1D9E75]">
        <i className="ti ti-plus" aria-hidden="true" />إضافة مورد
      </Link>
    </div>
  );

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["المورد","الكود","النوع","التقييم","الحالة","جهة الاتصال",""].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => {
            const st = STATUS_STYLE[v.status] ?? STATUS_STYLE.pending;
            const contact = v.contacts?.[0];
            return (
              <tr key={v.id} className={`hover:bg-[#161B26] transition-colors ${i < vendors.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3">
                  <Link href={`/vendors/${v.id}`} className="font-medium text-[#D1D5DB] hover:text-white transition-colors">
                    {v.name}
                  </Link>
                  {v.nameAr && <p className="text-[11px] text-[#4B5563] mt-0.5">{v.nameAr}</p>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{v.code}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{v.vendorType}</td>
                <td className="px-4 py-3 w-28"><ScoreBar score={Number(v.overallScore) || 0} /></td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${st.bg} ${st.text}`}>{st.label}</span>
                </td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{contact?.email ?? v.email ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/vendors/${v.id}`} className="text-[#4B5563] hover:text-[#0F6E56] transition-colors">
                    <i className="ti ti-chevron-left text-[16px]" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
