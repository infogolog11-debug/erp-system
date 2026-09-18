// src/modules/accounting/components/JournalList.tsx
"use client";
import Link from "next/link";
import { useTransition } from "react";
import { postJournalEntry } from "@/modules/accounting/actions";
import { useRouter } from "next/navigation";
import type { JournalEntryDisplay } from "@/types/db";

export default function JournalList({ entries, role, userId, organizationId }: {
  entries: JournalEntryDisplay[]; role:string; userId:string; organizationId:string;
}) {
  const canPost = ["super_admin","admin","finance_manager"].includes(role);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handlePost(entryId: string) {
    startTransition(async () => {
      await postJournalEntry(entryId, userId, organizationId);
      router.refresh();
    });
  }

  if (entries.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-calculator text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">لا توجد قيود محاسبية</p>
    </div>
  );

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","التاريخ","البيان","المدين","الدائن","النوع","الحالة",""].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={entry.id} className={`hover:bg-[#161B26] ${i < entries.length-1 ? "border-b border-[#1F2937]" : ""}`}>
              <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{entry.code}</td>
              <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(entry.entryDate).toLocaleDateString("ar-SA")}</td>
              <td className="px-4 py-3 text-[#D1D5DB] max-w-[200px] truncate">{entry.description}</td>
              <td className="px-4 py-3 text-xs text-[#378ADD] tabular-nums">{Number(entry.totalDebit).toLocaleString("ar-SA")}</td>
              <td className="px-4 py-3 text-xs text-[#E24B4A] tabular-nums">{Number(entry.totalCredit).toLocaleString("ar-SA")}</td>
              <td className="px-4 py-3 text-xs text-[#6B7280]">{entry.entryType}</td>
              <td className="px-4 py-3">
                {entry.isPosted
                  ? <span className="text-[10px] bg-[#001A12] text-[#1D9E75] px-2 py-0.5 rounded-md font-medium">مرحَّل</span>
                  : <span className="text-[10px] bg-[#271E0A] text-[#EF9F27] px-2 py-0.5 rounded-md font-medium">معلق</span>
                }
              </td>
              <td className="px-4 py-3">
                {!entry.isPosted && canPost && (
                  <button onClick={() => handlePost(entry.id)} disabled={isPending}
                    className="text-xs text-[#0F6E56] hover:text-[#1D9E75] disabled:opacity-50 transition-colors">
                    ترحيل
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
