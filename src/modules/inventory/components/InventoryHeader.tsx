// src/modules/inventory/components/InventoryHeader.tsx
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/preferences";
export default function InventoryHeader({ role, tab, locale = "ar" }: { role:string; tab:string; locale?: AppLocale }) {
  const router = useRouter(); const sp = useSearchParams();
  const sw = (t:string) => { const p = new URLSearchParams(sp.toString()); p.set("tab",t); router.push(`/inventory?${p.toString()}`); };
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div><h1 className="text-lg font-semibold text-white">{locale === "ar" ? "المخزون والأصول" : "Inventory and assets"}</h1></div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-[#161B26] border border-[#1F2937] rounded-xl p-1 gap-1">
          {[{t:"items",l:locale === "ar" ? "الأصناف" : "Items",i:"package"},{t:"assets",l:locale === "ar" ? "الأصول" : "Assets",i:"box"}].map(({t,l,i})=>(
            <button key={t} onClick={()=>sw(t)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab===t?"bg-[#0F6E56] text-white":"text-[#6B7280] hover:text-[#D1D5DB]"}`}>
              <i className={`ti ti-${i} text-[14px]`} aria-hidden="true"/>{l}
            </button>
          ))}
        </div>
        {["super_admin","admin","warehouse_manager"].includes(role) && (
          <Link href="/inventory/new" className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
            <i className="ti ti-plus text-[16px]" aria-hidden="true"/>{locale === "ar" ? "صنف جديد" : "New item"}
          </Link>
        )}
      </div>
    </div>
  );
}
