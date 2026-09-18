// src/app/(dashboard)/inventory/page.tsx
import { auth } from "@/auth";
import { getUserPermission, canView } from "@/lib/permissions/service";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { items, assets, warehouses } from "@/db/schema";
import { eq, and, count, lt } from "drizzle-orm";
import ItemList       from "@/modules/inventory/components/ItemList";
import InventoryHeader from "@/modules/inventory/components/InventoryHeader";
import InventoryStats  from "@/modules/inventory/components/InventoryStats";
import PaginationBar from "@/components/shared/PaginationBar";
import { parsePagination } from "@/lib/pagination/parse";

export default async function InventoryPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ tab?:string; page?:string }> }) {
  const searchParams = await searchParamsPromise;
  const session = await auth();
  if (!session?.user) return null;
  const orgId   = session.user.organizationId;
  const role   = session.user.role;
  const __perm = await getUserPermission(session.user.id, orgId, "inventory", session.user.role);
  if (!canView(__perm)) redirect("/");
  const tab     = searchParams.tab ?? "items";

  // إصلاح (v34-تتمة-3، بند مفتوح موثّق بـSECURITY_NOTES.md § v32): كانت
  // هذه الصفحة تجلب كل الأصناف وكل الأصول الثابتة بلا حد أقصى، وكلتيهما
  // معاً حتى لو كان التبويب المعروض واحداً فقط. الآن: نجلب فقط قائمة
  // التبويب النشط، مُقسَّمة لصفحات، مع عدّاد إجمالي منفصل خفيف لكل تبويب
  // (يبقى دقيقاً بالإحصائيات بغض النظر عن الصفحة المعروضة).
  const { limit, offset, page } = parsePagination(searchParams);
  const itemsWhere = and(eq(items.organizationId, orgId), eq(items.isArchived, false));
  const assetsWhere = and(eq(assets.organizationId, orgId), eq(assets.isArchived, false));

  const [pageItems, pageAssets, itemsTotalRow, assetsTotalRow, lowStockCount, warehouseCount] = await Promise.all([
    tab === "items" ? db.query.items.findMany({
      where: itemsWhere,
      with: { category: true },
      orderBy: (t, { asc }) => [asc(t.name)],
      limit: limit + 1,
      offset,
    }) : Promise.resolve([]),
    tab === "assets" ? db.query.assets.findMany({
      where: assetsWhere,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: limit + 1,
      offset,
    }) : Promise.resolve([]),
    db.select({ c: count() }).from(items).where(itemsWhere),
    db.select({ c: count() }).from(assets).where(assetsWhere),
    db.select({ c: count() }).from(items)
      .where(and(eq(items.organizationId, orgId), lt(items.currentStock, items.minStock))),
    db.select({ c: count() }).from(warehouses).where(eq(warehouses.organizationId, orgId)),
  ]);

  const activeRows = tab === "assets" ? pageAssets : pageItems;
  const hasNextPage = activeRows.length > limit;
  const allItems = tab === "items" ? (hasNextPage ? pageItems.slice(0, limit) : pageItems) : [];
  const allAssets = tab === "assets" ? (hasNextPage ? pageAssets.slice(0, limit) : pageAssets) : [];
  const itemsTotal = itemsTotalRow[0].c;
  const assetsTotal = assetsTotalRow[0].c;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <InventoryHeader role={session.user.role} tab={tab} />
      <InventoryStats totalItems={itemsTotal} totalAssets={assetsTotal} lowStock={lowStockCount[0].c} warehouses={warehouseCount[0].c} />
      {tab === "assets" ? <AssetList assets={allAssets} /> : <ItemList items={allItems} />}
      <PaginationBar
        basePath="/inventory" currentPage={page} hasNextPage={hasNextPage}
        totalCount={tab === "assets" ? assetsTotal : itemsTotal} pageSize={limit}
        extraParams={{ tab }}
      />
    </div>
  );
}

import type { AssetDisplay } from "@/types/db";

function AssetList({ assets }: { assets: AssetDisplay[] }) {
  const CONDITION: Record<string,{bg:string;text:string;label:string}> = {
    new:  { bg:"bg-[#001A12]",  text:"text-[#1D9E75]", label:"جديد" },
    good: { bg:"bg-[#0A1628]",  text:"text-[#378ADD]", label:"جيد" },
    fair: { bg:"bg-[#271E0A]",  text:"text-[#EF9F27]", label:"مقبول" },
    poor: { bg:"bg-[#2A1215]",  text:"text-[#E24B4A]", label:"رديء" },
  };
  if (assets.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-box text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">لا توجد أصول ثابتة</p>
    </div>
  );
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","الأصل","تاريخ الشراء","التكلفة","القيمة الحالية","الحالة","الموقع"].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((a, i) => {
            const cond = CONDITION[a.assetCondition] ?? CONDITION.good;
            return (
              <tr key={a.id} className={`hover:bg-[#161B26] ${i < assets.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{a.code}</td>
                <td className="px-4 py-3 font-medium text-[#D1D5DB]">{a.name}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{new Date(a.purchaseDate).toLocaleDateString("ar-SA")}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280] tabular-nums">{Number(a.purchaseCost).toLocaleString("ar-SA")}</td>
                <td className="px-4 py-3 text-xs text-[#1D9E75] font-medium tabular-nums">{a.currentValue ? Number(a.currentValue).toLocaleString("ar-SA") : "—"}</td>
                <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${cond.bg} ${cond.text}`}>{cond.label}</span></td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{a.location ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
