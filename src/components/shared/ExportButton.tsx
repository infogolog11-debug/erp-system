// زر التصدير المشترك — PDF أو Excel
"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

type Props = {
  apiPath:   string;  // /api/export/payroll/[id] مثلاً
  filename:  string;  // اسم الملف بدون امتداد
  formats?:  ("pdf"|"excel")[];
};

export default function ExportButton({ apiPath, filename, formats = ["pdf","excel"] }: Props) {
  const [loading, setLoading] = useState<"pdf"|"excel"|null>(null);
  const [open,    setOpen]    = useState(false);

  async function exportPDF() {
    setLoading("pdf"); setOpen(false);
    const res  = await fetch(`${apiPath}?format=pdf`);
    const html = await res.text();
    const win  = window.open("", "_blank");
    if (!win) { setLoading(null); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.print(); setLoading(null); }, 800);
  }

  async function exportExcel() {
    setLoading("excel"); setOpen(false);
    const res  = await fetch(`${apiPath}?format=excel`);
    const data = await res.json();

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      data.headers,
      ...data.rows,
      ...(data.totalsRow ? [data.totalsRow] : []),
    ]);

    // تنسيق العمود الأول بعرض مناسب
    ws["!cols"] = data.headers.map((_:any,i:number) => ({ wch: i<2 ? 24 : 14 }));

    XLSX.utils.book_append_sheet(wb, ws, data.sheetName ?? filename);
    XLSX.writeFile(wb, `${filename}.xlsx`);
    setLoading(null);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-[#161B26] hover:bg-[#1F2937] border border-[#2D3748] text-[#D1D5DB] text-sm font-medium px-3.5 py-2 rounded-xl transition-all">
        {loading
          ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          : <i className="ti ti-download text-[15px]" />
        }
        تصدير
        <i className={`ti ti-chevron-${open?"up":"down"} text-[12px] text-[#4B5563]`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-20 bg-[#0F1117] border border-[#2D3748] rounded-xl shadow-xl overflow-hidden min-w-[160px]">
            {formats.includes("pdf") && (
              <button onClick={exportPDF}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#D1D5DB] hover:bg-[#161B26] transition-colors text-right">
                <i className="ti ti-file-type-pdf text-[#E24B4A] text-[16px]" />
                تصدير PDF
              </button>
            )}
            {formats.includes("excel") && (
              <button onClick={exportExcel}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#D1D5DB] hover:bg-[#161B26] transition-colors text-right border-t border-[#1F2937]">
                <i className="ti ti-file-type-xls text-[#1D9E75] text-[16px]" />
                تصدير Excel
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
