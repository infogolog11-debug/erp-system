"use client";
import Link from "next/link";
import type { AppLocale } from "@/lib/preferences";

const TYPE_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    local_ngo:"منظمة محلية", international_ngo:"منظمة دولية", government:"جهة حكومية",
    community_based:"مجتمعية", private_sector:"قطاع خاص", un_agency:"وكالة أممية",
  },
  en: {
    local_ngo:"Local NGO", international_ngo:"International NGO", government:"Government",
    community_based:"Community-based", private_sector:"Private sector", un_agency:"UN agency",
  },
};
const DD_STYLE: Record<string,string> = {
  pending:"bg-[#271E0A] text-[#EF9F27]", cleared:"bg-[#001A12] text-[#1D9E75]",
  flagged:"bg-[#2A1215] text-[#E24B4A]", rejected:"bg-[#2A1215] text-[#E24B4A]",
};
const DD_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { pending:"قيد الفحص", cleared:"تمت الموافقة", flagged:"محل تحفظ", rejected:"مرفوض" },
  en: { pending:"Pending review", cleared:"Cleared", flagged:"Flagged", rejected:"Rejected" },
};

export default function PartnerListView({ partners, locale = "ar" }: { partners: any[]; locale?: AppLocale }) {
  const labelMap = TYPE_LABEL[locale] ?? TYPE_LABEL.ar;
  const ddLabelMap = DD_LABEL[locale] ?? DD_LABEL.ar;
  const t = locale === "ar"
    ? { code:"الكود", name:"الاسم", type:"النوع", country:"الدولة", subGrants:"عدد المنح الفرعية", totalGrants:"إجمالي المنح", dueDiligence:"الفحص المسبق", empty:"لا يوجد شركاء مسجّلون" }
    : { code:"Code", name:"Name", type:"Type", country:"Country", subGrants:"Sub-grants", totalGrants:"Total grants", dueDiligence:"Due diligence", empty:"No registered partners" };
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[#1F2937]">
          {[t.code,t.name,t.type,t.country,t.subGrants,t.totalGrants,t.dueDiligence].map(h=>(
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
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{labelMap[p.partnerType] ?? p.partnerType}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{p.country ?? "—"}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{p.subGrants.length}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px] tabular-nums">{totalSubGrants.toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-1 rounded-full ${DD_STYLE[p.dueDiligenceStatus]}`}>{ddLabelMap[p.dueDiligenceStatus]}</span></td>
              </tr>
            );
          })}
          {partners.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
