import { auth }     from "@/auth";
import { redirect } from "next/navigation";
import { db }       from "@/db";
import { approvalRules, users } from "@/db/schema";
import { eq }       from "drizzle-orm";
import ApprovalMatrixPanel from "@/modules/settings/components/ApprovalMatrixPanel";

export default async function ApprovalMatrixPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const role    = session.user.role;
  const orgId   = session.user.organizationId;
  if (role !== "admin" && role !== "super_admin") redirect("/");

  const [rules, usersList] = await Promise.all([
    db.query.approvalRules.findMany({
      where: eq(approvalRules.organizationId, orgId),
      orderBy: (t, { asc }) => [asc(t.moduleCode), asc(t.minAmount), asc(t.approvalLevel)],
    }),
    db.query.users.findMany({
      where: eq(users.organizationId, orgId),
    }),
  ]);

  return (
    <ApprovalMatrixPanel
      orgId={orgId}
      rules={rules.map(r => ({
        id:            r.id,
        moduleCode:    r.moduleCode,
        minAmount:     Number(r.minAmount),
        maxAmount:     r.maxAmount ? Number(r.maxAmount) : null,
        approvalLevel: r.approvalLevel,
        levelName:     r.levelNameAr ?? r.levelName,
        approverUserId:r.approverUserId ?? null,
        approverRole:  r.approverRole  ?? null,
        slaHours:      r.slaHours ?? 48,
        isActive:      r.isActive,
      }))}
      users={usersList.map(u => ({ id:u.id, name:u.firstNameAr ?? u.firstName ?? u.email, role: u.role }))}
    />
  );
}
