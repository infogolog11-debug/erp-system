"use client";
import Link from "next/link";
import { isOverdue } from "@/lib/cfm/sla";
import type { AppLocale } from "@/lib/preferences";

const CATEGORY_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    service_quality:"جودة الخدمة", staff_conduct:"سلوك الموظفين", corruption_fraud:"فساد/احتيال",
    sgbv_protection:"حماية/عنف قائم على النوع", distribution_issue:"مشكلة توزيع",
    eligibility_targeting:"استهداف/أهلية", data_privacy:"خصوصية البيانات", suggestion:"اقتراح", other:"أخرى",
  },
  en: {
    service_quality:"Service quality", staff_conduct:"Staff conduct", corruption_fraud:"Corruption / fraud",
    sgbv_protection:"Protection / GBV", distribution_issue:"Distribution issue",
    eligibility_targeting:"Eligibility / targeting", data_privacy:"Data privacy", suggestion:"Suggestion", other:"Other",
  },
};
const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: {
    received:"مستلَمة", under_review:"قيد المراجعة", investigating:"قيد التحقيق",
    resolved:"محلولة", closed:"مغلقة", escalated:"مُصعَّدة",
  },
  en: {
    received:"Received", under_review:"Under review", investigating:"Investigating",
    resolved:"Resolved", closed:"Closed", escalated:"Escalated",
  },
};
const STATUS_STYLE: Record<string,string> = {
  received:"bg-[#1F2937] text-[#9CA3AF]", under_review:"bg-[#0B1A2A] text-[#378ADD]",
  investigating:"bg-[#271E0A] text-[#EF9F27]", resolved:"bg-[#001A12] text-[#1D9E75]",
  closed:"bg-[#1F2937] text-[#6B7280]", escalated:"bg-[#2A1215] text-[#E24B4A]",
};
const PRIORITY_STYLE: Record<string,string> = {
  low:"text-[#6B7280]", medium:"text-[#9CA3AF]", high:"text-[#EF9F27]", critical:"text-[#E24B4A] font-semibold",
};
const PRIORITY_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { low:"منخفضة", medium:"متوسطة", high:"عالية", critical:"حرجة" },
  en: { low:"Low", medium:"Medium", high:"High", critical:"Critical" },
};

export default function CFMListView({ complaints, locale = "ar" }: { complaints: any[]; locale?: AppLocale }) {
  const isAr = locale === "ar";
  const categoryLabel = CATEGORY_LABEL[locale] ?? CATEGORY_LABEL.ar;
  const statusLabel = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const priorityLabel = PRIORITY_LABEL[locale] ?? PRIORITY_LABEL.ar;
  const t = isAr ? {
    headers: ["الكود","الفئة","الوصف","الأولوية","الحالة","تاريخ الاستلام"],
    sensitive: "شكوى حساسة",
    restricted: "محتوى مقيَّد — راجع مع فريق الحماية",
    overdue: "متجاوزة المهلة",
    empty: "لا توجد شكاوى مسجّلة",
    dateTag: "ar",
  } : {
    headers: ["Code","Category","Description","Priority","Status","Received date"],
    sensitive: "Sensitive complaint",
    restricted: "Restricted content — follow up with the protection team",
    overdue: "Overdue",
    empty: "No complaints recorded",
    dateTag: "en-US",
  };
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[#1F2937]">
          {t.headers.map(h=>(
            <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {complaints.map((c,i) => {
            const overdue = isOverdue(c.dueDate ? new Date(c.dueDate) : null, c.complaintStatus);
            return (
              <tr key={c.id} className={`border-b border-[#1F2937] hover:bg-[#161B26] ${i===complaints.length-1?"border-none":""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{c.code}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">
                  {categoryLabel[c.category]}
                  {c.sensitivity === "sensitive" && <i className="ti ti-shield-lock text-[#EF9F27] mr-1.5" title={t.sensitive}/>}
                </td>
                <td className="px-4 py-3">
                  {c.restricted ? (
                    <Link href={`/cfm/${c.id}`} className="text-[12px] text-[#6B7280] italic flex items-center gap-1"><i className="ti ti-lock"/>{t.restricted}</Link>
                  ) : (
                    <Link href={`/cfm/${c.id}`} className="text-[#D1D5DB] hover:text-white text-[13px]">{c.description.slice(0,60)}{c.description.length>60?"...":""}</Link>
                  )}
                </td>
                <td className={`px-4 py-3 text-[13px] ${PRIORITY_STYLE[c.priority]}`}>{priorityLabel[c.priority]}</td>
                <td className="px-4 py-3">
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${STATUS_STYLE[c.complaintStatus]}`}>{statusLabel[c.complaintStatus]}</span>
                  {overdue && <span className="text-[10px] text-[#E24B4A] mr-1.5">{t.overdue}</span>}
                </td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(c.receivedDate).toLocaleDateString(t.dateTag)}</td>
              </tr>
            );
          })}
          {complaints.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
