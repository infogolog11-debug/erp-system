// src/modules/hr/components/PayrollRunButton.tsx
"use client";
import { useState, useTransition } from "react";
import { processPayroll } from "@/modules/hr/actions";
import { useRouter } from "next/navigation";

export default function PayrollRunButton({ organizationId, userId, role }: { organizationId:string; userId:string; role:string }) {
  const canRun = ["super_admin","admin","hr_manager","finance_manager"].includes(role);
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<string>("");
  const router = useRouter();
  const now = new Date();

  if (!canRun) return null;

  function handleRun() {
    startTransition(async () => {
      const res = await processPayroll(organizationId, now.getMonth()+1, now.getFullYear(), userId);
      if (res.success) {
        setResult(`✓ تم معالجة كشف الرواتب — الصافي: ${Number(res.data.totalNet).toLocaleString("ar-SA")}`);
        router.refresh();
      } else {
        setResult(`✗ ${res.error}`);
      }
      setShowModal(false);
    });
  }

  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
        <i className="ti ti-calculator text-[16px]" aria-hidden="true" />
        تشغيل كشف الرواتب
      </button>

      {result && (
        <div className={`fixed bottom-6 left-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-xl ${result.startsWith("✓") ? "bg-[#001A12] border border-[#0F6E56] text-[#1D9E75]" : "bg-[#2A1215] border border-[#4A1C20] text-[#E24B4A]"}`}>
          {result}
          <button onClick={() => setResult("")} className="mr-2 opacity-60 hover:opacity-100">
            <i className="ti ti-x text-[14px]" aria-hidden="true" />
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-[#271E0A] border border-[#3D2E00] flex items-center justify-center mb-4">
              <i className="ti ti-alert-triangle text-[22px] text-[#EF9F27]" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">تأكيد تشغيل الرواتب</h3>
            <p className="text-sm text-[#6B7280] mb-6">
              سيتم معالجة رواتب جميع الموظفين النشطين لشهر {now.toLocaleDateString("ar-SA", { month:"long", year:"numeric" })}. هذا الإجراء غير قابل للتراجع.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] bg-[#161B26] border border-[#1F2937] rounded-xl transition-all">
                إلغاء
              </button>
              <button onClick={handleRun} disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
                {isPending ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg> : null}
                {isPending ? "جارٍ المعالجة..." : "تأكيد التشغيل"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
