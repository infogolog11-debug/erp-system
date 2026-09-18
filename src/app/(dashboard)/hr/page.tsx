// src/app/(dashboard)/hr/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { employees, departments, contracts } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import EmployeeList  from "@/modules/hr/components/EmployeeList";
import HRHeader      from "@/modules/hr/components/HRHeader";
import HRStats       from "@/modules/hr/components/HRStats";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function HRPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "hr", session.user.role);
  if (!canView(__perm)) redirect("/");

  // إصلاح (v34-تتمة-3، بند مفتوح موثّق بـSECURITY_NOTES.md § v32): كانت
  // هذه الصفحة تجلب كل موظفي المنظمة بلا حد أقصى — نفس نمط vendors/grants
  // المُصلَح سابقاً، بس لم يُطبَّق هنا. عدد الموظفين ينمو مع الوقت وهذا
  // كان يصير استعلاماً أثقل بكل فتح للصفحة.
  const { limit, offset, page } = parsePagination(searchParams);
  const where = and(eq(employees.organizationId, orgId), eq(employees.isArchived, false));

  const [pageEmployees, totalRow, deptCount, activeCount] = await Promise.all([
    db.query.employees.findMany({
      where,
      with: { department: true, position: true, contracts: { where: (c, { eq }) => eq(c.isCurrent, true), limit: 1 } },
      orderBy: (t, { asc }) => [asc(t.firstName)],
      limit: limit + 1,
      offset,
    }),
    db.select({ c: sql<number>`count(*)` }).from(employees).where(where),
    db.select({ c: count() }).from(departments).where(eq(departments.organizationId, orgId)),
    db.select({ c: count() }).from(employees).where(and(eq(employees.organizationId, orgId), eq(employees.isActive, true))),
  ]);

  const hasNextPage = pageEmployees.length > limit;
  const allEmployees = hasNextPage ? pageEmployees.slice(0, limit) : pageEmployees;
  const totalCount = Number(totalRow[0]?.c ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <HRHeader total={totalCount} role={session.user.role} />
      <HRStats totalEmployees={activeCount[0].c} totalDepts={deptCount[0].c} />
      <EmployeeList employees={allEmployees} />
      <PaginationBar
        basePath="/hr" currentPage={page} hasNextPage={hasNextPage}
        totalCount={totalCount} pageSize={limit}
      />
    </div>
  );
}
