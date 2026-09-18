"use client";
import { useEffect, useState, useCallback } from "react";
import { queueCount } from "@/lib/offline/indexeddb-queue";
import { flushQueue } from "@/lib/offline/sync-manager";

export default function OfflineSyncBanner({ userId }: { userId: string }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    setPending(await queueCount());
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    refreshCount();

    // تسجيل Service Worker لتفعيل التخزين المؤقت وإمكانية التثبيت كتطبيق
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }

    const handleOnline = async () => {
      setIsOnline(true);
      setSyncing(true);
      await flushQueue(userId);
      await refreshCount();
      setSyncing(false);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [userId, refreshCount]);

  async function manualSync() {
    setSyncing(true);
    await flushQueue(userId);
    await refreshCount();
    setSyncing(false);
  }

  if (isOnline && pending === 0) return null;

  return (
    <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-4 py-2.5 shadow-lg border text-[13px] ${
      !isOnline ? "bg-[#271E0A] border-[#4A3510] text-[#EF9F27]" : "bg-[#0F1117] border-[#1F2937] text-[#D1D5DB]"
    }`}>
      <i className={`ti ti-${!isOnline ? "wifi-off" : "cloud-upload"}`} />
      {!isOnline ? "غير متصل — سيتم حفظ النماذج محلياً وإرسالها عند عودة الاتصال" : `${pending} عنصر بانتظار المزامنة`}
      {isOnline && pending > 0 && (
        <button onClick={manualSync} disabled={syncing} className="text-[#0F6E56] font-medium hover:text-[#1D9E75]">
          {syncing ? "جارِ المزامنة..." : "مزامنة الآن"}
        </button>
      )}
    </div>
  );
}
