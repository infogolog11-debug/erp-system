// src/app/(dashboard)/accounting/new/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { fiscalPeriods, accounts, currencies, grants } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import JournalEntryForm from "@/modules/accounting/components/JournalEntryForm";
import { getRequestPreferences } from "@/lib/preferences";

export default async function NewJournalEntryPage() {
  const session = await auth();
  if (!session?.user) return null;
  const prefs = await getRequestPreferences();
  const orgId = session.user.organizationId;
  const role = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "accounting", role);
  
  if (!canView(__perm)) redirect("/");

  const [allPeriods, allAccounts, allCurrencies, allGrants] = await Promise.all([
    db.query.fiscalPeriods.findMany({
      where: and(eq(fiscalPeriods.organizationId, orgId), eq(fiscalPeriods.isClosed, false)),
      orderBy: (t, { desc }) => [desc(t.startDate)],
    }),
    db.query.accounts.findMany({
      where: and(eq(accounts.organizationId, orgId), eq(accounts.isActive, true)),
      orderBy: (t, { asc }) => [asc(t.code)],
    }),
    db.query.currencies.findMany({
      where: eq(currencies.isActive, true),
    }),
    db.query.grants.findMany({
      where: and(eq(grants.organizationId, orgId), eq(grants.status, "approved")),
    }),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          {prefs.locale === "ar" ? "قيد محاسبي جديد" : "New Journal Entry"}
        </h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {prefs.locale === "ar" 
            ? "سجل حركة مالية جديدة يدوياً" 
            : "Record a new financial transaction manually"}
        </p>
      </div>
      <JournalEntryForm 
        periods={allPeriods}
        accounts={allAccounts}
        currencies={allCurrencies}
        grants={allGrants}
        organizationId={orgId}
        userId={session.user.id}
        locale={prefs.locale}
      />
    </div>
  );
}
