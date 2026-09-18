import { NextRequest, NextResponse } from "next/server";
import { auth }    from "@/auth";
import { db }      from "@/db";
import { grants, vendors, purchaseRequests, employees, assets } from "@/db/schema";
import { and, eq, or, ilike, sql } from "drizzle-orm";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error:"غير مصرح" }, { status:401 });

  const rl = checkRateLimit(`search:${session.user.id}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error:"عدد كبير من طلبات البحث — حاول لاحقاً" }, { status:429 });
  }

  const orgId = session.user.organizationId;
  const q     = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results:[] });

  const pattern = `%${q}%`;

  const [grantRes, vendorRes, prRes, empRes, assetRes] = await Promise.all([
    // المنح
    db.select({ id:grants.id, name:grants.name, code:grants.code, status:grants.status })
      .from(grants)
      .where(and(eq(grants.organizationId, orgId), or(ilike(grants.name, pattern), ilike(grants.code, pattern))))
      .limit(4),
    // الموردون
    db.select({ id:vendors.id, name:vendors.name, code:vendors.code, status:vendors.status })
      .from(vendors)
      .where(and(eq(vendors.organizationId, orgId), or(ilike(vendors.name, pattern), ilike(vendors.code, pattern))))
      .limit(4),
    // طلبات الشراء
    db.select({ id:purchaseRequests.id, title:purchaseRequests.title, code:purchaseRequests.code, status:purchaseRequests.status })
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.organizationId, orgId), or(ilike(purchaseRequests.title, pattern), ilike(purchaseRequests.code, pattern))))
      .limit(4),
    // الموظفون
    db.select({ id:employees.id, code:employees.code, firstName:employees.firstName, lastName:employees.lastName, firstNameAr:employees.firstNameAr, lastNameAr:employees.lastNameAr })
      .from(employees)
      .where(and(eq(employees.organizationId, orgId), or(
        ilike(employees.firstNameAr, pattern), ilike(employees.lastNameAr, pattern),
        ilike(employees.firstName, pattern), ilike(employees.code, pattern),
        ilike(employees.email, pattern),
      )))
      .limit(4),
    // الأصول
    db.select({ id:assets.id, code:assets.code, name:assets.name, assetCondition:assets.assetCondition })
      .from(assets)
      .where(and(eq(assets.organizationId, orgId), or(ilike(assets.name, pattern), ilike(assets.code, pattern))))
      .limit(3),
  ]);

  const results = [
    ...grantRes.map(r  => ({ type:"grant",   icon:"ti-coins",         color:"text-[#1D9E75]", label:r.name,   sub:r.code, status:r.status, href:`/grants/${r.id}` })),
    ...vendorRes.map(r => ({ type:"vendor",  icon:"ti-truck",         color:"text-[#EF9F27]", label:r.name,   sub:r.code, status:r.status, href:`/vendors/${r.id}` })),
    ...prRes.map(r     => ({ type:"pr",      icon:"ti-shopping-cart", color:"text-[#378ADD]", label:r.title,  sub:r.code, status:r.status, href:`/procurement/requests/${r.id}` })),
    ...empRes.map(r    => ({ type:"employee",icon:"ti-user",          color:"text-[#A855F7]", label:`${r.firstNameAr??r.firstName} ${r.lastNameAr??r.lastName}`, sub:r.code, status:"", href:`/hr/employees/${r.id}` })),
    ...assetRes.map(r  => ({ type:"asset",   icon:"ti-building",      color:"text-[#6B7280]", label:r.name,   sub:r.code, status:r.assetCondition, href:`/inventory` })),
  ];

  return NextResponse.json({ results, query:q });
}
