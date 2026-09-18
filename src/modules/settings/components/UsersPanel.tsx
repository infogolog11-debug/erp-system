"use client";
import { useState, useTransition } from "react";
import { updateUser, toggleUser, resetPassword } from "@/modules/settings/user-actions";
import type { UserRole } from "@/types/db";

type User = { id:string; email:string; name:string; nameAr:string; role:string; isActive:boolean; createdAt:string };
const ROLES = ["admin","finance_manager","program_manager","hr_manager","procurement_officer","warehouse_manager","viewer"];
const ROLE_LABEL: Record<string,string> = {
  admin:"مدير النظام", finance_manager:"المالية", program_manager:"مدير برامج",
  hr_manager:"الموارد البشرية", procurement_officer:"المشتريات",
  warehouse_manager:"المخزون", viewer:"قارئ", super_admin:"سوبر آدمن",
};
const ROLE_COLOR: Record<string,string> = {
  admin:"bg-[#2A1215] text-[#E24B4A] border-[#4A1C20]",
  super_admin:"bg-[#1A0A2E] text-[#A855F7] border-[#3D1A6E]",
  finance:"bg-[#0A1628] text-[#378ADD] border-[#1A3060]",
  hr:"bg-[#001A12] text-[#1D9E75] border-[#0F3D28]",
  procurement:"bg-[#271E0A] text-[#EF9F27] border-[#3D2E00]",
  inventory:"bg-[#0D0A2A] text-[#7C6EF5] border-[#2A2060]",
  viewer:"bg-[#161B26] text-[#6B7280] border-[#2D3748]",
};

export default function UsersPanel({ orgId, users:initial }: { orgId:string; users:User[] }) {
  const [users, setUsers]       = useState(initial);
  const [editing, setEditing]   = useState<string|null>(null);
  const [form, setForm]         = useState<Partial<User>>({});
  const [isPending, start]      = useTransition();
  const [error, setError]       = useState("");
  const [resetMsg, setResetMsg] = useState<Record<string,string>>({});

  function startEdit(u: User) {
    setForm({ name:u.name, nameAr:u.nameAr, role:u.role });
    setEditing(u.id); setError("");
  }

  function save(id: string) {
    start(async () => {
      const res = await updateUser(id, form as { name?:string; nameAr?:string; role?:UserRole }, orgId);
      if (res.success) {
        setUsers(p => p.map(u => u.id === id ? { ...u, ...form } : u));
        setEditing(null);
      } else setError(res.error ?? "خطأ");
    });
  }

  function toggle(id: string, isActive: boolean) {
    start(async () => {
      const res = await toggleUser(id, isActive, orgId);
      if (res.success) setUsers(p => p.map(u => u.id === id ? { ...u, isActive } : u));
    });
  }

  function doReset(id: string) {
    start(async () => {
      const res = await resetPassword(id, orgId);
      if (res.success) {
        setResetMsg(p => ({ ...p, [id]: res.data.tempPassword }));
        setTimeout(() => setResetMsg(p => { const c={...p}; delete c[id]; return c; }), 15000);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-users text-[#0F6E56]" />إدارة المستخدمين
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">{users.length} مستخدم في المنظمة</p>
      </div>
      {error && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{error}</p>}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1F2937] bg-[#161B26]">
              {["المستخدم","البريد الإلكتروني","الدور","الحالة","تاريخ الإنشاء","إجراءات"].map(h => (
                <th key={h} className="text-right text-xs text-[#6B7280] font-medium px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isEditing = editing === u.id;
              return (
                <tr key={u.id} className={`border-b border-[#1F2937] last:border-0 transition-colors ${isEditing ? "bg-[#0D0A00]" : "hover:bg-[#161B26]"}`}>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input value={form.nameAr ?? ""} onChange={e => setForm(p => ({...p, nameAr:e.target.value}))}
                          placeholder="الاسم بالعربي" className="w-full bg-[#161B26] border border-[#EF9F27] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none" />
                        <input value={form.name ?? ""} onChange={e => setForm(p => ({...p, name:e.target.value}))}
                          placeholder="الاسم بالإنجليزي" className="w-full bg-[#161B26] border border-[#2D3748] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none" />
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-[#D1D5DB]">{u.nameAr || u.name || "—"}</p>
                        {u.nameAr && u.name && <p className="text-xs text-[#4B5563]">{u.name}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#6B7280] text-xs font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <select value={form.role ?? u.role} onChange={e => setForm(p => ({...p, role:e.target.value}))}
                        className="bg-[#161B26] border border-[#EF9F27] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none">
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>)}
                      </select>
                    ) : (
                      <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium ${ROLE_COLOR[u.role] ?? ""}`}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                      u.isActive ? "bg-[#001A12] text-[#1D9E75] border-[#0F3D28]" : "bg-[#161B26] text-[#4B5563] border-[#2D3748]"
                    }`}>{u.isActive ? "نشط" : "معطّل"}</span>
                  </td>
                  <td className="px-4 py-3 text-[#4B5563] text-xs">
                    {new Date(u.createdAt).toLocaleDateString("ar")}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => save(u.id)} disabled={isPending}
                          className="text-xs bg-[#0F6E56] text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                          حفظ
                        </button>
                        <button onClick={() => setEditing(null)} className="text-xs text-[#6B7280] px-2 py-1.5 rounded-lg hover:text-white">
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => startEdit(u)} title="تعديل" className="p-1.5 text-[#4B5563] hover:text-[#EF9F27] rounded-lg transition-all">
                          <i className="ti ti-edit text-[14px]" />
                        </button>
                        <button onClick={() => toggle(u.id, !u.isActive)} title={u.isActive ? "تعطيل" : "تفعيل"}
                          className={`p-1.5 rounded-lg transition-all ${u.isActive ? "text-[#1D9E75] hover:text-[#E24B4A]" : "text-[#4B5563] hover:text-[#1D9E75]"}`}>
                          <i className={`ti ${u.isActive ? "ti-toggle-right" : "ti-toggle-left"} text-[16px]`} />
                        </button>
                        <button onClick={() => doReset(u.id)} title="إعادة تعيين كلمة المرور"
                          className="p-1.5 text-[#4B5563] hover:text-[#378ADD] rounded-lg transition-all">
                          <i className="ti ti-key text-[14px]" />
                        </button>
                      </div>
                    )}
                    {resetMsg[u.id] && (
                      <div className="mt-1.5 p-2 bg-[#0A1628] border border-[#1A3060] rounded-lg">
                        <p className="text-[10px] text-[#6B7280]">كلمة المرور المؤقتة:</p>
                        <p className="text-xs font-mono font-bold text-[#378ADD]">{resetMsg[u.id]}</p>
                        <p className="text-[10px] text-[#4B5563] mt-0.5">تختفي بعد 15 ثانية</p>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
