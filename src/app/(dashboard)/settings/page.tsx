// صفحة الإعدادات الرئيسية — Admin Panel
import { auth }         from "@/auth";
import { redirect }     from "next/navigation";
import { getAllSettings } from "@/lib/settings/service";
import SettingsPanel     from "@/modules/settings/components/SettingsPanel";
import { getRequestPreferences } from "@/lib/preferences";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const prefs = await getRequestPreferences();
  const role    = session.user.role;
  const orgId   = session.user.organizationId;

  if (role !== "admin" && role !== "super_admin") redirect("/");

  const settings = await getAllSettings(orgId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-settings-2 text-[#0F6E56]" />
          {prefs.locale === "ar" ? "إعدادات النظام" : "System settings"}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {prefs.locale === "ar"
            ? "جميع القيم الديناميكية للنظام — تُطبَّق فوراً دون تعديل الكود"
            : "All dynamic system values are applied immediately without changing code"}
        </p>
      </div>
      <SettingsPanel organizationId={orgId} settings={settings} locale={prefs.locale} />
    </div>
  );
}
