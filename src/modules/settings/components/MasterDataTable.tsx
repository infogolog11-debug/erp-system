// جدول بيانات أساسية قابل للتعديل (departments, currencies, costCenters, etc.)
"use client";
import { useState, useTransition } from "react";

type Column = { key: string; label: string; editable?: boolean; type?: "text"|"number"|"badge" };
type Row    = Record<string, any> & { id: string };

type Props = {
  title:      string;
  titleAr:    string;
  icon:       string;
  columns:    Column[];
  rows:       Row[];
  onSave:     (id: string, changes: Record<string,string>) => Promise<{ success:boolean; error?:string }>;
  onToggle?:  (id: string, isActive: boolean) => Promise<{ success:boolean }>;
  onAdd?:     () => void;
  addLabel?:  string;
};

export default function MasterDataTable({
  title, titleAr, icon, columns, rows, onSave, onToggle, onAdd, addLabel
}: Props) {
  const [editing, setEditing]   = useState<string | null>(null);
  const [edits,   setEdits]     = useState<Record<string,string>>({});
  const [isPending, start]      = useTransition();
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState<string | null>(null);

  function startEdit(row: Row) {
    const init: Record<string,string> = {};
    columns.filter(c => c.editable).forEach(c => { init[c.key] = row[c.key] ?? ""; });
    setEdits(init); setEditing(row.id); setError("");
  }

  function save(id: string) {
    start(async () => {
      const res = await onSave(id, edits);
      if (res.success) {
        setEditing(null); setSuccess(id);
        setTimeout(() => setSuccess(null), 2500);
      } else setError(res.error ?? "خطأ في الحفظ");
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className={`ti ${icon} text-[#0F6E56]`} />{titleAr}
        </h2>
        <div className="flex items-center gap-2">
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          {onAdd && (
            <button onClick={onAdd}
              className="flex items-center gap-1.5 text-xs bg-[#0F6E56] hover:bg-[#1D9E75] text-white px-3 py-1.5 rounded-lg transition-all">
              <i className="ti ti-plus" />{addLabel ?? "إضافة"}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#161B26]">
              {columns.map(col => (
                <th key={col.key} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">
                  {col.label}
                </th>
              ))}
              <th className="text-right text-xs text-[#6B7280] font-medium px-4 py-3 w-24">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const isEditing = editing === row.id;
              const isSaved   = success  === row.id;
              return (
                <tr key={row.id}
                  className={`border-b border-[#1F2937] last:border-0 transition-colors ${
                    isEditing ? "bg-[#0D0A00]" : isSaved ? "bg-[#001A12]" : "hover:bg-[#161B26]"
                  }`}
                >
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3">
                      {isEditing && col.editable ? (
                        <input
                          type={col.type === "number" ? "number" : "text"}
                          value={edits[col.key] ?? ""}
                          onChange={e => setEdits(p => ({ ...p, [col.key]: e.target.value }))}
                          className="w-full bg-[#161B26] border border-[#EF9F27] rounded-lg px-2.5 py-1.5 text-sm text-white focus:outline-none"
                          autoFocus={col.key === columns.find(c=>c.editable)?.key}
                        />
                      ) : col.type === "badge" ? (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                          row[col.key] === true || row[col.key] === "active"
                            ? "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]"
                            : "bg-[#161B26] text-[#4B5563] border-[#2D3748]"
                        }`}>
                          {row[col.key] === true ? "نشط" : row[col.key] === false ? "معطّل" : row[col.key]}
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]">{row[col.key] ?? "—"}</span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {isEditing ? (
                        <>
                          <button onClick={() => save(row.id)} disabled={isPending}
                            className="text-xs bg-[#0F6E56] hover:bg-[#1D9E75] text-white px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50">
                            {isPending ? "..." : "حفظ"}
                          </button>
                          <button onClick={() => { setEditing(null); setError(""); }}
                            className="text-xs text-[#6B7280] hover:text-white px-2 py-1.5 rounded-lg transition-all">
                            إلغاء
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(row)}
                            className="text-xs text-[#4B5563] hover:text-[#EF9F27] p-1.5 rounded-lg transition-all">
                            <i className="ti ti-edit text-[14px]" />
                          </button>
                          {onToggle && (
                            <button onClick={() => start(() => { onToggle(row.id, !(row.isActive ?? true)); })}
                              className={`text-xs p-1.5 rounded-lg transition-all ${
                                (row.isActive ?? true) ? "text-[#1D9E75] hover:text-[#E24B4A]" : "text-[#4B5563] hover:text-[#1D9E75]"
                              }`}>
                              <i className={`ti ${(row.isActive ?? true) ? "ti-toggle-right" : "ti-toggle-left"} text-[16px]`} />
                            </button>
                          )}
                          {isSaved && <i className="ti ti-check text-[#1D9E75] text-[14px]" />}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="text-center py-10 text-[#4B5563] text-sm">لا توجد بيانات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
