// src/modules/procurement/components/PRActions.tsx
// أزرار دورة اعتماد طلب الشراء: إرسال للموافقة (draft→submitted) واعتماد (submitted→approved).
// هاتان الدالتان كانتا منفّذتين بالكامل في actions.ts لكن بلا أي واجهة تستدعيهما،
// فكان الطلب يبقى "draft" دائماً ولا يمكن إصدار أمر شراء منه (createPurchaseOrder
// يشترط status==="approved") — وهذا ما كان يسدّ سلسلة PR→PO→GRN.
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPurchaseRequest, approvePurchaseRequest } from "@/modules/procurement/actions";
import type { AppLocale } from "@/lib/preferences";

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function PRActions({
  prId, organizationId, userId, status, approverIds, canEdit, canApprove, locale = "ar",
}: {
  prId: string; organizationId: string; userId: string; status: string;
  approverIds: string[]; canEdit: boolean; canApprove: boolean; locale?: AppLocale;
}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [busy, setBusy] = useState<"submit" | "approve" | null>(null);
  const [error, setError] = useState("");

  const t = locale === "ar"
    ? { submit: "إرسال للموافقة", approve: "اعتماد الطلب" }
    : { submit: "Submit for approval", approve: "Approve request" };

  const showSubmit  = status === "draft"     && canEdit;
  const showApprove = status === "submitted" && canApprove;

  function run(kind: "submit" | "approve") {
    setError("");
    setBusy(kind);
    start(async () => {
      const res = kind === "submit"
        ? await submitPurchaseRequest(prId, userId, organizationId, approverIds)
        : await approvePurchaseRequest(prId, userId, organizationId);
      setBusy(null);
      if (!res.success) { setError(res.error); return; }
      router.refresh();
    });
  }

  if (!showSubmit && !showApprove && !error) return null;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        {showSubmit && (
          <button
            onClick={() => run("submit")}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#185FA5] hover:bg-[#1E75C8] transition-all disabled:opacity-50"
          >
            {busy === "submit" && <Spinner />}
            {t.submit}
          </button>
        )}
        {showApprove && (
          <button
            onClick={() => run("approve")}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#0F6E56] hover:bg-[#1D9E75] transition-all disabled:opacity-50"
          >
            {busy === "approve" && <Spinner />}
            {t.approve}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[#E24B4A] max-w-[260px] text-right">{error}</p>}
    </div>
  );
}
