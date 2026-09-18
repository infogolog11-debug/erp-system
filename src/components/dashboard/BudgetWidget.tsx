import { db }  from "@/db";
import { grants, grantBudgetLines } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Link    from "next/link";

export default async function BudgetWidget({ organizationId }: { organizationId:string }) {
  const lines = await db.query.grantBudgetLines.findMany({
    where: eq(grantBudgetLines.organizationId, organizationId),
    with:  { grant: { columns:{ name:true, code:true } } },
    limit: 6,
  });

  const fmt = (n:number) => n >= 1000 ? `${(n/1000).toFixed(0)}K` : String(n);

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-chart-bar text-[#0F6E56]" />حالة الميزانيات
        </h2>
        <Link href="/grants" className="text-xs text-[#0F6E56] hover:text-[#1D9E75]">عرض الكل</Link>
      </div>
      <div className="p-4 space-y-3">
        {lines.length === 0 ? (
          <p className="text-sm text-[#4B5563] text-center py-6">لا توجد بيانات ميزانية</p>
        ) : lines.map(l => {
          const planned  = Number(l.plannedAmount);
          const spent    = Number(l.spentAmount);
          const pct      = planned > 0 ? (spent / planned * 100) : 0;
          const warnThreshold = l.warningThreshold ?? 80;
          const barColor = pct >= 95 ? "#E24B4A" : pct >= warnThreshold ? "#EF9F27" : "#0F6E56";

          return (
            <div key={l.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-[#4B5563] shrink-0">
                    {l.grant?.code}
                  </span>
                  <span className="text-xs text-[#9CA3AF] truncate">{l.nameAr ?? l.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pct >= warnThreshold && (
                    <i className={`ti ti-alert-triangle text-[12px] ${pct>=95?"text-[#E24B4A]":"text-[#EF9F27]"}`} />
                  )}
                  <span className="text-xs font-semibold tabular-nums" style={{ color:barColor }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{
                  width: `${Math.min(pct,100)}%`,
                  background: barColor,
                }} />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[#2D3748]">{fmt(spent)} منفق</span>
                <span className="text-[10px] text-[#2D3748]">{fmt(planned)} مخطط</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
