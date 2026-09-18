// صفحة البيانات الأساسية — CRUD لكل الجداول الثابتة
import { auth }     from "@/auth";
import { redirect } from "next/navigation";
import { db }       from "@/db";
import {
  departments, positions, costCenters, currencies,
  itemCategories, warehouses, donors,
} from "@/db/schema";
import { eq }       from "drizzle-orm";
import MasterDataPage from "@/modules/settings/components/MasterDataPage";

export default async function MasterDataAdminPage() {
  const session = await auth();
  if (!session?.user) return null;
  const role    = session.user.role;
  const orgId   = session.user.organizationId;
  if (role !== "admin" && role !== "super_admin") redirect("/");

  const [depts, positions_, costCenters_, currencies_, categories, warehouses_, donors_] =
    await Promise.all([
      db.query.departments.findMany({ where: eq(departments.organizationId, orgId) }),
      db.query.positions.findMany({   where: eq(positions.organizationId,   orgId) }),
      db.query.costCenters.findMany({ where: eq(costCenters.organizationId, orgId) }),
      db.query.currencies.findMany({  where: eq(currencies.isActive, true) }),
      db.query.itemCategories.findMany({ where: eq(itemCategories.organizationId, orgId) }),
      db.query.warehouses.findMany({  where: eq(warehouses.organizationId,  orgId) }),
      db.query.donors.findMany({      where: eq(donors.organizationId,      orgId) }),
    ]);

  return (
    <MasterDataPage
      orgId={orgId}
      data={{
        departments:    depts,
        positions:      positions_,
        costCenters:    costCenters_,
        currencies:     currencies_,
        itemCategories: categories,
        warehouses:     warehouses_,
        donors:         donors_,
      }}
    />
  );
}
