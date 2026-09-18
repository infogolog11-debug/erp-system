import { auth }     from "@/auth";
import { redirect } from "next/navigation";
import { db }       from "@/db";
import { users }    from "@/db/schema";
import { eq }       from "drizzle-orm";
import UsersPanel   from "@/modules/settings/components/UsersPanel";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/");
  const role    = session.user.role;
  const orgId   = session.user.organizationId;
  if (role !== "admin" && role !== "super_admin") redirect("/");

  // كان بدون أي حد أعلى (نفس فئة "51 استدعاء findMany غير مُراجَع" الموثّقة
  // بـSECURITY_NOTES). سقف دفاعي يكفي أضعاف أي عدد مستخدمين واقعي بمنظمة
  // واحدة، يمنع فقط سيناريو تحميل عدد غير محدود من السجلات دفعة واحدة.
  const usersList = await db.query.users.findMany({
    where: eq(users.organizationId, orgId),
    orderBy: (u, { asc }) => [asc(u.role)],
    limit: 500,
  });

  return (
    <UsersPanel
      orgId={orgId}
      users={usersList.map(u => ({
        id:       u.id,
        email:    u.email,
        name:     `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim(),
        nameAr:   `${u.firstNameAr ?? ""} ${u.lastNameAr ?? ""}`.trim(),
        role:     u.role,
        isActive: u.isActive ?? true,
        createdAt:u.createdAt.toISOString(),
      }))}
    />
  );
}
