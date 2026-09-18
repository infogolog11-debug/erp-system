// src/modules/grants/components/SmartButtons.tsx
import { db } from "@/db";
import { purchaseRequests, payrollLines, budgetAllocations } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import Link from "next/link";

interface SmartButtonsProps {
  grantId: string;
  organizationId: string;
}

export default async function SmartButtons({ grantId, organizationId }: SmartButtonsProps) {
  const [prs, payrolls, allocations] = await Promise.all([
    db.select({ c: count() }).from(purchaseRequests)
      .where(and(eq(purchaseRequests.grantId, grantId), eq(purchaseRequests.isArchived, false))),
    db.select({ c: count() }).from(payrollLines)
      .where(eq(payrollLines.grantId, grantId)),
    db.select({ c: count() }).from(budgetAllocations)
      .where(eq(budgetAllocations.grantId, grantId)),
  ]);

  const buttons = [
    { label:"طلبات الشراء", count: prs[0].c,        icon:"shopping-cart", href:`/procurement?grantId=${grantId}`,  color:"blue"   },
    { label:"الرواتب",      count: payrolls[0].c,    icon:"users",         href:`/hr/payroll?grantId=${grantId}`,   color:"purple" },
    { label:"التخصيصات",   count: allocations[0].c,  icon:"coins",         href:`/grants/${grantId}/allocations`,   color:"teal"   },
  ];

  const COLOR: Record<string,string> = {
    blue:   "border-[#185FA5]/30 hover:border-[#185FA5]/60 text-[#378ADD]",
    purple: "border-[#534AB7]/30 hover:border-[#534AB7]/60 text-[#7F77DD]",
    teal:   "border-[#0F6E56]/30 hover:border-[#0F6E56]/60 text-[#1D9E75]",
  };

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <Link
          key={b.label}
          href={b.href}
          className={`flex items-center gap-2.5 px-4 py-2 bg-[#0F1117] border rounded-xl text-sm transition-all group ${COLOR[b.color]}`}
        >
          <i className={`ti ti-${b.icon} text-[16px]`} aria-hidden="true" />
          <span className="text-[#9CA3AF] group-hover:text-[#D1D5DB] transition-colors">{b.label}</span>
          <span className={`font-semibold tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-[#161B26]`}>
            {b.count}
          </span>
        </Link>
      ))}
    </div>
  );
}
