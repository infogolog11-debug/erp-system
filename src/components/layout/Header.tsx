// Header — Server Component يجلب الإشعارات من DB
import { auth }             from "@/auth";
import { db }               from "@/db";
import { notifications }    from "@/db/schema";
import { and, eq, desc }    from "drizzle-orm";
import NotificationBell  from "./NotificationBell";
import GlobalSearch      from "@/components/shared/GlobalSearch";
import Link                 from "next/link";
import HeaderPreferences from "./HeaderPreferences";
import type { AppLocale, ThemePreference } from "@/lib/preferences";

const ROLE_LABELS: Record<AppLocale, Record<string, string>> = {
  ar: {
    super_admin: "مدير عام",
    admin: "مدير نظام",
    finance_manager: "مدير مالي",
    program_manager: "مدير برامج",
    hr_manager: "موارد بشرية",
    procurement_officer: "مشتريات",
    warehouse_manager: "مخازن",
    viewer: "مشاهد",
  },
  en: {
    super_admin: "Super Admin",
    admin: "System Admin",
    finance_manager: "Finance Manager",
    program_manager: "Program Manager",
    hr_manager: "HR Manager",
    procurement_officer: "Procurement",
    warehouse_manager: "Warehouse",
    viewer: "Viewer",
  },
};

const COPY = {
  ar: { reports: "التقارير", settings: "الإعدادات" },
  en: { reports: "Reports", settings: "Settings" },
} as const;

export default async function Header({
  locale,
  theme,
}: {
  locale: AppLocale;
  theme: ThemePreference;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const user    = session.user;
  const role    = ROLE_LABELS[locale][user.role] ?? user.role ?? "";
  const initials = `${user.firstName?.[0] ?? user.nameAr?.[0] ?? "م"}`;
  const t = COPY[locale];

  // جلب آخر 20 إشعار للمستخدم
  const userNotifs = user.id ? await db.query.notifications.findMany({
    where:   and(eq(notifications.userId, user.id), eq(notifications.organizationId, user.organizationId)),
    orderBy: [desc(notifications.createdAt)],
    limit:   20,
  }) : [];

  const unread = userNotifs.filter(n => !n.isRead).length;

  return (
    <header className="h-16 bg-[#0F1117] border-b border-[#1F2937] flex items-center justify-between px-6 flex-shrink-0">

      {/* Breadcrumb / Quick Nav */}
      <div className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Link href="/" className="hover:text-[#D1D5DB] transition-colors">
          <i className="ti ti-home text-[15px]" />
        </Link>
        <span>/</span>
        <Link href="/reports" className="text-[11px] hover:text-[#1D9E75] transition-colors flex items-center gap-1">
          <i className="ti ti-chart-bar text-[13px]" />{t.reports}
        </Link>
        <span>/</span>
        <Link href="/settings" className="text-[11px] hover:text-[#1D9E75] transition-colors flex items-center gap-1">
          <i className="ti ti-settings-2 text-[13px]" />{t.settings}
        </Link>
      </div>

      {/* اليمين */}
      <div className="flex items-center gap-3">
        <HeaderPreferences locale={locale} theme={theme} />

        {/* جرس الإشعارات الحقيقي */}
        <NotificationBell
          locale={locale}
          notifications={userNotifs.map(n => ({
            id:        n.id,
            title:     n.title,
            titleAr:   n.titleAr,
            body:      n.body,
            type:      n.type,
            link:      n.link,
            isRead:    n.isRead,
            createdAt: n.createdAt.toISOString(),
          }))}
          unreadCount={unread}
        />

        {/* البحث الشامل */}
        <GlobalSearch locale={locale} />

        <div className="w-px h-6 bg-[#1F2937]" />

        {/* المستخدم */}
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-sm font-medium text-[#D1D5DB] leading-tight">
              {user.nameAr ?? user.name ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()}
            </p>
            <p className="text-xs text-[#4B5563] leading-tight">{role}</p>
          </div>
          <Link href="/settings/users"
            className="w-9 h-9 rounded-xl bg-[#0F6E56]/20 border border-[#0F6E56]/30 flex items-center justify-center hover:bg-[#0F6E56]/30 transition-all flex-shrink-0">
            <span className="text-sm font-semibold text-[#1D9E75]">{initials}</span>
          </Link>
        </div>

      </div>
    </header>
  );
}
