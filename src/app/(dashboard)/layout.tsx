// src/app/(dashboard)/layout.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header  from "@/components/layout/Header";
import OfflineSyncBanner from "@/components/shared/OfflineSyncBanner";
import { getRequestPreferences } from "@/lib/preferences";

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  const prefs = getRequestPreferences();

  return (
    <div className="flex h-screen bg-[#0B0F19] overflow-hidden" dir={prefs.direction}>
      <Sidebar role={session.user.role} locale={prefs.locale} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header locale={prefs.locale} theme={prefs.theme} />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]">
          {children}
        </main>
      </div>
      <OfflineSyncBanner userId={session.user.id} />
    </div>
  );
}
