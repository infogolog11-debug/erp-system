import { auth }    from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db }      from "@/db";
import { grants, grantBudgetLines, currencies } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import PRForm      from "@/modules/procurement/components/PRForm";

export default async function NewPRPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "procurement", session.user.role);
  if (!canView(__perm)) redirect("/");
  const userId  = session.user.id;

  const [grantsList, currenciesList] = await Promise.all([
    db.query.grants.findMany({
      where: and(eq(grants.organizationId, orgId), eq(grants.isArchived, false)),
      with:  { budgetLines: {
        where: eq(grantBudgetLines.isArchived, false),
        columns: { id:true, name:true, nameAr:true, plannedAmount:true, spentAmount:true, warningThreshold:true, blockThreshold:true },
      }},
      columns: { id:true, name:true, code:true, status:true },
    }),
    db.query.currencies.findMany({ where: eq(currencies.isActive, true) }),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-plus text-[#0F6E56]" />طلب شراء جديد
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          يتم التحقق من الميزانية ومستويات الموافقة تلقائياً
        </p>
      </div>
      <PRForm
        grants={grantsList}
        currencies={currenciesList}
        organizationId={orgId}
        userId={userId}
      />
    </div>
  );
}
