// src/modules/grants/components/BudgetBreakdown.tsx
import type { AppLocale } from "@/lib/preferences";
import { getLocaleTag } from "@/lib/i18n";

const CATEGORY_LABELS: Record<AppLocale, Record<string,string>> = {
  ar: {
    staff:"الموارد البشرية", supplies:"المستلزمات", services:"الخدمات",
    travel:"السفر والتنقل", other:"أخرى",
  },
  en: {
    staff:"Human resources", supplies:"Supplies", services:"Services",
    travel:"Travel", other:"Other",
  },
};

export default function BudgetBreakdown({
  lines, totalAmount,
  locale = "ar",
}: { lines: import("@/types/db").BudgetLineDisplay[]; totalAmount: string | number; locale?: AppLocale }) {
  const total = Number(totalAmount);
  const localeTag = getLocaleTag(locale);
  const t = locale === "ar"
    ? { title: "توزيع الميزانية", lineCount: "بند", empty: "لا توجد بنود ميزانية", planned: "مخطط", spent: "منصرف", committed: "ملتزم", available: "متاح" }
    : { title: "Budget breakdown", lineCount: "lines", empty: "No budget lines", planned: "Planned", spent: "Spent", committed: "Committed", available: "Available" };

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">{t.title}</h2>
        <span className="text-xs text-[#4B5563]">{lines.length} {t.lineCount}</span>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-[#374151] text-center py-4">{t.empty}</p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => {
            const planned   = Number(line.plannedAmount);
            const spent     = Number(line.spentAmount);
            const committed = Number(line.committedAmount);
            const available = planned - spent - committed;
            const pct       = planned > 0 ? ((spent + committed) / planned) * 100 : 0;
            const isWarn    = pct > 80;

            return (
              <div key={line.id} className="p-3 bg-[#161B26] rounded-xl border border-[#1F2937]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#4B5563]">{line.code}</span>
                    <span className="text-sm font-medium text-[#D1D5DB]">{line.name}</span>
                    {line.budgetCategory && (
                      <span className="text-[10px] text-[#4B5563] bg-[#0F1117] px-1.5 py-0.5 rounded">
                        {CATEGORY_LABELS[locale][line.budgetCategory] ?? line.budgetCategory}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-semibold tabular-nums ${isWarn ? "text-[#EF9F27]" : "text-[#6B7280]"}`}>
                    {pct.toFixed(0)}%
                  </span>
                </div>

                <div className="h-1.5 bg-[#0F1117] rounded-full overflow-hidden mb-2">
                  <div className="h-full flex">
                    <div className="bg-[#0F6E56] rounded-full" style={{ width:`${Math.min(spent/planned*100,100)}%` }} />
                    <div className="bg-[#0F6E56]/30" style={{ width:`${Math.min(committed/planned*100,100-spent/planned*100)}%` }} />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { l:t.planned,   v: planned,   c:"text-[#6B7280]" },
                    { l:t.spent,  v: spent,      c:"text-[#1D9E75]" },
                    { l:t.committed,  v: committed,  c:"text-[#378ADD]" },
                    { l:t.available,   v: available,  c: available < 0 ? "text-[#E24B4A]" : "text-[#9CA3AF]" },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <p className="text-[9px] text-[#374151] mb-0.5">{l}</p>
                      <p className={`text-xs font-semibold tabular-nums ${c}`}>
                        {v.toLocaleString(localeTag)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
