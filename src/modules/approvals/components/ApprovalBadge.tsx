// مكوّن مشترك: شريط حالة الموافقات — يُستخدم في PR وأوامر الشراء والفواتير
"use client";

type Level = {
  level:      number;
  levelName:  string;
  status:     "completed" | "pending" | "rejected" | "current";
  decidedAt?: string;
  comments?:  string;
};

export default function ApprovalBadge({ levels, compact = false }: { levels: Level[]; compact?: boolean }) {
  if (!levels.length) return null;

  const statusStyle: Record<string, { dot: string; label: string; ring: string }> = {
    completed: { dot:"bg-[#1D9E75]", label:"text-[#1D9E75]", ring:"border-[#1D9E75]" },
    current:   { dot:"bg-[#EF9F27] animate-pulse", label:"text-[#EF9F27]", ring:"border-[#EF9F27]" },
    pending:   { dot:"bg-[#2D3748]", label:"text-[#4B5563]", ring:"border-[#2D3748]" },
    rejected:  { dot:"bg-[#E24B4A]", label:"text-[#E24B4A]", ring:"border-[#E24B4A]" },
  };

  if (compact) {
    const done = levels.filter(l => l.status === "completed").length;
    const total = levels.length;
    const hasRejection = levels.some(l => l.status === "rejected");
    const color = hasRejection ? "text-[#E24B4A]" : done === total ? "text-[#1D9E75]" : "text-[#EF9F27]";
    return (
      <span className={`text-[11px] font-medium ${color}`}>
        {hasRejection ? "مرفوض" : `${done}/${total} موافقة`}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {levels.map((lvl, i) => {
        const s = statusStyle[lvl.status];
        return (
          <div key={i} className="group relative flex items-center gap-1">
            {/* connector line */}
            {i > 0 && <div className="w-5 h-px bg-[#2D3748]" />}
            <div className={`relative flex items-center justify-center w-7 h-7 rounded-full border ${s.ring} bg-[#0F1117] cursor-default`}>
              {lvl.status === "completed" && <i className="ti ti-check text-[12px] text-[#1D9E75]" />}
              {lvl.status === "rejected"  && <i className="ti ti-x text-[12px] text-[#E24B4A]" />}
              {(lvl.status === "current" || lvl.status === "pending") && (
                <span className="text-[10px] font-bold text-[#6B7280]">{lvl.level}</span>
              )}
              {/* tooltip */}
              <div className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-[#161B26] border border-[#2D3748] rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-xl">
                  <p className="font-medium">{lvl.levelName}</p>
                  {lvl.decidedAt && <p className="text-[#4B5563] mt-0.5">{new Date(lvl.decidedAt).toLocaleDateString("ar")}</p>}
                  {lvl.comments && <p className="text-[#9CA3AF] mt-0.5 max-w-[180px] whitespace-normal">{lvl.comments}</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
