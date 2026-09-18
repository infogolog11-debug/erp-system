// src/modules/vendors/components/VendorHeader.tsx
"use client";
import Link from "next/link";
export default function VendorHeader({ total, role }: { total:number; role:string }) {
  const canCreate = ["super_admin","admin","procurement_officer"].includes(role);
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-lg font-semibold text-white">الموردون</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{total} مورد مسجل</p>
      </div>
      {canCreate && (
        <Link href="/vendors/new" className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
          <i className="ti ti-plus text-[16px]" aria-hidden="true" />مورد جديد
        </Link>
      )}
    </div>
  );
}
