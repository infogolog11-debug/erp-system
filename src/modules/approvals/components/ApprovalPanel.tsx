// لوحة الموافقة الكاملة — تُعرض في صفحة تفاصيل أي طلب
"use client";
import { useState, useTransition } from "react";
import { recordApprovalDecision } from "@/lib/approval/matrix";
import ApprovalBadge from "./ApprovalBadge";

type Level = {
  level: number; levelName: string; ruleId: string;
  status: "completed"|"pending"|"rejected"|"current";
  decidedAt?: string; comments?: string;
};

export default function ApprovalPanel({
  recordType, recordId, organizationId, userId,
  levels, amount, revalidatePath: rPath,
}: {
  recordType: string; recordId: string; organizationId: string;
  userId: string; levels: Level[]; amount: number; revalidatePath?: string;
}) {
  const [isPending, start] = useTransition();
  const [comments, setComments] = useState("");
  const [error,  setError]  = useState("");
  const [result, setResult] = useState<string>("");

  const currentLevel = levels.find(l => l.status === "current");
  const isMyTurn = !!currentLevel;
  const isFullyApproved = levels.every(l => l.status === "completed");
  const isRejected = levels.some(l => l.status === "rejected");

  function decide(decision: "approved"|"rejected"|"returned") {
    if (!currentLevel) return;
    setError(""); setResult("");
    start(async () => {
      const res = await recordApprovalDecision({
        organizationId, recordType, recordId,
        ruleId:        currentLevel.ruleId,
        approvalLevel: currentLevel.level,
        approverId:    userId,
        decision, comments,
        amountAtDecision: amount,
        revalidatePath: rPath,
      });
      if (res.success) {
        setResult(res.data.isFullyApproved ? "✅ تمت الموافقة الكاملة" : "تم تسجيل القرار");
        setComments("");
      } else setError(res.error);
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-shield-check text-[#0F6E56]" />
          سير الموافقات
        </h2>
        {isFullyApproved && (
          <span className="text-xs bg-[#001A12] text-[#1D9E75] border border-[#0F3D28] px-3 py-1 rounded-full font-medium">
            ✅ معتمد بالكامل
          </span>
        )}
        {isRejected && (
          <span className="text-xs bg-[#2A1215] text-[#E24B4A] border border-[#4A1C20] px-3 py-1 rounded-full font-medium">
            ✗ مرفوض
          </span>
        )}
      </div>

      {/* شريط التقدم */}
      <div className="flex items-center gap-3 py-2">
        <ApprovalBadge levels={levels} />
        <span className="text-xs text-[#4B5563] mr-auto">
          {levels.filter(l => l.status === "completed").length}/{levels.length} مراحل
        </span>
      </div>

      {/* جدول المراحل */}
      <div className="space-y-2">
        {levels.map(lvl => (
          <div key={lvl.level}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              lvl.status === "current"   ? "border-[#EF9F27]/40 bg-[#1A1400]" :
              lvl.status === "completed" ? "border-[#0F3D28] bg-[#001A12]"   :
              lvl.status === "rejected"  ? "border-[#4A1C20] bg-[#2A1215]"   :
              "border-[#1F2937] bg-[#161B26]"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-[#4B5563] w-5">L{lvl.level}</span>
              <span className="text-sm text-[#D1D5DB]">{lvl.levelName}</span>
            </div>
            <div className="flex items-center gap-2">
              {lvl.status === "completed" && (
                <span className="text-[11px] text-[#1D9E75] flex items-center gap-1">
                  <i className="ti ti-check" />{lvl.decidedAt ? new Date(lvl.decidedAt).toLocaleDateString("ar") : ""}
                </span>
              )}
              {lvl.status === "current" && (
                <span className="text-[11px] text-[#EF9F27] animate-pulse">بانتظار الموافقة...</span>
              )}
              {lvl.status === "rejected" && (
                <span className="text-[11px] text-[#E24B4A] flex items-center gap-1"><i className="ti ti-x" />مرفوض</span>
              )}
              {lvl.status === "pending" && (
                <span className="text-[11px] text-[#2D3748]">في الانتظار</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* منطقة اتخاذ القرار — تظهر فقط إذا كان دور المستخدم */}
      {isMyTurn && !isFullyApproved && !isRejected && (
        <div className="pt-3 border-t border-[#1F2937] space-y-3">
          <p className="text-xs text-[#9CA3AF]">
            <i className="ti ti-user-check text-[#EF9F27] ml-1" />
            دورك للموافقة على المرحلة {currentLevel?.level}: <strong className="text-white">{currentLevel?.levelName}</strong>
          </p>
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="ملاحظات اختيارية..."
            rows={2}
            className="w-full bg-[#161B26] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] resize-none"
          />
          {error  && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
          {result && <p className="text-xs text-[#1D9E75] flex items-center gap-1"><i className="ti ti-check" />{result}</p>}
          <div className="flex items-center gap-2">
            <button onClick={() => decide("approved")} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-all">
              <i className="ti ti-thumb-up" />موافقة
            </button>
            <button onClick={() => decide("returned")} disabled={isPending}
              className="px-4 py-2.5 text-sm text-[#EF9F27] border border-[#3D2E00] hover:bg-[#1A1400] rounded-xl transition-all disabled:opacity-50">
              <i className="ti ti-arrow-back-up" /> إعادة
            </button>
            <button onClick={() => decide("rejected")} disabled={isPending}
              className="px-4 py-2.5 text-sm text-[#E24B4A] border border-[#4A1C20] hover:bg-[#2A1215] rounded-xl transition-all disabled:opacity-50">
              <i className="ti ti-thumb-down" /> رفض
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
