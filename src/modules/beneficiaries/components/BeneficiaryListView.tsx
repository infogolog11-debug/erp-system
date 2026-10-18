"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import type { AppLocale } from "@/lib/preferences";

type Row = {
  id: string; code: string; firstName: string; lastName: string; fullNameAr: string | null;
  gender: string; governorate: string | null; district: string | null;
  vulnerabilityCategory: string; verificationStatus: string; householdSize: number;
  grant: { id: string; name: string; nameAr: string | null } | null;
};

const STATUS_STYLE: Record<string,string> = {
  pending:  "bg-[#271E0A] text-[#EF9F27]",
  verified: "bg-[#001A12] text-[#1D9E75]",
  rejected: "bg-[#2A1215] text-[#E24B4A]",
  flagged_duplicate: "bg-[#2A1215] text-[#E24B4A]",
};
const STATUS_LABEL = {
  ar: { pending:"قيد المراجعة", verified:"موثّق", rejected:"مرفوض", flagged_duplicate:"ازدواجية محتملة" },
  en: { pending:"Pending review", verified:"Verified", rejected:"Rejected", flagged_duplicate:"Possible duplicate" },
} as const;
const VULN_LABEL = {
  ar: {
    none:"لا يوجد", elderly:"كبار السن", disability:"إعاقة", chronic_illness:"مرض مزمن",
    female_headed_household:"أسرة تعيلها امرأة", child_headed_household:"أسرة يعيلها طفل",
    unaccompanied_minor:"قاصر غير مصحوب", pregnant_lactating:"حامل/مرضعة", other:"أخرى",
  },
  en: {
    none:"None", elderly:"Older person", disability:"Disability", chronic_illness:"Chronic illness",
    female_headed_household:"Female-headed household", child_headed_household:"Child-headed household",
    unaccompanied_minor:"Unaccompanied minor", pregnant_lactating:"Pregnant/lactating", other:"Other",
  },
} as const;

export default function BeneficiaryListView({ beneficiaries, locale = "ar" }: { beneficiaries: Row[]; locale?: AppLocale }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const statusLabels = STATUS_LABEL[locale] as Record<string, string>;
  const vulnLabels = VULN_LABEL[locale] as Record<string, string>;
  const headers = locale === "ar"
    ? ["الكود","الاسم","الموقع","حجم الأسرة","الفئة","المشروع","الحالة"]
    : ["Code","Name","Location","Household size","Category","Grant","Status"];

  const filtered = useMemo(() => {
    return beneficiaries.filter(b => {
      const matchesSearch = !search ||
        `${b.firstName} ${b.lastName} ${b.fullNameAr ?? ""} ${b.code}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || b.verificationStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [beneficiaries, search, statusFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={locale === "ar" ? "ابحث بالاسم أو رقم المستفيد..." : "Search by name or beneficiary code..."}
          className="flex-1 min-w-[220px] bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2 text-sm text-white cursor-pointer focus:outline-none focus:border-[#0F6E56]"
        >
          <option value="all">{locale === "ar" ? "كل الحالات" : "All statuses"}</option>
          <option value="pending">{statusLabels.pending}</option>
          <option value="verified">{statusLabels.verified}</option>
          <option value="flagged_duplicate">{statusLabels.flagged_duplicate}</option>
          <option value="rejected">{statusLabels.rejected}</option>
        </select>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937]">
              {headers.map(h => (
                <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => (
              <tr key={b.id} className={`border-b border-[#1F2937] hover:bg-[#161B26] transition-colors ${i===filtered.length-1?"border-none":""}`}>
                <td className="px-4 py-3"><span className="font-mono text-xs text-[#4B5563]">{b.code}</span></td>
                <td className="px-4 py-3">
                  <Link href={`/beneficiaries/${b.id}`} className="text-[#D1D5DB] hover:text-white transition-colors">
                    {b.fullNameAr || `${b.firstName} ${b.lastName}`}
                  </Link>
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">
                  {[b.governorate, b.district].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{b.householdSize}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{vulnLabels[b.vulnerabilityCategory] ?? b.vulnerabilityCategory}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{locale === "ar" ? (b.grant?.nameAr || b.grant?.name || "—") : (b.grant?.name || b.grant?.nameAr || "—")}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${STATUS_STYLE[b.verificationStatus] ?? ""}`}>
                    {statusLabels[b.verificationStatus] ?? b.verificationStatus}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">{locale === "ar" ? "لا توجد نتائج" : "No results found"}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
