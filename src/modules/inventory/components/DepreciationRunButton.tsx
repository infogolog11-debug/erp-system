// src/modules/inventory/components/DepreciationRunButton.tsx
// تشغيل الاستهلاك الشهري لجميع الأصول النشطة — يربط runBatchDepreciation
// (كانت بلا أي واجهة ولا مهمة دورية، فلم يكن الاستهلاك الشهري قابلاً للتشغيل أصلاً).
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runBatchDepreciation } from "@/modules/inventory/actions";
import type { AppLocale } from "@/lib/preferences";

export default function DepreciationRunButton({
  organizationId, userId, locale = "ar",
}: { organizationId: string; userId: string; locale?: AppLocale }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [postToAccounting, setPostToAccounting] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<{ processed: number; skipped: number; errors: string[] } | null>(null);

  const t = locale === "ar"
    ? {
        title: "الاستهلاك الشهري",
        hint: "يحتسب استهلاك كل الأصول النشطة للفترة المحددة (سجل واحد لكل أصل وفترة).",
        period: "الفترة",
        post: "ترحيل إلى المحاسبة",
        run: "تشغيل الاستهلاك",
        processed: "تم",
        skipped: "مُتخطّى (مسجل مسبقاً)",
        errors: "أخطاء",
      }
    : {
        title: "Monthly depreciation",
        hint: "Computes depreciation for all active assets in the selected period (one record per asset per period).",
        period: "Period",
        post: "Post to accounting",
        run: "Run depreciation",
        processed: "Processed",
        skipped: "Skipped (already recorded)",
        errors: "Errors",
      };

  function run() {
    setError(""); setSummary(null);
    start(async () => {
      const res = await runBatchDepreciation(period, userId, organizationId, postToAccounting);
      if (!res.success) { setError(res.error); return; }
      setSummary(res.data);
      router.refresh();
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ti ti-calculator text-[#0F6E56]" />{t.title}
          </h2>
          <p className="text-[11px] text-[#4B5563] mt-0.5">{t.hint}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month" value={period} onChange={e => setPeriod(e.target.value)}
            className="bg-[#161B26] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0F6E56]"
          />
          <label className="flex items-center gap-1.5 text-xs text-[#9CA3AF] cursor-pointer select-none">
            <input
              type="checkbox" checked={postToAccounting} onChange={e => setPostToAccounting(e.target.checked)}
              className="accent-[#0F6E56]"
            />
            {t.post}
          </label>
          <button
            type="button" onClick={run} disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#1D9E75] transition-all disabled:opacity-50"
          >
            {isPending ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : <i className="ti ti-player-play text-[14px]" />}
            {t.run}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

      {summary && (
        <div className="flex items-center gap-4 text-xs pt-1 border-t border-[#1F2937] flex-wrap">
          <span className="text-[#1D9E75]">{t.processed}: <strong>{summary.processed}</strong></span>
          <span className="text-[#6B7280]">{t.skipped}: <strong>{summary.skipped}</strong></span>
          {summary.errors.length > 0 && (
            <span className="text-[#E24B4A]">{t.errors}: <strong>{summary.errors.length}</strong> — {summary.errors.slice(0, 3).join(" · ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
