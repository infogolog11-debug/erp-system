// src/app/(dashboard)/vendors/tenders/new/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canCreate } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { currencies } from "@/db/schema";
import { eq } from "drizzle-orm";
import TenderForm from "@/modules/vendors/components/TenderForm";
import { getRequestPreferences } from "@/lib/preferences";

export default async function NewTenderPage() {
  const session = await auth();
  if (!session?.user) return null;
  const prefs = await getRequestPreferences();
  const orgId   = session.user.organizationId;
  const __perm = await getUserPermission(session.user.id, orgId, "vendors", session.user.role);
  if (!canCreate(__perm)) redirect("/");
  const allCurrencies = await db.query.currencies.findMany({ where: eq(currencies.isActive, true) });
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">{prefs.locale === "ar" ? "مناقصة جديدة" : "New tender"}</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{prefs.locale === "ar" ? "أدخل بيانات المناقصة" : "Enter tender details"}</p>
      </div>
      <TenderForm currencies={allCurrencies} organizationId={orgId} userId={session.user.id} locale={prefs.locale} />
    </div>
  );
}
