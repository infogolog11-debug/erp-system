// لوحة تقييم عروض المناقصة — تُعرض في صفحة تفاصيل المناقصة
"use client";
import { useState, useTransition } from "react";
import { submitBidScore } from "@/modules/vendors/actions";

type Criteria = { id: string; criteriaNameAr: string; weight: number; maxScore: number };
type Bid = { id: string; vendorName: string; bidAmount: number; totalScore?: number };

export default function BidEvaluationPanel({
  tenderId, organizationId, evaluatorId,
  criteria, bids, currency = "USD",
}: {
  tenderId: string; organizationId: string; evaluatorId: string;
  criteria: Criteria[]; bids: Bid[]; currency?: string;
}) {
  const [scores, setScores]   = useState<Record<string, Record<string, string>>>({});
  const [notes,  setNotes]    = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, number>>({});
  const [isPending, start]    = useTransition();
  const [error, setError]     = useState("");

  const setScore = (bidId: string, criteriaId: string, val: string) =>
    setScores(p => ({ ...p, [bidId]: { ...(p[bidId] ?? {}), [criteriaId]: val } }));

  function submitAll(bidId: string) {
    const bidScores = scores[bidId] ?? {};
    const missing = criteria.filter(c => !bidScores[c.id] && bidScores[c.id] !== "0");
    if (missing.length > 0) { setError(`يرجى تقييم جميع المعايير قبل الإرسال`); return; }
    setError("");
    start(async () => {
      setSaving(bidId);
      let lastScore = 0;
      for (const c of criteria) {
        const res = await submitBidScore(
          tenderId, bidId, c.id, evaluatorId, organizationId,
          Number(bidScores[c.id]), notes[bidId]
        );
        if (!res.success) { setError(res.error); setSaving(null); return; }
        lastScore = res.data.finalScore;
      }
      setResults(p => ({ ...p, [bidId]: lastScore }));
      setSaving(null);
    });
  }

  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-award text-[#0F6E56]" />
          تقييم العروض
        </h2>
        <div className="flex items-center gap-2">
          {criteria.map(c => (
            <span key={c.id} className="text-[10px] bg-[#161B26] border border-[#2D3748] text-[#9CA3AF] px-2 py-1 rounded-md">
              {c.criteriaNameAr} <strong className="text-[#EF9F27]">{c.weight}%</strong>
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

      <div className="space-y-3">
        {bids.map(bid => {
          const finalScore = results[bid.id] ?? bid.totalScore;
          const isSaving   = saving === bid.id;
          const submitted  = !!results[bid.id];

          return (
            <div key={bid.id} className={`border rounded-xl p-4 space-y-3 transition-all ${submitted ? "border-[#0F3D28] bg-[#001A12]" : "border-[#1F2937] bg-[#161B26]"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{bid.vendorName}</p>
                  <p className="text-xs text-[#4B5563] mt-0.5">{fmt(bid.bidAmount)} {currency}</p>
                </div>
                {finalScore !== undefined && (
                  <div className="text-center">
                    <p className="text-2xl font-bold tabular-nums" style={{
                      color: finalScore >= 80 ? "#1D9E75" : finalScore >= 60 ? "#EF9F27" : "#E24B4A"
                    }}>{finalScore.toFixed(1)}</p>
                    <p className="text-[10px] text-[#4B5563]">الدرجة الكلية</p>
                  </div>
                )}
              </div>

              {/* شبكة التقييم */}
              <div className="grid grid-cols-1 gap-2">
                {criteria.map(c => {
                  const val = scores[bid.id]?.[c.id] ?? "";
                  const num = Number(val);
                  const pct = c.maxScore > 0 ? (num / c.maxScore) * 100 : 0;
                  return (
                    <div key={c.id} className="flex items-center gap-3">
                      <span className="text-xs text-[#6B7280] w-32 shrink-0">{c.criteriaNameAr}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="range" min={0} max={c.maxScore} step={0.5}
                          value={val || "0"}
                          onChange={e => setScore(bid.id, c.id, e.target.value)}
                          disabled={submitted}
                          className="flex-1 accent-[#0F6E56] disabled:opacity-40"
                        />
                        <span className="text-xs font-semibold tabular-nums w-12 text-left" style={{
                          color: pct >= 80 ? "#1D9E75" : pct >= 50 ? "#EF9F27" : "#E24B4A"
                        }}>{val || "0"}/{c.maxScore}</span>
                      </div>
                      <span className="text-[10px] text-[#4B5563] w-10 text-left">({c.weight}%)</span>
                    </div>
                  );
                })}
              </div>

              {/* ملاحظة + إرسال */}
              {!submitted && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text" value={notes[bid.id] ?? ""}
                    onChange={e => setNotes(p => ({ ...p, [bid.id]: e.target.value }))}
                    placeholder="ملاحظة (اختياري)..."
                    className="flex-1 bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]"
                  />
                  <button onClick={() => submitAll(bid.id)} disabled={isSaving}
                    className="flex items-center gap-1.5 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all whitespace-nowrap">
                    {isSaving
                      ? <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                      : <i className="ti ti-send" />
                    }
                    إرسال التقييم
                  </button>
                </div>
              )}
              {submitted && (
                <p className="text-xs text-[#1D9E75] flex items-center gap-1 pt-1">
                  <i className="ti ti-check-circle" />تم تسجيل تقييمك — لا يمكن التعديل
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ترتيب العروض بعد التقييم */}
      {Object.keys(results).length > 0 && (
        <div className="pt-3 border-t border-[#1F2937]">
          <p className="text-xs font-medium text-[#9CA3AF] mb-2">ترتيب العروض حسب تقييمك:</p>
          {bids
            .filter(b => results[b.id] !== undefined)
            .sort((a,b) => (results[b.id]??0) - (results[a.id]??0))
            .map((bid, i) => (
              <div key={bid.id} className="flex items-center gap-3 py-1.5">
                <span className={`text-sm font-bold w-5 ${i === 0 ? "text-[#EF9F27]" : "text-[#4B5563]"}`}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`}
                </span>
                <span className="text-sm text-[#D1D5DB] flex-1">{bid.vendorName}</span>
                <span className="text-sm font-semibold tabular-nums" style={{
                  color: (results[bid.id]??0) >= 80 ? "#1D9E75" : (results[bid.id]??0) >= 60 ? "#EF9F27" : "#E24B4A"
                }}>{(results[bid.id]??0).toFixed(1)}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}
