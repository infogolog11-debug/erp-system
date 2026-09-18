"use client";
import Link        from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn }      from "@/lib/utils";

const NAV_ITEMS = [
  { label:"لوحة التحكم",   href:"/",             icon:"home",          roles:["super_admin","admin","finance","hr","procurement","inventory","viewer"] },
  { label:"المنح",          href:"/grants",        icon:"coins",         roles:["super_admin","admin","finance","viewer"] },
  { label:"المستفيدون",     href:"/beneficiaries", icon:"users-group",   roles:["super_admin","admin","finance","viewer"] },
  { label:"الشركاء المنفّذون", href:"/partners",   icon:"building-community", roles:["super_admin","admin","finance","viewer"] },
  { label:"إدارة الأسطول",  href:"/logistics/fleet", icon:"truck", roles:["super_admin","admin","procurement","inventory","viewer"] },
  { label:"الشكاوى والتغذية الراجعة", href:"/cfm", icon:"message-report", roles:["super_admin","admin","finance","hr","viewer"] },
  { label:"الخريطة الجغرافية", href:"/reports/gis-map", icon:"map-pin", roles:["super_admin","admin","finance","viewer"] },
  { label:"الموردون",       href:"/vendors",       icon:"truck",         roles:["super_admin","admin","finance","procurement","viewer"] },
  { label:"المشتريات",      href:"/procurement",   icon:"shopping-cart", roles:["super_admin","admin","finance","procurement","viewer"] },
  { label:"الموارد البشرية",href:"/hr",            icon:"users",         roles:["super_admin","admin","hr","viewer"] },
  { label:"المخزون",        href:"/inventory",     icon:"package",       roles:["super_admin","admin","inventory","procurement","viewer"] },
  { label:"المحاسبة",       href:"/accounting",    icon:"calculator",    roles:["super_admin","admin","finance","viewer"] },
  { label:"الإشعارات",      href:"/notifications", icon:"bell",          roles:["super_admin","admin","finance","hr","procurement","inventory","viewer"] },
  { label:"التقارير",       href:"/reports",       icon:"chart-bar",     roles:["super_admin","admin","finance"] },
  {
    label:"الإعدادات", href:"/settings", icon:"settings-2",
    roles:["super_admin","admin"],
    children:[
      { label:"إعدادات النظام",    href:"/settings",                 icon:"adjustments" },
      { label:"البيانات الأساسية", href:"/settings/master-data",     icon:"database" },
      { label:"مصفوفة التواقيع",   href:"/settings/approval-matrix", icon:"shield-check" },
      { label:"المستخدمون",        href:"/settings/users",           icon:"user-cog" },
      { label:"السنة المالية",     href:"/settings/fiscal-year",     icon:"calendar-stats" },
      { label:"الصلاحيات",          href:"/settings/permissions",     icon:"shield-lock" },
    ],
  },
] as const;

function NavIcon({ name }: { name:string }) {
  return <i className={`ti ti-${name} text-[17px] shrink-0`} aria-hidden="true" />;
}

export default function Sidebar({ role }: { role:string }) {
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string|null>(
    pathname.startsWith("/settings") ? "/settings" : null
  );

  const visible = NAV_ITEMS.filter(item =>
    (item.roles as readonly string[]).includes(role)
  );

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[#0F1117] border-l border-[#1F2937] flex flex-col">

      {/* الشعار */}
      <div className="h-16 flex items-center px-5 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0F6E56] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
              <path d="M4 20L14 4L24 20H4Z" fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round"/>
              <circle cx="14" cy="13" r="2" fill="white"/>
            </svg>
          </div>
          <span className="font-semibold text-white text-sm tracking-tight">نظام الإدارة</span>
        </div>
      </div>

      {/* القائمة */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-0.5">
        {visible.map((item) => {
          const hasChildren = "children" in item && item.children?.length;
          const isGroupOpen = openGroup === item.href;
          const isActive    = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
          const isChildActive = hasChildren && item.children?.some(c => pathname.startsWith(c.href));

          if (hasChildren) {
            return (
              <div key={item.href}>
                <button
                  onClick={() => setOpenGroup(isGroupOpen ? null : item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                    isChildActive
                      ? "text-[#1D9E75] bg-[#0F6E56]/10"
                      : "text-[#6B7280] hover:text-[#D1D5DB] hover:bg-[#1F2937]/60"
                  )}>
                  <NavIcon name={item.icon} />
                  <span className="flex-1 text-right">{item.label}</span>
                  <i className={`ti ti-chevron-${isGroupOpen ? "up" : "down"} text-[13px] transition-transform`} />
                </button>
                {isGroupOpen && (
                  <div className="mr-4 mt-0.5 space-y-0.5 border-r border-[#1F2937] pr-2">
                    {item.children?.map(child => {
                      const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <Link key={child.href} href={child.href}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all",
                            childActive
                              ? "text-[#1D9E75] bg-[#0F6E56]/10 font-medium"
                              : "text-[#4B5563] hover:text-[#D1D5DB] hover:bg-[#1F2937]/60"
                          )}>
                          <i className={`ti ti-${child.icon ?? "circle"} text-[13px]`} />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link key={item.href} href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                isActive
                  ? "bg-[#0F6E56]/15 text-[#1D9E75] font-medium"
                  : "text-[#6B7280] hover:text-[#D1D5DB] hover:bg-[#1F2937]/60"
              )}>
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-[#1D9E75]" />}
            </Link>
          );
        })}
      </nav>

      {/* تذييل */}
      <div className="px-3 py-4 border-t border-[#1F2937]">
        <Link href="/api/auth/signout"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#6B7280] hover:text-[#EF4444] hover:bg-[#2A1215]/60 transition-all">
          <i className="ti ti-logout text-[18px]" aria-hidden="true" />
          <span>تسجيل الخروج</span>
        </Link>
      </div>
    </aside>
  );
}
