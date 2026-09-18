import { auth }   from "@/auth";
import { redirect } from "next/navigation";
import { db }     from "@/db";
import { users, userModulePermissions } from "@/db/schema";
import { eq }     from "drizzle-orm";
import PermissionsPanel from "@/modules/settings/components/PermissionsPanel";
import { ROLE_DEFAULTS } from "@/lib/permissions/defaults";

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const role    = session.user.role;
  const orgId   = session.user.organizationId;
  const myId    = session.user.id;
  if (role !== "admin" && role !== "super_admin") redirect("/");

  const [allUsers, existingPerms] = await Promise.all([
    db.query.users.findMany({ where: eq(users.organizationId, orgId) }),
    db.query.userModulePermissions.findMany({ where: eq(userModulePermissions.organizationId, orgId) }),
  ]);

  return (
    <PermissionsPanel
      orgId={orgId}
      grantedBy={myId}
      users={allUsers.map(u => ({
        id:    u.id,
        email: u.email,
        name:  u.firstNameAr ?? u.firstName ?? u.email,
        role:  u.role,
      }))}
      existingPerms={existingPerms.map(p => ({
        userId:     p.userId,
        moduleCode: p.moduleCode,
        permission: p.permission,
      }))}
    />
  );
}
