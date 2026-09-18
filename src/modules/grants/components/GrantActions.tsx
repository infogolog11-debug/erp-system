// src/modules/grants/components/GrantActions.tsx
"use client";
import { useTransition } from "react";
import { approveGrant } from "@/modules/grants/actions";
import { useRouter } from "next/navigation";

const STATUS_TRANSITIONS: Record<string, { label:string; action:string; style:string }[]> = {
  draft:     [{ label:"إرسال للموافقة", action:"submit",  style:"bg-[#185FA5] hover:bg-[#1E75C8]" }],
  submitted: [
    { label:"اعتماد",  action:"approve", style:"bg-[#0F6E56] hover:bg-[#1D9E75]" },
    { label:"رفض",     action:"reject",  style:"bg-[#2A1215] hover:bg-[#3A1920] text-[#E24B4A] border border-[#4A2020]" },
  ],
  approved:  [{ label:"إغلاق / مكتملة", action:"done", style:"bg-[#374151] hover:bg-[#4B5563]" }],
};

export default function GrantActions({
  grantId, status, role, userId, organizationId,
}: { grantId:string; status:string; role:string; userId:string; organizationId:string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const canApprove = ["super_admin","admin","finance_manager"].includes(role);
  const actions    = STATUS_TRANSITIONS[status] ?? [];
  const visible    = actions.filter((a) => {
    if (a.action === "approve" || a.action === "reject") return canApprove;
    return true;
  });

  if (visible.length === 0) return null;

  function handleAction(action: string) {
    startTransition(async () => {
      if (action === "approve") {
        await approveGrant(grantId, userId, organizationId);
        router.refresh();
      }
      // submit / reject / done — تُضاف بنفس الطريقة
    });
  }

  return (
    <div className="flex items-center gap-2">
      {visible.map((a) => (
        <button
          key={a.action}
          onClick={() => handleAction(a.action)}
          disabled={isPending}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50 ${a.style}`}
        >
          {isPending ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : null}
          {a.label}
        </button>
      ))}
    </div>
  );
}
