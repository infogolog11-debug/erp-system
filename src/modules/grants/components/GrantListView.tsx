// src/modules/grants/components/GrantListView.tsx
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const STATUS_STYLE: Record<string,string> = {
  draft:     "bg-[#1F2937] text-[#6B7280]",
  submitted: "bg-[#271E0A] text-[#EF9F27]",
  approved:  "bg-[#001A12] text-[#1D9E75]",
  rejected:  "bg-[#2A1215] text-[#E24B4A]",
  done:      "bg-[#111318] text-[#4B5563]",
};
const STATUS_LABEL: Record<string,string> = {
  draft:"مسودة", submitted:"قيد المراجعة", approved:"معتمدة",
  rejected:"مرفوضة", done:"مكتملة", cancelled:"ملغاة",
};

import type { GrantDisplay } from "@/types/db";

export default function GrantListView({ grants }: { grants: GrantDisplay[] }) {
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","الاسم","المانح","المبلغ","الحالة","تاريخ الانتهاء"].map((h) => (
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grants.map((g, i) => (
            <tr
              key={g.id}
              className={`border-b border-[#1F2937] hover:bg-[#161B26] transition-colors ${
                i === grants.length - 1 ? "border-none" : ""
              }`}
            >
              <td className="px-4 py-3">
                <span className="font-mono text-xs text-[#4B5563]">{g.code}</span>
              </td>
              <td className="px-4 py-3">
                <Link href={`/grants/${g.id}`} className="text-[#D1D5DB] hover:text-white transition-colors">
                  {g.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-[#6B7280]">{g.donor?.name}</td>
              <td className="px-4 py-3 text-[#1D9E75] font-medium tabular-nums">
                {formatCurrency(g.totalAmount)}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-md ${STATUS_STYLE[g.status]}`}>
                  {STATUS_LABEL[g.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-[#6B7280] text-xs">
                {new Date(g.endDate).toLocaleDateString("ar-SA")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
