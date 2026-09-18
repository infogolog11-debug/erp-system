// شارة الطوارئ + نموذج تفعيل — تُستخدم في نموذج طلب الشراء وصفحة التفاصيل
"use client";
import { useState, useTransition } from "react";
import { flagEmergencyProcurement } from "@/modules/vendors/actions";

export function EmergencyBadge({ reviewDue }: { reviewDue?: string | null }) {
  const daysLeft = reviewDue
    ? Math.ceil((new Date(reviewDue).getTime() - Date.now()) / 86400000)
    : null;
  const overdue = daysLeft !== null && daysLeft < 0;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
      overdue ? "bg-[#2A1215] border-[#4A1C20] text-[#E24B4A]"
               : "bg-[#271E0A] border-[#3D2E00] text-[#EF9F27]"
    }`}>
      <i className="ti ti-alert-triangle text-[14px]" />
      طارئ
      {daysLeft !== null && (
        <span className={`text-[10px] font-normal ${overdue ? "text-[#E24B4A]" : "text-[#9CA3AF]"}`}>
          {overdue ? `متأخر ${Math.abs(daysLeft)} يوم` : `مراجعة بعد ${daysLeft} يوم`}
        </span>
      )}
    </div>
  );
}

export function EmergencyToggle({
  prId, organizationId, authorizedBy,
  isEmergency, reviewDue, reason,
}: {
  prId: string; organizationId: string; authorizedBy: string;
  isEmergency: boolean; reviewDue?: string | null; reason?: string | null;
}) {
  const [enabled, setEnabled]       = useState(isEmergency);
  const [inputReason, setReason]    = useState(reason ?? "");
  const [showForm, setShowForm]     = useState(false);
  const [isPending, start]          = useTransition();
  const [error,  setError]          = useState("");
  const [success, setSuccess]       = useState("");

  function activate() {
    if (!inputReason.trim()) { setError("يجب ذكر سبب الطوارئ"); return; }
    setError("");
    start(async () => {
      const res = await flagEmergencyProcurement(prId, inputReason, authorizedBy, organizationId);
      if (res.success) {
        setEnabled(true); setShowForm(false);
        setSuccess("تم تفعيل مسار الطوارئ — ستُجرى مراجعة إلزامية خلال 30 يوماً");
      } else setError(res.error);
    });
  }

  if (enabled) {
    return (
      <div className="space-y-2">
        <EmergencyBadge reviewDue={reviewDue} />
        {reason && <p className="text-xs text-[#9CA3AF] flex items-center gap-1"><i className="ti ti-quote text-[#EF9F27]" />{reason}</p>}
        {reviewDue && (
          <p className="text-xs text-[#4B5563]">
            موعد المراجعة: {new Date(reviewDue).toLocaleDateString("ar")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-xs text-[#EF9F27] border border-[#3D2E00] bg-[#0D0A00] hover:bg-[#1A1400] px-3 py-2 rounded-lg transition-all">
          <i className="ti ti-alert-triangle" />
          تفعيل مسار الشراء الطارئ
        </button>
      ) : (
        <div className="border border-[#3D2E00] bg-[#0D0A00] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <i className="ti ti-alert-triangle text-[#EF9F27] text-[16px]" />
            <p className="text-sm font-medium text-[#EF9F27]">تفعيل مسار الطوارئ</p>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            سيتم تجاوز إجراءات المناقصة والاكتفاء بموافقتين فقط.
            تُلزم الأنظمة بمراجعة الطلب خلال 30 يوماً من الاعتماد.
          </p>
          <textarea
            value={inputReason}
            onChange={e => setReason(e.target.value)}
            placeholder="سبب الطوارئ — مثال: كارثة طبيعية، نقص حاد في مواد إغاثة..."
            rows={2}
            className="w-full bg-[#161B26] border border-[#3D2E00] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#EF9F27] resize-none"
          />
          {error   && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
          {success && <p className="text-xs text-[#1D9E75] flex items-center gap-1"><i className="ti ti-check" />{success}</p>}
          <div className="flex gap-2">
            <button onClick={activate} disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[#3D2E00] hover:bg-[#EF9F27] hover:text-black text-[#EF9F27] text-sm font-medium py-2 rounded-lg transition-all disabled:opacity-50">
              {isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                : <i className="ti ti-alert-triangle" />
              }
              تأكيد تفعيل الطوارئ
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-4 text-sm text-[#6B7280] hover:text-white border border-[#2D3748] rounded-lg transition-all">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
