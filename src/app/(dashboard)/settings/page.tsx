// صفحة الإعدادات الرئيسية — Admin Panel
import { auth }         from "@/auth";
import { redirect }     from "next/navigation";
import { getAllSettings } from "@/lib/settings/service";
import SettingsPanel     from "@/modules/settings/components/SettingsPanel";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const role    = session.user.role;
  const orgId   = session.user.organizationId;

  if (role !== "admin" && role !== "super_admin") redirect("/");

  const settings = await getAllSettings(orgId);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-settings-2 text-[#0F6E56]" />
          إعدادات النظام
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          جميع القيم الديناميكية للنظام — تُطبَّق فوراً دون تعديل الكود
        </p>
      </div>
      <SettingsPanel organizationId={orgId} settings={settings} />
    </div>
  );
}
