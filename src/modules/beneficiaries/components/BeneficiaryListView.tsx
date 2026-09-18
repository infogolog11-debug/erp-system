"use client";
import { useState, useMemo } from "react";
import Link from "next/link";

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
const STATUS_LABEL: Record<string,string> = {
  pending:"قيد المراجعة", verified:"موثّق", rejected:"مرفوض", flagged_duplicate:"ازدواجية محتملة",
};
const VULN_LABEL: Record<string,string> = {
  none:"لا يوجد", elderly:"كبار السن", disability:"إعاقة", chronic_illness:"مرض مزمن",
  female_headed_household:"أسرة تعيلها امرأة", child_headed_household:"أسرة يعيلها طفل",
  unaccompanied_minor:"قاصر غير مصحوب", pregnant_lactating:"حامل/مرضعة", other:"أخرى",
};

export default function BeneficiaryListView({ beneficiaries }: { beneficiaries: Row[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
          placeholder="ابحث بالاسم أو رقم المستفيد..."
          className="flex-1 min-w-[220px] bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2 text-sm text-white cursor-pointer focus:outline-none focus:border-[#0F6E56]"
        >
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="verified">موثّق</option>
          <option value="flagged_duplicate">ازدواجية محتملة</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937]">
              {["الكود","الاسم","الموقع","حجم الأسرة","الفئة","المشروع","الحالة"].map(h => (
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
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{VULN_LABEL[b.vulnerabilityCategory] ?? b.vulnerabilityCategory}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{b.grant?.nameAr || b.grant?.name || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${STATUS_STYLE[b.verificationStatus] ?? ""}`}>
                    {STATUS_LABEL[b.verificationStatus] ?? b.verificationStatus}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">لا توجد نتائج</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
