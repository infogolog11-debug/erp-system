import { NextRequest, NextResponse } from "next/server";
import { auth }        from "@/auth";
import { db }          from "@/db";
import { grants, grantBudgetLines, donors } from "@/db/schema";
import { eq }          from "drizzle-orm";
import { buildGrantsSheetData } from "@/lib/export/excel-generator";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });
  const orgId = session.user.organizationId;

  const grantsList = await db.query.grants.findMany({
    where: eq(grants.organizationId, orgId),
    with: { donor: { columns:{ name:true, nameAr:true } }, budgetLines: true },
  });

  const data = buildGrantsSheetData(grantsList.map(g => {
    const totalSpent = g.budgetLines.reduce((s,l) => s + Number(l.spentAmount ?? 0), 0);
    const totalComm  = g.budgetLines.reduce((s,l) => s + Number(l.committedAmount ?? 0), 0);
    return {
      code:            g.code,
      name:            g.name,
      donor:           g.donor?.nameAr ?? g.donor?.name ?? "",
      totalAmount:     Number(g.totalAmount ?? 0),
      spentAmount:     totalSpent,
      committedAmount: totalComm,
      status:          g.status,
      startDate:       g.startDate ? new Date(g.startDate).toLocaleDateString("ar") : "",
      endDate:         g.endDate   ? new Date(g.endDate).toLocaleDateString("ar")   : "",
    };
  }));

  return NextResponse.json(data, {
    headers: { "Content-Type":"application/json" }
  });
}
