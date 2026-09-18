"use client";
import { useState, useTransition } from "react";
import { saveApprovalRule, deleteApprovalRule } from "@/modules/settings/approval-matrix-actions";

type UserRole = "super_admin"|"admin"|"finance_manager"|"program_manager"|"hr_manager"|"procurement_officer"|"warehouse_manager"|"viewer";

type Rule = {
  id:string; moduleCode:string; minAmount:number; maxAmount:number|null;
  approvalLevel:number; levelName:string; approverUserId:string|null;
  approverRole:UserRole|null; slaHours:number; isActive:boolean;
};
type User = { id:string; name:string; role:string };

const MODULES = [
  { key:"procurement", label:"المشتريات",  icon:"ti-shopping-cart" },
  { key:"grants",      label:"المنح",      icon:"ti-heart-handshake" },
  { key:"payments",    label:"المدفوعات",  icon:"ti-cash" },
  { key:"hr",          label:"الموارد البشرية", icon:"ti-users" },
];

const EMPTY_RULE = {
  moduleCode:"procurement", minAmount:0, maxAmount:null as number|null,
  approvalLevel:1, levelName:"", approverUserId:null as string|null,
  approverRole:null as UserRole|null, slaHours:48, isActive:true,
};

export default function ApprovalMatrixPanel({ orgId, rules: initialRules, users }: {
  orgId:string; rules:Rule[]; users:User[];
}) {
  const [rules, setRules]       = useState(initialRules);
  const [activeModule, setMod]  = useState("procurement");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_RULE });
  const [editId, setEditId]     = useState<string|null>(null);
  const [isPending, start]      = useTransition();
  const [error, setError]       = useState("");

  const filtered = rules.filter(r => r.moduleCode === activeModule)
    .sort((a,b) => a.minAmount - b.minAmount || a.approvalLevel - b.approvalLevel);

  function openAdd() {
    setForm({ ...EMPTY_RULE, moduleCode: activeModule });
    setEditId(null); setShowForm(true); setError("");
  }

  function openEdit(r: Rule) {
    setForm({
      moduleCode:r.moduleCode, minAmount:r.minAmount, maxAmount:r.maxAmount,
      approvalLevel:r.approvalLevel, levelName:r.levelName,
      approverUserId:r.approverUserId, approverRole:r.approverRole,
      slaHours:r.slaHours, isActive:r.isActive,
    });
    setEditId(r.id); setShowForm(true); setError("");
  }

  function submit() {
    if (!form.levelName.trim()) { setError("اسم المرحلة مطلوب"); return; }
    if (!form.approverUserId && !form.approverRole) { setError("يجب تحديد الموافق أو الدور"); return; }
    setError("");
    start(async () => {
      const res = await saveApprovalRule(orgId, editId, form);
      if (res.success) {
        if (editId) {
          setRules(p => p.map(r => r.id === editId ? { ...r, ...form, id:editId } : r));
        } else {
          setRules(p => [...p, { ...form, id:res.data.id }]);
        }
        setShowForm(false); setEditId(null);
      } else setError(res.error ?? "خطأ");
    });
  }

  function remove(id: string) {
    start(async () => {
      const res = await deleteApprovalRule(id, orgId);
      if (res.success) setRules(p => p.filter(r => r.id !== id));
    });
  }

  const fmt = (n:number|null) => n !== null ? n.toLocaleString() : "∞";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-shield-check text-[#0F6E56]" />مصفوفة التواقيع
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          تحديد عدد ومستويات الموافقات حسب قيمة الطلب ووحدة العمل
        </p>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2">
        {MODULES.map(m => (
          <button key={m.key} onClick={() => { setMod(m.key); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all ${
              activeModule === m.key
                ? "bg-[#0F6E56] text-white font-medium"
                : "bg-[#0F1117] border border-[#1F2937] text-[#6B7280] hover:text-white"
            }`}>
            <i className={`ti ${m.icon} text-[14px]`} />
            {m.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
              activeModule === m.key ? "bg-white/20" : "bg-[#1F2937] text-[#4B5563]"
            }`}>
              {rules.filter(r => r.moduleCode === m.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* نموذج الإضافة/التعديل */}
      {showForm && (
        <div className="bg-[#0D0A00] border border-[#3D2E00] rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#EF9F27] flex items-center gap-2">
            <i className={`ti ${editId ? "ti-edit" : "ti-plus"}`} />
            {editId ? "تعديل مرحلة موافقة" : "إضافة مرحلة موافقة جديدة"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">اسم المرحلة</label>
              <input value={form.levelName}
                onChange={e => setForm(p => ({ ...p, levelName: e.target.value }))}
                placeholder="مثال: موافقة مدير المشتريات"
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">المستوى</label>
              <input type="number" min={1} max={5} value={form.approvalLevel}
                onChange={e => setForm(p => ({ ...p, approvalLevel: Number(e.target.value) }))}
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">SLA (ساعة)</label>
              <input type="number" min={1} value={form.slaHours}
                onChange={e => setForm(p => ({ ...p, slaHours: Number(e.target.value) }))}
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">الحد الأدنى ($)</label>
              <input type="number" min={0} value={form.minAmount}
                onChange={e => setForm(p => ({ ...p, minAmount: Number(e.target.value) }))}
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">الحد الأعلى ($ — اتركه فارغاً = بلا حد)</label>
              <input type="number" min={0}
                value={form.maxAmount ?? ""}
                onChange={e => setForm(p => ({ ...p, maxAmount: e.target.value ? Number(e.target.value) : null }))}
                placeholder="∞ بلا حد"
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]" />
            </div>
            <div>
              <label className="text-xs text-[#6B7280] block mb-1">الموافق (مستخدم)</label>
              <select value={form.approverUserId ?? ""}
                onChange={e => setForm(p => ({ ...p, approverUserId: e.target.value || null, approverRole: e.target.value ? null : p.approverRole }))}
                className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]">
                <option value="">— اختر مستخدم —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={isPending}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-all">
              {isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                : <i className="ti ti-check" />
              }
              {editId ? "تحديث" : "حفظ"}
            </button>
            <button onClick={() => { setShowForm(false); setError(""); }}
              className="px-4 py-2 text-sm text-[#6B7280] hover:text-white border border-[#2D3748] rounded-lg transition-all">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* جدول القواعد */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1F2937]">
          <h2 className="text-sm font-semibold text-white">
            قواعد {MODULES.find(m => m.key === activeModule)?.label}
          </h2>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 text-xs bg-[#0F6E56] hover:bg-[#1D9E75] text-white px-3 py-1.5 rounded-lg transition-all">
            <i className="ti ti-plus" />إضافة مرحلة
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <i className="ti ti-shield-off text-[40px] text-[#2D3748]" />
            <p className="text-sm text-[#4B5563] mt-3">لا توجد قواعد موافقة لهذه الوحدة</p>
            <p className="text-xs text-[#2D3748] mt-1">أضف مرحلة موافقة لتفعيل نظام التواقيع</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1F2937] bg-[#161B26]">
                {["النطاق المالي","المستوى","اسم المرحلة","الموافق","SLA","الحالة","إجراء"].map(h => (
                  <th key={h} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-[#1F2937] last:border-0 hover:bg-[#161B26] transition-colors">
                  <td className="px-4 py-3 tabular-nums">
                    <span className="text-[#D1D5DB] font-medium">${r.minAmount.toLocaleString()}</span>
                    <span className="text-[#4B5563] mx-1">—</span>
                    <span className="text-[#D1D5DB]">${fmt(r.maxAmount)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="w-7 h-7 flex items-center justify-center bg-[#0F6E56]/20 text-[#1D9E75] text-xs font-bold rounded-lg">
                      L{r.approvalLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#D1D5DB]">{r.levelName}</td>
                  <td className="px-4 py-3 text-[#9CA3AF] text-xs">
                    {r.approverUserId
                      ? (users.find(u => u.id === r.approverUserId)?.name ?? "مستخدم")
                      : r.approverRole ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] text-xs">{r.slaHours}س</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                      r.isActive ? "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]" : "bg-[#161B26] text-[#4B5563] border-[#2D3748]"
                    }`}>{r.isActive ? "نشط" : "معطّل"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#4B5563] hover:text-[#EF9F27] rounded-lg transition-all">
                        <i className="ti ti-edit text-[14px]" />
                      </button>
                      <button onClick={() => remove(r.id)} className="p-1.5 text-[#4B5563] hover:text-[#E24B4A] rounded-lg transition-all">
                        <i className="ti ti-trash text-[14px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
