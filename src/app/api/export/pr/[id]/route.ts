import { NextRequest, NextResponse } from "next/server";
import { auth }           from "@/auth";
import { db }             from "@/db";
import { purchaseRequests, purchaseRequestItems } from "@/db/schema";
import { eq, and }        from "drizzle-orm";
import { generatePRHTML } from "@/lib/export/pdf-generator";

export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });
  const orgId = session.user.organizationId;

  const pr = await db.query.purchaseRequests.findFirst({
    where: and(eq(purchaseRequests.id, params.id), eq(purchaseRequests.organizationId, orgId)),
    with: {
      items:  true,
      grant:  { columns:{ name:true } },
    },
  });
  if (!pr) return NextResponse.json({ error:"غير موجود" }, { status:404 });

  const html = generatePRHTML({
    orgName:      "منظمتي",
    prCode:       pr.code,
    title:        pr.title,
    status:       pr.status,
    grantName:    pr.grant?.name,
    requestDate:  new Date(pr.createdAt).toLocaleDateString("ar"),
    requiredDate: pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString("ar") : undefined,
    requestedBy:  session.user.nameAr ?? session.user.name ?? "",
    items: (pr.items ?? []).map((it:any) => ({
      description: it.description,
      unit:        it.unit,
      quantity:    Number(it.quantity),
      unitPrice:   Number(it.estimatedUnitPrice ?? 0),
      total:       Number(it.quantity) * Number(it.estimatedUnitPrice ?? 0),
    })),
    totalAmount:  pr.items?.reduce((s:number,it:any) => s + Number(it.quantity)*Number(it.estimatedUnitPrice??0), 0) ?? 0,
    justification: pr.justification ?? undefined,
  });

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="PR-${pr.code}.html"`,
    },
  });
}
