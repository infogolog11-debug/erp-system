// src/modules/inventory/components/ItemList.tsx
type ItemDisplay = { id:string; code:string; name:string; nameAr?:string|null; currentStock?:string|number|null; minStock?:string|number|null; unit?:string|null; category?:{ name:string; nameAr?:string|null }|null };

export default function ItemList({ items }: { items: ItemDisplay[] }) {
  if (items.length === 0) return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-12 text-center">
      <i className="ti ti-package text-[40px] text-[#1F2937]" aria-hidden="true" />
      <p className="text-sm text-[#4B5563] mt-3">لا توجد أصناف في المخزون</p>
    </div>
  );
  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2937]">
            {["الكود","الصنف","الفئة","الوحدة","الرصيد الحالي","الحد الأدنى","الحالة"].map(h=>(
              <th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const current  = Number(item.currentStock);
            const minStock = Number(item.minStock);
            const isLow    = current <= minStock;
            return (
              <tr key={item.id} className={`hover:bg-[#161B26] ${i < items.length-1 ? "border-b border-[#1F2937]" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{item.code}</td>
                <td className="px-4 py-3 font-medium text-[#D1D5DB]">{item.name}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{item.category?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-[#6B7280]">{item.unit}</td>
                <td className={`px-4 py-3 font-semibold tabular-nums text-sm ${isLow ? "text-[#E24B4A]" : "text-[#1D9E75]"}`}>
                  {current.toLocaleString("ar-SA")}
                </td>
                <td className="px-4 py-3 text-xs text-[#4B5563] tabular-nums">{minStock.toLocaleString("ar-SA")}</td>
                <td className="px-4 py-3">
                  {isLow
                    ? <span className="flex items-center gap-1 text-[10px] text-[#E24B4A] bg-[#2A1215] px-2 py-0.5 rounded-md font-medium"><i className="ti ti-alert-triangle text-[11px]" aria-hidden="true"/>مخزون منخفض</span>
                    : <span className="text-[10px] text-[#1D9E75] bg-[#001A12] px-2 py-0.5 rounded-md font-medium">متوفر</span>
                  }
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
