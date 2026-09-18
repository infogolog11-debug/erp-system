import Link from "next/link";
type Props = { label:string; value:number|string; icon:string; color:string; href?:string; sub?:string };
const COLORS: Record<string,{ icon:string; badge:string }> = {
  teal:   { icon:"text-[#1D9E75]", badge:"bg-[#001A12] border-[#0F3D28]" },
  amber:  { icon:"text-[#EF9F27]", badge:"bg-[#1A1400] border-[#3D2E00]" },
  blue:   { icon:"text-[#378ADD]", badge:"bg-[#0A1628] border-[#1A3060]" },
  purple: { icon:"text-[#A855F7]", badge:"bg-[#1A0A2E] border-[#3D1A6E]" },
  coral:  { icon:"text-[#E24B4A]", badge:"bg-[#2A1215] border-[#4A1C20]" },
};
export default function StatCard({ label, value, icon, color, href, sub }: Props) {
  const c = COLORS[color] ?? COLORS.teal;
  const inner = (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 hover:border-[#2D3748] transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.badge} border`}>
          <i className={`ti ${icon} text-[18px] ${c.icon}`} />
        </div>
        {href && <i className="ti ti-arrow-up-left text-[#2D3748] group-hover:text-[#4B5563] text-[14px] transition-colors" />}
      </div>
      <p className="text-3xl font-bold tabular-nums text-white">{value}</p>
      <p className="text-sm text-[#6B7280] mt-1">{label}</p>
      {sub && <p className="text-[11px] text-[#2D3748] mt-1.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
