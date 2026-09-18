// src/modules/hr/components/EmployeeList.tsx
import Link from "next/link";

import type { EmployeeDisplay } from "@/types/db";

export default function EmployeeList({ employees }: { employees: EmployeeDisplay[] }) {
  if (employees.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-users text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">لا يوجد موظفون بعد</p>
    </div>
  );
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الموظف","الكود","القسم","المنصب","العقد","الحالة",""].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, i) => {
            const contract = emp.contracts?.[0];
            return (
              <tr key={emp.id} className={`hover:bg-[#161B26] transition-colors ${i < employees.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#0F6E56]/20 border border-[#0F6E56]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[#1D9E75]">
                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                      </span>
                    </div>
                    <div>
                      <Link href={`/hr/employees/${emp.id}`} className="font-medium text-[#D1D5DB] hover:text-white">
                        {emp.firstName} {emp.lastName}
                      </Link>
                      {emp.email && <p className="text-[11px] text-[#4B5563]">{emp.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{emp.code}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{emp.department?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{emp.position?.title ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">
                  {contract ? (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />
                      {contract.contractType}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${emp.isActive ? "bg-[#001A12] text-[#1D9E75]" : "bg-[#2A1215] text-[#E24B4A]"}`}>
                    {emp.isActive ? "نشط" : "غير نشط"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/hr/employees/${emp.id}`} className="text-[#4B5563] hover:text-[#0F6E56] transition-colors">
                    <i className="ti ti-chevron-left text-[16px]" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
