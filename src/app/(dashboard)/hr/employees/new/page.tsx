import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { departments, positions, currencies } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { getRequestPreferences } from "@/lib/preferences";
import EmployeeForm from "@/modules/hr/components/EmployeeForm";

export default async function NewEmployeePage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId = session.user.organizationId;
  const perm = await getUserPermission(session.user.id, orgId, "hr", session.user.role);
  if (!canView(perm)) redirect("/");

  const prefs = await getRequestPreferences();

  const [deptRows, positionRows, currencyRows] = await Promise.all([
    db.select({ id: departments.id, name: departments.name, nameAr: departments.nameAr })
      .from(departments)
      .where(and(eq(departments.organizationId, orgId), eq(departments.isArchived, false)))
      .orderBy(asc(departments.name)),
    db.select({ id: positions.id, title: positions.title, titleAr: positions.titleAr, departmentId: positions.departmentId })
      .from(positions)
      .where(and(eq(positions.organizationId, orgId), eq(positions.isArchived, false)))
      .orderBy(asc(positions.title)),
    db.select({ id: currencies.id, code: currencies.code })
      .from(currencies)
      .where(eq(currencies.isActive, true))
      .orderBy(asc(currencies.code)),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          {prefs.locale === "ar" ? "تسجيل وكيل جديد" : "Register a new agent"}
        </h1>
      </div>
      <EmployeeForm
        departments={deptRows}
        positions={positionRows}
        currencies={currencyRows}
        organizationId={orgId}
        userId={session.user.id}
        locale={prefs.locale}
      />
    </div>
  );
}
