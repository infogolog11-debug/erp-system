// src/app/(dashboard)/inventory/new/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { itemCategories } from "@/db/schema";
import { eq } from "drizzle-orm";
import ItemForm from "@/modules/inventory/components/ItemForm";
import { getRequestPreferences } from "@/lib/preferences";

export default async function NewItemPage() {
  const session = await auth();
  if (!session?.user) return null;
  const prefs = await getRequestPreferences();
  const orgId = session.user.organizationId;
  const role = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "inventory", role);
  
  if (!canView(__perm)) redirect("/");

  const allCategories = await db.query.itemCategories.findMany({
    where: eq(itemCategories.organizationId, orgId),
    orderBy: (t, { asc }) => [asc(t.name)],
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">
          {prefs.locale === "ar" ? "صنف جديد" : "New Item"}
        </h1>
        <p className="text-sm text-[#6B7280] mt-0.5">
          {prefs.locale === "ar" 
            ? "أضف صنفاً جديداً للمخزون أو الأصول" 
            : "Add a new item to inventory or assets"}
        </p>
      </div>
      <ItemForm 
        categories={allCategories} 
        organizationId={orgId} 
        userId={session.user.id} 
        locale={prefs.locale}
      />
    </div>
  );
}
