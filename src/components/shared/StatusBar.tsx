// src/components/shared/StatusBar.tsx
const STATUS_LABELS: Record<string,string> = {
  draft:"مسودة", submitted:"قيد المراجعة", approved:"معتمد",
  rejected:"مرفوض", done:"مكتمل", cancelled:"ملغي",
};

export default function StatusBar({
  states, current,
}: { states: string[]; current: string }) {
  const currentIdx = states.indexOf(current);
  const isRejected = current === "rejected" || current === "cancelled";

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl px-5 py-4">
      <div className="flex items-center gap-0">
        {states.map((state, i) => {
          const isDone    = i < currentIdx;
          const isActive  = i === currentIdx;
          const isLast    = i === states.length - 1;

          return (
            <div key={state} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                {/* الدائرة */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-all ${
                  isActive && isRejected
                    ? "border-[#E24B4A] bg-[#2A1215] text-[#E24B4A]"
                    : isActive
                    ? "border-[#0F6E56] bg-[#0F6E56] text-white shadow-lg shadow-[#0F6E56]/30"
                    : isDone
                    ? "border-[#0F6E56] bg-[#0F6E56]/20 text-[#1D9E75]"
                    : "border-[#2D3748] bg-[#161B26] text-[#4B5563]"
                }`}>
                  {isDone
                    ? <i className="ti ti-check text-[13px]" aria-hidden="true" />
                    : <span>{i + 1}</span>
                  }
                </div>
                {/* التسمية */}
                <span className={`text-[10px] mt-1.5 font-medium whitespace-nowrap ${
                  isActive
                    ? isRejected ? "text-[#E24B4A]" : "text-[#1D9E75]"
                    : isDone ? "text-[#6B7280]" : "text-[#374151]"
                }`}>
                  {STATUS_LABELS[state] ?? state}
                </span>
              </div>
              {/* الخط الواصل */}
              {!isLast && (
                <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all ${
                  isDone || isActive ? "bg-[#0F6E56]/40" : "bg-[#1F2937]"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
