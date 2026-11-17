// src/modules/vendors/components/BidCriteriaEditor.tsx
// واجهة إعداد معايير تقييم العروض لمناقصة — تربط setupBidCriteria (كانت بلا واجهة،
// فتبقى BidEvaluationPanel بلا معايير وتقييم العروض غير قابل للاستخدام).
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setupBidCriteria } from "@/modules/vendors/actions";
import type { AppLocale } from "@/lib/preferences";

type Row = { nameAr: string; name: string; weight: string; maxScore: string };
type Criteria = { id: string; criteriaNameAr: string; criteriaName: string; weight: number; maxScore: number };

export default function BidCriteriaEditor({
  tenderId, organizationId, userId, initial, canEdit, locale = "ar",
}: {
  tenderId: string; organizationId: string; userId: string;
  initial: Criteria[]; canEdit: boolean; locale?: AppLocale;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length > 0
      ? initial.map(c => ({
          nameAr: c.criteriaNameAr,
          name:   c.criteriaName,
          weight: String(c.weight),
          maxScore: String(c.maxScore),
        }))
      : [{ nameAr: "", name: "", weight: "", maxScore: "10" }]
  );

  const t = locale === "ar"
    ? {
        title: "معايير التقييم",
        nameAr: "المعيار (عربي)",
        name: "Criteria (EN)",
        weight: "الوزن %",
        maxScore: "أعلى درجة",
        add: "إضافة معيار",
        remove: "حذف",
        save: "حفظ المعايير",
        saved: "تم حفظ المعايير",
        total: "المجموع",
        mustBe100: "مجموع الأوزان يجب أن يساوي 100%",
        reason: "تظهر هذه المعايير لأعضاء لجنة التقييم لإدخال درجاتهم",
      }
    : {
        title: "Evaluation criteria",
        nameAr: "Criterion (AR)",
        name: "Criteria (EN)",
        weight: "Weight %",
        maxScore: "Max score",
        add: "Add criterion",
        remove: "Remove",
        save: "Save criteria",
        saved: "Criteria saved",
        total: "Total",
        mustBe100: "Total weight must equal 100%",
        reason: "These criteria appear to the evaluation committee to enter their scores",
      };

  const total = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  const update = (i: number, patch: Partial<Row>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  function save() {
    setError(""); setSaved(false);
    const cleaned = rows
      .filter(r => r.name.trim() || r.nameAr.trim())
      .map(r => ({
        nameAr:   r.nameAr.trim() || r.name.trim(),
        name:     r.name.trim()   || r.nameAr.trim(),
        weight:   Number(r.weight) || 0,
        maxScore: Number(r.maxScore) || 10,
      }));
    if (cleaned.length === 0) { setError(t.mustBe100); return; }
    start(async () => {
      const res = await setupBidCriteria(tenderId, organizationId, userId, cleaned);
      if (!res.success) { setError(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <i className="ti ti-scale text-[#0F6E56]" />{t.title}
      </h2>
      <p className="text-[11px] text-[#4B5563]">{t.reason}</p>

      {!canEdit ? (
        <p className="text-xs text-[#4B5563] py-2">{locale === "ar" ? "لا تملك صلاحية تعديل المعايير" : "You do not have permission to edit criteria"}</p>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_64px_64px_28px] gap-1.5 items-center">
                <input
                  value={r.nameAr} onChange={e => update(i, { nameAr: e.target.value })}
                  placeholder={t.nameAr}
                  className="bg-[#161B26] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
                />
                <input
                  value={r.name} onChange={e => update(i, { name: e.target.value })}
                  placeholder={t.name}
                  className="bg-[#161B26] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
                />
                <input
                  type="number" min="0" max="100" value={r.weight} onChange={e => update(i, { weight: e.target.value })}
                  placeholder="%"
                  className="bg-[#161B26] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white text-center tabular-nums placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
                />
                <input
                  type="number" min="1" value={r.maxScore} onChange={e => update(i, { maxScore: e.target.value })}
                  placeholder="10"
                  className="bg-[#161B26] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white text-center tabular-nums placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
                />
                <button
                  type="button"
                  onClick={() => setRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i))}
                  disabled={rows.length === 1}
                  title={t.remove}
                  aria-label={t.remove}
                  className="text-[#E24B4A] hover:bg-[#2A1215] rounded-lg py-1.5 disabled:opacity-30 transition-colors"
                >
                  <i className="ti ti-trash text-[14px]" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button" onClick={() => setRows(prev => [...prev, { nameAr: "", name: "", weight: "", maxScore: "10" }])}
            className="text-xs text-[#378ADD] hover:text-[#5AA3E8] flex items-center gap-1 transition-colors"
          >
            <i className="ti ti-plus text-[14px]" />{t.add}
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-[#1F2937]">
            <span className="text-xs text-[#4B5563]">{t.total}</span>
            <span className={`text-xs font-bold ${Math.abs(total - 100) < 0.01 ? "text-[#1D9E75]" : "text-[#E24B4A]"}`}>{total}%</span>
          </div>

          {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
          {saved && !error && <p className="text-xs text-[#1D9E75] flex items-center gap-1"><i className="ti ti-check" />{t.saved}</p>}

          <button
            type="button" onClick={save} disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all"
          >
            {isPending && (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
            {t.save}
          </button>
        </>
      )}
    </div>
  );
}
