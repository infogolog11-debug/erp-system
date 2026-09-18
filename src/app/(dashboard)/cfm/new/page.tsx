import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import CFMForm from "@/modules/cfm/components/CFMForm";

export default async function NewComplaintPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "cfm", session.user.role);
  if (!canView(__perm)) redirect("/");

  const orgGrants = await db.query.grants.findMany({
    where: eq(grants.organizationId, orgId),
    columns: { id:true, name:true, nameAr:true },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">تسجيل شكوى / ملاحظة جديدة</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Complaint & Feedback Intake — يمكن التسجيل بشكل مجهول</p>
      </div>
      <CFMForm organizationId={orgId} userId={session.user.id} orgGrants={orgGrants} />
    </div>
  );
}
