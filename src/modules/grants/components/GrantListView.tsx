// src/modules/grants/components/GrantListView.tsx
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import type { AppLocale } from "@/lib/preferences";
import { getLocaleTag, grantStatusLabels } from "@/lib/i18n";

const STATUS_STYLE: Record<string,string> = {
  draft:     "bg-[#1F2937] text-[#6B7280]",
  submitted: "bg-[#271E0A] text-[#EF9F27]",
  approved:  "bg-[#001A12] text-[#1D9E75]",
  rejected:  "bg-[#2A1215] text-[#E24B4A]",
  done:      "bg-[#111318] text-[#4B5563]",
};
import type { GrantDisplay } from "@/types/db";

export default function GrantListView({ grants, locale }: { grants: GrantDisplay[]; locale: AppLocale }) {
  const headers = locale === "ar"
    ? ["الكود","الاسم","المانح","المبلغ","الحالة","تاريخ الانتهاء"]
    : ["Code","Name","Donor","Amount","Status","End date"];
  const statusLabels = grantStatusLabels[locale];
  const localeTag = getLocaleTag(locale);

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {headers.map((h) => (
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
                {formatCurrency(g.totalAmount, "USD", localeTag)}
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded-md ${STATUS_STYLE[g.status]}`}>
                  {statusLabels[g.status as keyof typeof statusLabels] ?? g.status}
                </span>
              </td>
              <td className="px-4 py-3 text-[#6B7280] text-xs">
                {new Date(g.endDate).toLocaleDateString(localeTag)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
