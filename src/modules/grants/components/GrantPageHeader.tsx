// src/modules/grants/components/GrantPageHeader.tsx
"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/lib/preferences";

export default function GrantPageHeader({
  total, currentView, role, locale,
}: { total: number; currentView: string; role: string; locale: AppLocale }) {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const t = locale === "ar"
    ? {
        title: "إدارة المنح",
        total: `${total} منحة في النظام`,
        kanban: "كانبان",
        list: "قائمة",
        newGrant: "منحة جديدة",
      }
    : {
        title: "Grant management",
        total: `${total} grants in the system`,
        kanban: "Kanban",
        list: "List",
        newGrant: "New grant",
      };

  function switchView(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`/grants?${params.toString()}`);
  }

  const canCreate = ["super_admin","admin","finance_manager","program_manager"].includes(role);

  return (
    <div className="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-lg font-semibold text-white">{t.title}</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{t.total}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* View Toggle */}
        <div className="flex items-center bg-[#161B26] border border-[#1F2937] rounded-xl p-1 gap-1">
          {[
            { v:"kanban", icon:"layout-kanban", label:t.kanban },
            { v:"list",   icon:"list",          label:t.list },
          ].map(({ v, icon, label }) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                currentView === v
                  ? "bg-[#0F6E56] text-white shadow-sm"
                  : "text-[#6B7280] hover:text-[#D1D5DB]"
              }`}
            >
              <i className={`ti ti-${icon} text-[14px]`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        {canCreate && (
          <Link
            href="/grants/new"
            className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all shadow-lg shadow-[#0F6E56]/20"
          >
            <i className="ti ti-plus text-[16px]" aria-hidden="true" />
            {t.newGrant}
          </Link>
        )}
      </div>
    </div>
  );
}
