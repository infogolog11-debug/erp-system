// src/components/shared/ChatterBox.tsx
import { db } from "@/db";
import { chatterMessages, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import ChatterInput from "./ChatterInput";

export default async function ChatterBox({
  tableName, recordId, organizationId, userId,
}: { tableName:string; recordId:string; organizationId:string; userId:string }) {
  const messages = await db.query.chatterMessages.findMany({
    where: and(
      eq(chatterMessages.tableName, tableName),
      eq(chatterMessages.recordId, recordId),
    ),
    orderBy: [desc(chatterMessages.createdAt)],
    limit: 20,
  });

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <i className="ti ti-message-dots text-[16px] text-[#4B5563]" aria-hidden="true" />
        المراسلات والملاحظات
        <span className="text-xs font-normal text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">
          {messages.length}
        </span>
      </h3>

      <ChatterInput
        tableName={tableName}
        recordId={recordId}
        organizationId={organizationId}
        userId={userId}
      />

      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-[#374151] text-center py-4">لا توجد مراسلات بعد</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-[#0F6E56]/20 flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-[#1D9E75]">
                م
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#D1D5DB]">مستخدم</span>
                  <span className="text-[10px] text-[#374151]">
                    {new Date(msg.createdAt).toLocaleDateString("ar-SA", {
                      month:"short", day:"numeric", hour:"2-digit", minute:"2-digit",
                    })}
                  </span>
                  {msg.messageType !== "comment" && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      msg.messageType === "approval"
                        ? "bg-[#001A12] text-[#1D9E75]"
                        : "bg-[#2A1215] text-[#E24B4A]"
                    }`}>
                      {msg.messageType === "approval" ? "موافقة" : "رفض"}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">{msg.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
