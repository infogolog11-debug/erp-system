"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type Result = { type:string; icon:string; color:string; label:string; sub:string; status:string; href:string };
const TYPE_AR: Record<string,string> = { grant:"منحة", vendor:"مورد", pr:"طلب شراء", employee:"موظف", asset:"أصل" };

export default function GlobalSearch() {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<Result[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [open,     setOpen]     = useState(false);
  const [selected, setSelected] = useState(-1);
  const inputRef   = useRef<HTMLInputElement>(null);
  const router     = useRouter();

  const search = useCallback(async (q:string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e:KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); inputRef.current?.focus(); setOpen(true);
      }
      if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  function navigate(href:string) {
    router.push(href); setOpen(false); setQuery(""); setResults([]);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s+1, results.length-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s-1, 0)); }
    if (e.key === "Enter" && selected >= 0 && results[selected]) navigate(results[selected].href);
  }

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, Result[]>);

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${open ? "border-[#0F6E56] bg-[#0F1117] w-72" : "border-[#1F2937] bg-[#161B26] w-44 hover:w-52"}`}>
        <i className={`ti ti-search text-[15px] ${open ? "text-[#0F6E56]" : "text-[#4B5563]"} flex-shrink-0`} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setSelected(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder="بحث... (Ctrl+K)"
          className="flex-1 bg-transparent text-sm text-white placeholder-[#4B5563] focus:outline-none"
        />
        {loading && (
          <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0 text-[#4B5563]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/>
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); }}
            className="flex-shrink-0 text-[#4B5563] hover:text-white">
            <i className="ti ti-x text-[12px]" />
          </button>
        )}
      </div>

      {open && (query.length >= 2) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-20 w-80 bg-[#0F1117] border border-[#1F2937] rounded-2xl shadow-2xl overflow-hidden max-h-96 overflow-y-auto">
            {results.length === 0 && !loading && (
              <div className="px-4 py-8 text-center">
                <i className="ti ti-search-off text-[28px] text-[#2D3748]" />
                <p className="text-xs text-[#4B5563] mt-2">لا نتائج لـ "{query}"</p>
              </div>
            )}
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="text-[10px] font-semibold text-[#4B5563] px-4 pt-3 pb-1 uppercase tracking-wider">
                  {TYPE_AR[type] ?? type}
                </p>
                {items.map((r, i) => {
                  const idx = results.indexOf(r);
                  return (
                    <button key={i} onClick={() => navigate(r.href)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-right hover:bg-[#161B26] transition-colors ${idx === selected ? "bg-[#161B26]" : ""}`}>
                      <div className="w-8 h-8 rounded-lg bg-[#161B26] border border-[#1F2937] flex items-center justify-center flex-shrink-0">
                        <i className={`ti ${r.icon} text-[14px] ${r.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{r.label}</p>
                        {r.sub && <p className="text-[10px] text-[#4B5563] font-mono">{r.sub}</p>}
                      </div>
                      {r.status && (
                        <span className="text-[10px] text-[#4B5563] shrink-0">{r.status}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="border-t border-[#1F2937] px-4 py-2.5 flex items-center gap-3">
              <span className="text-[10px] text-[#2D3748]">↑↓ تنقل</span>
              <span className="text-[10px] text-[#2D3748]">↵ اختر</span>
              <span className="text-[10px] text-[#2D3748]">Esc إغلاق</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
