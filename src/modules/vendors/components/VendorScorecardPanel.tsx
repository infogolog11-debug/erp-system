// بطاقة أداء المورد — تُعرض في صفحة تفاصيل المورد
"use client";
import { useState, useTransition } from "react";
import { submitVendorRating } from "@/modules/vendors/actions";
import type { AppLocale } from "@/lib/preferences";

type Rating = {
  id: string;
  qualityScore:    number;
  deliveryScore:   number;
  complianceScore: number;
  weightedAverage: number;
  comments?:       string;
  ratingDate:      string;
};

type Props = {
  vendorId:        string;
  vendorName:      string;
  organizationId:  string;
  ratedBy:         string;
  averageRating?:  number;
  ratingsCount?:   number;
  history:         Rating[];
  relatedPoId?:    string;
  relatedGrnId?:   string;
};

export default function VendorScorecardPanel({
  vendorId, vendorName, organizationId, ratedBy,
  averageRating = 0, ratingsCount = 0, history,
  relatedPoId, relatedGrnId, locale = "ar",
}: Props & { locale?: AppLocale }) {
  const isAr = locale === "ar";
  const t = isAr ? {
    title:              "بطاقة أداء المورد",
    outOf:              "من 5.0",
    ratingsCount:       (n: number) => `${n} تقييم`,
    previousAvg:        "متوسط التقييمات السابقة",
    newRating:          "تقييم جديد",
    weightedPreview:    "الدرجة المرجحة (معاينة)",
    commentsPlaceholder:"ملاحظات إضافية (اختياري)...",
    submit:             "تسجيل التقييم",
    latestRatings:      "آخر التقييمات",
    successMsg:         (avg: string) => `تم التقييم ✅ المعدل الجديد: ${avg}/5`,
    criteria: {
      quality:    "جودة البضائع/الخدمات",
      delivery:   "الالتزام بوقت التسليم",
      compliance: "الامتثال للشروط",
    },
  } : {
    title:              "Vendor Scorecard",
    outOf:              "out of 5.0",
    ratingsCount:       (n: number) => `${n} ratings`,
    previousAvg:        "Average of previous ratings",
    newRating:          "New rating",
    weightedPreview:    "Weighted score (preview)",
    commentsPlaceholder:"Additional notes (optional)...",
    submit:             "Submit rating",
    latestRatings:      "Latest ratings",
    successMsg:         (avg: string) => `Rating submitted ✅ New average: ${avg}/5`,
    criteria: {
      quality:    "Goods/services quality",
      delivery:   "Delivery time compliance",
      compliance: "Terms compliance",
    },
  };
  const [quality,    setQuality]    = useState(3);
  const [delivery,   setDelivery]   = useState(3);
  const [compliance, setCompliance] = useState(3);
  const [comments,   setComments]   = useState("");
  const [isPending, start]          = useTransition();
  const [error,  setError]          = useState("");
  const [success, setSuccess]       = useState("");
  const [newAvg, setNewAvg]         = useState<number | null>(null);

  // المعادلة: جودة 40% + توصيل 35% + امتثال 25%
  const preview = quality * 0.40 + delivery * 0.35 + compliance * 0.25;

  function submit() {
    setError(""); setSuccess("");
    start(async () => {
      const res = await submitVendorRating(
        { vendorId, organizationId, qualityScore: quality,
          deliveryScore: delivery, complianceScore: compliance,
          comments: comments || undefined, relatedPoId, relatedGrnId },
        ratedBy
      );
      if (res.success) {
        setSuccess(t.successMsg(res.data.newVendorAverage.toFixed(2)));
        setNewAvg(res.data.newVendorAverage);
        setComments("");
      } else setError(res.error);
    });
  }

  const displayAvg = newAvg ?? averageRating;

  const starColor = (avg: number) =>
    avg >= 4 ? "#1D9E75" : avg >= 3 ? "#EF9F27" : avg >= 2 ? "#E07020" : "#E24B4A";

  const criteria = [
    { key: "quality"    as const, label: t.criteria.quality,    weight: "40%", value: quality,    set: setQuality,    color: "#1D9E75" },
    { key: "delivery"   as const, label: t.criteria.delivery,   weight: "35%", value: delivery,   set: setDelivery,   color: "#378ADD" },
    { key: "compliance" as const, label: t.criteria.compliance, weight: "25%", value: compliance, set: setCompliance, color: "#A855F7" },
  ];

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-star text-[#EF9F27]" />
          {t.title}
        </h2>
        {/* المعدل الكلي */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums" style={{ color: starColor(displayAvg) }}>
              {displayAvg.toFixed(1)}
            </p>
            <p className="text-[10px] text-[#4B5563]">{t.outOf}</p>
          </div>
          <div className="space-y-0.5">
            {/* نجوم */}
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(s => (
                <i key={s} className={`ti ti-star${displayAvg >= s ? "-filled" : ""} text-[14px]`}
                   style={{ color: displayAvg >= s ? starColor(displayAvg) : "#2D3748" }} />
              ))}
            </div>
            <p className="text-[10px] text-[#4B5563]">{t.ratingsCount(ratingsCount)}</p>
          </div>
        </div>
      </div>

      {/* شريط المحاور الثلاثة التاريخي */}
      {ratingsCount > 0 && (
        <div className="space-y-2 p-3 bg-[#161B26] rounded-xl border border-[#2D3748]">
          <p className="text-[11px] text-[#6B7280] font-medium mb-2">{t.previousAvg}</p>
          {criteria.map(c => {
            const histAvg = history.length > 0
              ? history.reduce((s,r) =>
                  s + (c.key === "quality"    ? Number(r.qualityScore) :
                       c.key === "delivery"   ? Number(r.deliveryScore) :
                                                Number(r.complianceScore)), 0) / history.length
              : 0;
            return (
              <div key={c.key} className="flex items-center gap-3">
                <span className="text-[11px] text-[#9CA3AF] w-36 shrink-0">{c.label}</span>
                <div className="flex-1 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(histAvg / 5) * 100}%`,
                    backgroundColor: c.color,
                  }} />
                </div>
                <span className="text-[11px] font-semibold tabular-nums w-8 text-left" style={{ color: c.color }}>
                  {histAvg.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* نموذج تقييم جديد */}
      <div className="space-y-3 pt-1">
        <p className="text-xs font-medium text-[#9CA3AF] flex items-center gap-1">
          <i className="ti ti-edit" />{t.newRating}
        </p>
        {criteria.map(c => (
          <div key={c.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#D1D5DB]">
                {c.label} <span className="text-[#4B5563]">({c.weight})</span>
              </span>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => c.set(star)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#1F2937]">
                    <i className={`ti ti-star${c.value >= star ? "-filled" : ""} text-[15px]`}
                       style={{ color: c.value >= star ? c.color : "#2D3748" }} />
                  </button>
                ))}
                <span className="text-xs font-semibold tabular-nums w-6 text-center" style={{ color: c.color }}>
                  {c.value}/5
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* معاينة الدرجة */}
        <div className="flex items-center justify-between p-3 bg-[#161B26] border border-[#2D3748] rounded-xl">
          <span className="text-xs text-[#6B7280]">{t.weightedPreview}</span>
          <span className="text-lg font-bold tabular-nums" style={{ color: starColor(preview) }}>
            {preview.toFixed(2)} / 5.00
          </span>
        </div>

        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          placeholder={t.commentsPlaceholder}
          rows={2}
          className="w-full bg-[#161B26] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] resize-none"
        />

        {error   && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
        {success && <p className="text-xs text-[#1D9E75] flex items-center gap-1"><i className="ti ti-check" />{success}</p>}

        <button onClick={submit} disabled={isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all">
          {isPending
            ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            : <i className="ti ti-star" />
          }
          {t.submit}
        </button>
      </div>

      {/* سجل التقييمات */}
      {history.length > 0 && (
        <div className="pt-3 border-t border-[#1F2937] space-y-2">
          <p className="text-xs font-medium text-[#6B7280]">{t.latestRatings}</p>
          {history.slice(0,5).map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-[#161B26] rounded-lg">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(s => (
                  <i key={s} className={`ti ti-star${Number(r.weightedAverage) >= s ? "-filled" : ""} text-[11px]`}
                     style={{ color: Number(r.weightedAverage) >= s ? starColor(Number(r.weightedAverage)) : "#2D3748" }} />
                ))}
              </div>
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: starColor(Number(r.weightedAverage)) }}>
                {Number(r.weightedAverage).toFixed(1)}
              </span>
              {r.comments && <span className="text-[11px] text-[#6B7280] flex-1 truncate">{r.comments}</span>}
              <span className="text-[10px] text-[#4B5563]">{new Date(r.ratingDate).toLocaleDateString(isAr ? "ar" : "en-US")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
