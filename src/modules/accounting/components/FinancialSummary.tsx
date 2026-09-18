// src/modules/accounting/components/FinancialSummary.tsx
import type { AccountDisplay } from "@/types/db";

export default function FinancialSummary({ accounts }: { accounts: AccountDisplay[] }) {
  const byType = (type: string) =>
    accounts.filter(a => a.accountType === type)
      .reduce((s, a) => s + Number(a.currentBalance), 0);

  const totalAssets    = byType("asset");
  const totalLiab      = byType("liability");
  const totalRevenue   = byType("revenue");
  const totalExpense   = byType("expense");
  const netIncome      = totalRevenue - totalExpense;

  const cards = [
    { label:"إجمالي الأصول",   value:totalAssets,  color:"#378ADD", icon:"trending-up"  },
    { label:"إجمالي الخصوم",   value:totalLiab,    color:"#E24B4A", icon:"trending-down" },
    { label:"الإيرادات",        value:totalRevenue, color:"#1D9E75", icon:"coins"         },
    { label:"صافي الدخل",       value:netIncome,    color: netIncome >= 0 ? "#1D9E75" : "#E24B4A", icon:"calculator" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:`${c.color}15` }}>
              <i className={`ti ti-${c.icon} text-[18px]`} style={{ color:c.color }} aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums" style={{ color:c.color }}>
                {c.value.toLocaleString("ar-SA")}
              </p>
              <p className="text-xs text-[#4B5563] mt-0.5">{c.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
