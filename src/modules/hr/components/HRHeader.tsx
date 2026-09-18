// src/modules/hr/components/HRHeader.tsx
"use client";
import Link from "next/link";
export default function HRHeader({ total, role }: { total:number; role:string }) {
  const canCreate = ["super_admin","admin","hr_manager"].includes(role);
  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div><h1 className="text-lg font-semibold text-white">الموارد البشرية</h1><p className="text-sm text-[#6B7280] mt-0.5">{total} موظف</p></div>
      <div className="flex items-center gap-3">
        <Link href="/hr/payroll" className="flex items-center gap-2 bg-[#161B26] border border-[#1F2937] hover:border-[#2D3748] text-[#D1D5DB] text-sm font-medium px-4 py-2 rounded-xl transition-all">
          <i className="ti ti-calculator text-[16px]" aria-hidden="true" />الرواتب
        </Link>
        {canCreate && <Link href="/hr/employees/new" className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all"><i className="ti ti-user-plus text-[16px]" aria-hidden="true" />موظف جديد</Link>}
      </div>
    </div>
  );
}
