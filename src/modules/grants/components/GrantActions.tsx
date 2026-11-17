// src/modules/grants/components/GrantActions.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitGrant, approveGrant, rejectGrant, closeGrant } from "@/modules/grants/actions";
import type { AppLocale } from "@/lib/preferences";

export default function GrantActions({
  grantId, status, userId, organizationId, canEdit, canApprove, locale = "ar",
}: {
  grantId:string; status:string; userId:string; organizationId:string;
  canEdit:boolean; canApprove:boolean; locale?: AppLocale;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  const isAr = locale === "ar";

  const transitions: Record<string, { label:string; action:"submit"|"approve"|"reject"|"close"; style:string; allowed:boolean }[]> = {
    draft:     [{ label: isAr ? "إرسال للموافقة" : "Submit for approval", action:"submit",  style:"bg-[#185FA5] hover:bg-[#1E75C8]",                              allowed:canEdit }],
    submitted: [
      { label: isAr ? "اعتماد" : "Approve", action:"approve", style:"bg-[#0F6E56] hover:bg-[#1D9E75]",                                    allowed:canApprove },
      { label: isAr ? "رفض"    : "Reject",  action:"reject",  style:"bg-[#2A1215] hover:bg-[#3A1920] text-[#E24B4A] border border-[#4A2020]", allowed:canApprove },
    ],
    approved:  [{ label: isAr ? "إغلاق / مكتملة" : "Close / Complete", action:"close", style:"bg-[#374151] hover:bg-[#4B5563]", allowed:canEdit }],
  };

  const visible = (transitions[status] ?? []).filter(a => a.allowed);
  if (visible.length === 0 && !error) return null;

  function handleAction(action: "submit"|"approve"|"reject"|"close") {
    setError("");
    startTransition(async () => {
      const res =
        action === "submit"  ? await submitGrant(grantId, userId, organizationId)  :
        action === "approve" ? await approveGrant(grantId, userId, organizationId) :
        action === "reject"  ? await rejectGrant(grantId, userId, organizationId)  :
                               await closeGrant(grantId, userId, organizationId);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {visible.map((a) => (
          <button
            key={a.action}
            onClick={() => handleAction(a.action)}
            disabled={isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 ${a.style}`}
          >
            {isPending ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : null}
            {a.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-[#E24B4A] max-w-[260px] text-right">{error}</p>}
    </div>
  );
}
