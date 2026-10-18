// src/modules/inventory/components/InventoryStats.tsx
import type { AppLocale } from "@/lib/preferences";

export default function InventoryStats({ totalItems, totalAssets, lowStock, warehouses, locale = "ar" }: { totalItems:number; totalAssets:number; lowStock:number; warehouses:number; locale?: AppLocale }) {
  const stats = [
    { label:locale === "ar" ? "إجمالي الأصناف" : "Total items", value:totalItems,  icon:"package",   color:"#378ADD" },
    { label:locale === "ar" ? "الأصول الثابتة" : "Fixed assets", value:totalAssets, icon:"box",        color:"#7F77DD" },
    { label:locale === "ar" ? "مخزون منخفض" : "Low stock",    value:lowStock,    icon:"alert-triangle", color: lowStock > 0 ? "#E24B4A" : "#1D9E75" },
    { label:locale === "ar" ? "المستودعات" : "Warehouses",     value:warehouses,  icon:"building",   color:"#1D9E75" },
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
