import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { getRequestPreferences } from "@/lib/preferences";
import PartnerForm from "@/modules/partners/components/PartnerForm";

export default async function NewPartnerPage() {
  const session = await auth();
  if (!session?.user) return null;
  const perm = await getUserPermission(session.user.id, session.user.organizationId, "partners", session.user.role);
  if (!canView(perm)) redirect("/");
  const prefs = await getRequestPreferences();
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">{prefs.locale === "ar" ? "تسجيل شريك منفّذ جديد" : "Register a new implementing partner"}</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Implementing Partner Registration</p>
      </div>
      <PartnerForm organizationId={session.user.organizationId} userId={session.user.id} locale={prefs.locale} />
    </div>
  );
}
