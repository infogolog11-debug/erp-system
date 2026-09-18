import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { grants } from "@/db/schema";
import { eq } from "drizzle-orm";
import BeneficiaryForm from "@/modules/beneficiaries/components/BeneficiaryForm";

export default async function NewBeneficiaryPage() {
  const session = await auth();
  if (!session?.user) return null;
  const orgId = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "beneficiaries", session.user.role);
  if (!canView(__perm)) redirect("/");

  const allGrants = await db.query.grants.findMany({
    where: eq(grants.organizationId, orgId),
    columns: { id:true, name:true, nameAr:true, code:true },
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">تسجيل مستفيد جديد</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">أدخل بيانات المستفيد — سيتم فحص الازدواجية تلقائياً</p>
      </div>
      <BeneficiaryForm grants={allGrants} organizationId={orgId} userId={session.user.id} />
    </div>
  );
}
