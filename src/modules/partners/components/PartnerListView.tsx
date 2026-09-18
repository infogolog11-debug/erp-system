"use client";
import Link from "next/link";

const TYPE_LABEL: Record<string,string> = {
  local_ngo:"منظمة محلية", international_ngo:"منظمة دولية", government:"جهة حكومية",
  community_based:"مجتمعية", private_sector:"قطاع خاص", un_agency:"وكالة أممية",
};
const DD_STYLE: Record<string,string> = {
  pending:"bg-[#271E0A] text-[#EF9F27]", cleared:"bg-[#001A12] text-[#1D9E75]",
  flagged:"bg-[#2A1215] text-[#E24B4A]", rejected:"bg-[#2A1215] text-[#E24B4A]",
};
const DD_LABEL: Record<string,string> = { pending:"قيد الفحص", cleared:"تمت الموافقة", flagged:"محل تحفظ", rejected:"مرفوض" };

export default function PartnerListView({ partners }: { partners: any[] }) {
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[#1F2937]">
          {["الكود","الاسم","النوع","الدولة","عدد المنح الفرعية","إجمالي المنح","الفحص المسبق"].map(h=>(
            <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {partners.map((p,i) => {
            const totalSubGrants = p.subGrants.reduce((s:number,sg:any)=>s+Number(sg.totalAmount),0);
            return (
              <tr key={p.id} className={`border-b border-[#1F2937] hover:bg-[#161B26] ${i===partners.length-1?"border-none":""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{p.code}</td>
                <td className="px-4 py-3"><Link href={`/partners/${p.id}`} className="text-[#D1D5DB] hover:text-white">{p.nameAr || p.name}</Link></td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{TYPE_LABEL[p.partnerType] ?? p.partnerType}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{p.country ?? "—"}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{p.subGrants.length}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px] tabular-nums">{totalSubGrants.toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-1 rounded-full ${DD_STYLE[p.dueDiligenceStatus]}`}>{DD_LABEL[p.dueDiligenceStatus]}</span></td>
              </tr>
            );
          })}
          {partners.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">لا يوجد شركاء مسجّلون</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
