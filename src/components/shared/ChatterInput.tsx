// src/components/shared/ChatterInput.tsx
"use client";
import { useState, useTransition } from "react";
import { addChatterMessage } from "@/core/actions/chatter";
import type { AppLocale } from "@/lib/preferences";

export default function ChatterInput({
  tableName, recordId, organizationId, userId, locale = "ar",
}: { tableName:string; recordId:string; organizationId:string; userId:string; locale?: AppLocale }) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const isAr = locale === "ar";
  const t = isAr
    ? { placeholder: "اكتب ملاحظة..." }
    : { placeholder: "Write a note..." };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    startTransition(async () => {
      await addChatterMessage({ tableName, recordId, organizationId, userId, message });
      setMessage("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t.placeholder}
        className="flex-1 bg-[#161B26] border border-[#2D3748] rounded-xl px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] transition-colors"
      />
      <button
        type="submit"
        disabled={isPending || !message.trim()}
        className="px-4 py-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-40 text-white text-sm rounded-xl transition-all flex-shrink-0"
      >
        <i className="ti ti-send text-[15px]" aria-hidden="true" />
      </button>
    </form>
  );
}
