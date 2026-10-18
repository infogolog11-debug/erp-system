// src/modules/procurement/components/PRPageHeader.tsx
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/preferences";

export default function PRPageHeader({total,currentView,role,locale}:{total:number;currentView:string;role:string;locale:AppLocale}){
  const router=useRouter();
  const sp=useSearchParams();
  const sw=(v:string)=>{const p=new URLSearchParams(sp.toString());p.set("view",v);router.push(`/procurement?${p.toString()}`);};
  const canCreate=["super_admin","admin","program_manager","procurement_officer"].includes(role);
  const t = locale === "ar"
    ? { title:"المشتريات", total:`${total} طلب`, kanban:"كانبان", list:"قائمة", newRequest:"طلب جديد" }
    : { title:"Procurement", total:`${total} requests`, kanban:"Kanban", list:"List", newRequest:"New request" };
  return(
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div><h1 className="text-lg font-semibold text-white">{t.title}</h1><p className="text-sm text-[#6B7280] mt-0.5">{t.total}</p></div>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-[#161B26] border border-[#1F2937] rounded-xl p-1 gap-1">
          {[{v:"kanban",icon:"layout-kanban",label:t.kanban},{v:"list",icon:"list",label:t.list}].map(({v,icon,label})=>(
            <button key={v} onClick={()=>sw(v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${currentView===v?"bg-[#0F6E56] text-white":"text-[#6B7280] hover:text-[#D1D5DB]"}`}>
              <i className={`ti ti-${icon} text-[14px]`}/>{label}
            </button>
          ))}
        </div>
        {canCreate&&<Link href="/procurement/new" className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"><i className="ti ti-plus text-[16px]"/>{t.newRequest}</Link>}
      </div>
    </div>
  );
}
