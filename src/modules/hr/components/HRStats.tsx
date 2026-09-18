// src/modules/hr/components/HRStats.tsx
export default function HRStats({ totalEmployees, totalDepts }: { totalEmployees:number; totalDepts:number }) {
  const stats = [
    { label:"الموظفون النشطون", value:totalEmployees, icon:"users", color:"#1D9E75" },
    { label:"الأقسام",          value:totalDepts,     icon:"building", color:"#378ADD" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:`${s.color}15` }}>
              <i className={`ti ti-${s.icon} text-[18px]`} style={{ color:s.color }} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums" style={{ color:s.color }}>{s.value}</p>
              <p className="text-xs text-[#4B5563] mt-0.5">{s.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
