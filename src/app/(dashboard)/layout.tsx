// src/app/(dashboard)/layout.tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import Header  from "@/components/layout/Header";
import OfflineSyncBanner from "@/components/shared/OfflineSyncBanner";

export default async function DashboardLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex h-screen bg-[#0B0F19] overflow-hidden" dir="rtl">
      <Sidebar role={session.user.role} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-[#0B0F19]">
          {children}
        </main>
      </div>
      <OfflineSyncBanner userId={session.user.id} />
    </div>
  );
}
