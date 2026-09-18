// مكوّن المرفقات — يُستخدم في أي صفحة تفاصيل
"use client";
import { useState, useRef, useTransition } from "react";

type Attachment = { id:string; fileName:string; fileSize:number; mimeType:string; url:string; uploadedBy?:string; createdAt?:string };
type Props = { recordType:string; recordId:string; initial:Attachment[]; };

const MIME_ICON: Record<string,string> = {
  "application/pdf":  "ti-file-type-pdf",
  "image/jpeg":       "ti-photo",
  "image/png":        "ti-photo",
  "image/webp":       "ti-photo",
  "application/msword": "ti-file-type-doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "ti-file-type-doc",
  "application/vnd.ms-excel": "ti-file-type-xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "ti-file-type-xls",
  "text/csv":         "ti-table",
};
const MIME_COLOR: Record<string,string> = {
  "application/pdf":  "text-[#E24B4A]",
  "image/jpeg":       "text-[#1D9E75]",
  "image/png":        "text-[#1D9E75]",
  "image/webp":       "text-[#1D9E75]",
  "application/msword": "text-[#378ADD]",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "text-[#378ADD]",
  "application/vnd.ms-excel": "text-[#1D9E75]",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "text-[#1D9E75]",
};

function fmtSize(b:number) {
  return b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
}

export default function AttachmentsPanel({ recordType, recordId, initial }: Props) {
  const [items,   setItems]   = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [drag,    setDrag]    = useState(false);
  const [isPending, start]    = useTransition();
  const inputRef              = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(""); setLoading(true);

    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file",       file);
      fd.append("recordType", recordType);
      fd.append("recordId",   recordId);
      fd.append("folder",     recordType);

      try {
        const res  = await fetch("/api/upload", { method:"POST", body:fd });
        const data = await res.json();
        if (data.success) setItems(p => [...p, data.attachment]);
        else setError(data.error ?? "فشل الرفع");
      } catch { setError("حدث خطأ في الرفع"); }
    }
    setLoading(false);
  }

  async function remove(id:string) {
    start(async () => {
      const res = await fetch("/api/upload", {
        method:"DELETE", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id }),
      });
      if ((await res.json()).success) setItems(p => p.filter(a => a.id !== id));
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <i className="ti ti-paperclip text-[#0F6E56]" />
          المرفقات
          {items.length > 0 && (
            <span className="text-[11px] bg-[#161B26] border border-[#2D3748] text-[#6B7280] px-2 py-0.5 rounded-full">{items.length}</span>
          )}
        </h2>
        <button onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs bg-[#0F6E56] hover:bg-[#1D9E75] text-white px-3 py-1.5 rounded-lg transition-all">
          <i className="ti ti-upload" />رفع ملف
        </button>
        <input ref={inputRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
          onChange={e => upload(e.target.files)} />
      </div>

      {/* منطقة السحب والإفلات */}
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          drag ? "border-[#0F6E56] bg-[#001A12]" : "border-[#1F2937] hover:border-[#2D3748]"
        }`}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280]">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            جارٍ الرفع...
          </div>
        ) : (
          <>
            <i className="ti ti-cloud-upload text-[28px] text-[#2D3748]" />
            <p className="text-xs text-[#4B5563] mt-2">اسحب الملفات هنا أو انقر للاختيار</p>
            <p className="text-[10px] text-[#2D3748] mt-1">PDF · Word · Excel · صور — حتى 10MB</p>
          </>
        )}
      </div>

      {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

      {/* قائمة المرفقات */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(att => {
            const icon  = MIME_ICON[att.mimeType]  ?? "ti-file";
            const color = MIME_COLOR[att.mimeType] ?? "text-[#6B7280]";
            const isImg = att.mimeType.startsWith("image/");
            return (
              <div key={att.id} className="flex items-center gap-3 p-3 bg-[#161B26] border border-[#1F2937] rounded-xl hover:border-[#2D3748] transition-all group">
                {isImg ? (
                  <img src={att.url} alt={att.fileName} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-[#0F1117] border border-[#2D3748] flex items-center justify-center flex-shrink-0">
                    <i className={`ti ${icon} text-[18px] ${color}`} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <a href={att.url} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-[#D1D5DB] hover:text-[#1D9E75] truncate block transition-colors">
                    {att.fileName}
                  </a>
                  <p className="text-[10px] text-[#4B5563] mt-0.5">{fmtSize(att.fileSize)}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a href={att.url} target="_blank" download
                    className="p-1.5 text-[#4B5563] hover:text-[#378ADD] rounded-lg transition-all">
                    <i className="ti ti-download text-[14px]" />
                  </a>
                  <button onClick={() => remove(att.id)} disabled={isPending}
                    className="p-1.5 text-[#4B5563] hover:text-[#E24B4A] rounded-lg transition-all">
                    <i className="ti ti-trash text-[14px]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {items.length === 0 && !loading && (
        <p className="text-xs text-[#2D3748] text-center py-2">لا توجد مرفقات بعد</p>
      )}
    </div>
  );
}
