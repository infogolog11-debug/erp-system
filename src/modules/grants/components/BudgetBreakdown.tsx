// src/modules/grants/components/BudgetBreakdown.tsx
const CATEGORY_LABELS: Record<string,string> = {
  staff:"الموارد البشرية", supplies:"المستلزمات", services:"الخدمات",
  travel:"السفر والتنقل", other:"أخرى",
};

export default function BudgetBreakdown({
  lines, totalAmount,
}: { lines: import("@/types/db").BudgetLineDisplay[]; totalAmount: string | number }) {
  const total = Number(totalAmount);

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">توزيع الميزانية</h2>
        <span className="text-xs text-[#4B5563]">{lines.length} بند</span>
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-[#374151] text-center py-4">لا توجد بنود ميزانية</p>
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
                        {CATEGORY_LABELS[line.budgetCategory] ?? line.budgetCategory}
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
                    { l:"مخطط",   v: planned,   c:"text-[#6B7280]" },
                    { l:"منصرف",  v: spent,      c:"text-[#1D9E75]" },
                    { l:"ملتزم",  v: committed,  c:"text-[#378ADD]" },
                    { l:"متاح",   v: available,  c: available < 0 ? "text-[#E24B4A]" : "text-[#9CA3AF]" },
                  ].map(({ l, v, c }) => (
                    <div key={l}>
                      <p className="text-[9px] text-[#374151] mb-0.5">{l}</p>
                      <p className={`text-xs font-semibold tabular-nums ${c}`}>
                        {v.toLocaleString("ar-SA")}
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
