"use client";
import { useState, useTransition } from "react";
import { setUserPermission, resetUserPermission } from "@/modules/settings/permissions-actions";
import { MODULES, PERMISSIONS, ROLE_DEFAULTS } from "@/lib/permissions/defaults";
import type { ModuleCode, PermissionLevel } from "@/lib/permissions/service";

type User = { id:string; email:string; name:string; role:string };
type ExistingPerm = { userId:string; moduleCode:string; permission:string };

const ROLE_LABELS: Record<string,string> = {
  super_admin:"مدير عام", admin:"مدير نظام", finance:"مالية",
  hr:"موارد بشرية", procurement:"مشتريات", inventory:"مخازن", viewer:"مشاهد",
};
const PERM_BG: Record<string,string> = {
  none:"bg-[#161B26] text-[#2D3748]",   view:"bg-[#161B26] text-[#6B7280]",
  create:"bg-[#0A1628] text-[#378ADD]", edit:"bg-[#1A1400] text-[#EF9F27]",
  approve:"bg-[#1A0A2E] text-[#A855F7]",admin:"bg-[#001A12] text-[#1D9E75]",
};
const PERM_LABEL: Record<string,string> = {
  none:"لا شيء", view:"عرض", create:"إنشاء", edit:"تعديل", approve:"اعتماد", admin:"مدير",
};

export default function PermissionsPanel({ orgId, grantedBy, users, existingPerms }: {
  orgId:string; grantedBy:string; users:User[]; existingPerms:ExistingPerm[];
}) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [perms, setPerms] = useState<Record<string,Record<string,string>>>(() => {
    const map: Record<string,Record<string,string>> = {};
    existingPerms.forEach(p => {
      if (!map[p.userId]) map[p.userId] = {};
      map[p.userId][p.moduleCode] = p.permission;
    });
    return map;
  });
  const [isPending, start] = useTransition();
  const [saving, setSaving] = useState<string|null>(null);
  const [msg, setMsg] = useState("");

  function getEffectivePerm(userId:string, moduleCode:string, role:string): string {
    return perms[userId]?.[moduleCode] ?? ROLE_DEFAULTS[role]?.[moduleCode] ?? "none";
  }

  function isCustom(userId:string, moduleCode:string): boolean {
    return !!perms[userId]?.[moduleCode];
  }

  function changePerm(userId:string, moduleCode:string, permission:string, userRole:string) {
    const key = `${userId}-${moduleCode}`;
    setSaving(key); setMsg("");
    start(async () => {
      const isDefault = (ROLE_DEFAULTS[userRole]?.[moduleCode] ?? "none") === permission;
      let res;
      if (isDefault) {
        res = await resetUserPermission(userId, moduleCode as ModuleCode, orgId);
        if (res.success) {
          setPerms(p => {
            const n = { ...p };
            if (n[userId]) delete n[userId][moduleCode];
            return n;
          });
        }
      } else {
        res = await setUserPermission(userId, moduleCode as ModuleCode, permission as PermissionLevel, grantedBy, orgId);
        if (res.success) {
          setPerms(p => ({ ...p, [userId]: { ...(p[userId]??{}), [moduleCode]:permission } }));
        }
      }
      if (!res.success) setMsg(res.error ?? "خطأ");
      setSaving(null);
    });
  }

  const nonAdmins = users.filter(u => u.role !== "super_admin");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-shield-lock text-[#0F6E56]" />صلاحيات المستخدمين
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          تحكم دقيق في وصول كل مستخدم لكل وحدة — يتجاوز الـ role الافتراضي
        </p>
      </div>

      {msg && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{msg}</p>}

      <div className="flex gap-5">
        {/* قائمة المستخدمين */}
        <div className="w-56 shrink-0 space-y-1">
          <p className="text-[10px] font-semibold text-[#4B5563] uppercase tracking-wider px-2 mb-2">المستخدمون</p>
          {nonAdmins.map(u => (
            <button key={u.id} onClick={() => setSelectedUser(u)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-right ${
                selectedUser?.id === u.id
                  ? "bg-[#0F6E56]/15 text-[#1D9E75] border border-[#0F3D28]"
                  : "text-[#6B7280] hover:text-white hover:bg-[#161B26] border border-transparent"
              }`}>
              <div className="w-7 h-7 rounded-lg bg-[#161B26] border border-[#2D3748] flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-[#4B5563]">{u.name[0]}</span>
              </div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-medium truncate">{u.name}</p>
                <p className="text-[10px] text-[#4B5563]">{ROLE_LABELS[u.role] ?? u.role}</p>
              </div>
            </button>
          ))}
        </div>

        {/* مصفوفة الصلاحيات */}
        {selectedUser ? (
          <div className="flex-1 bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1F2937] flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0F6E56]/20 border border-[#0F6E56]/30 flex items-center justify-center">
                <span className="text-sm font-bold text-[#1D9E75]">{selectedUser.name[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{selectedUser.name}</p>
                <p className="text-xs text-[#4B5563]">{selectedUser.email} · {ROLE_LABELS[selectedUser.role]}</p>
              </div>
              <div className="mr-auto text-[11px] text-[#4B5563] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#EF9F27]" />مخصص
                <span className="w-2 h-2 rounded-full bg-[#1F2937] mr-2" />افتراضي
              </div>
            </div>

            <div className="divide-y divide-[#1F2937]">
              {MODULES.map(mod => {
                const current = getEffectivePerm(selectedUser.id, mod.code, selectedUser.role);
                const custom  = isCustom(selectedUser.id, mod.code);
                const defPerm = ROLE_DEFAULTS[selectedUser.role]?.[mod.code] ?? "none";

                return (
                  <div key={mod.code} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex items-center gap-2.5 w-44 shrink-0">
                      <i className={`ti ${mod.icon} text-[15px] text-[#4B5563]`} />
                      <span className="text-sm text-[#D1D5DB]">{mod.label}</span>
                    </div>

                    {/* أزرار الصلاحيات */}
                    <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                      {PERMISSIONS.map(p => {
                        const isActive   = current === p.value;
                        const isDefault  = defPerm  === p.value && !custom;
                        const key        = `${selectedUser.id}-${mod.code}`;
                        const isSavingThis = saving === key;

                        return (
                          <button key={p.value}
                            onClick={() => changePerm(selectedUser.id, mod.code, p.value, selectedUser.role)}
                            disabled={isPending}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border disabled:opacity-60 ${
                              isActive
                                ? `${PERM_BG[p.value]} border-current`
                                : "bg-[#0F1117] border-[#1F2937] text-[#2D3748] hover:border-[#2D3748] hover:text-[#6B7280]"
                            }`}>
                            {isSavingThis && isActive
                              ? <span className="inline-block w-3 h-3 border border-current rounded-full animate-spin border-t-transparent" />
                              : p.label
                            }
                          </button>
                        );
                      })}
                    </div>

                    {/* مؤشر التخصيص */}
                    <div className="w-16 text-left shrink-0">
                      {custom ? (
                        <span className="text-[10px] text-[#EF9F27] flex items-center gap-1">
                          <i className="ti ti-edit text-[11px]" />مخصص
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#2D3748]">افتراضي</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* إعادة تعيين كل الصلاحيات */}
            <div className="px-5 py-4 border-t border-[#1F2937] flex items-center justify-between">
              <p className="text-xs text-[#4B5563]">
                الأزرار الذهبية = مخصصة · الرمادية = من الـ role الافتراضي
              </p>
              <button
                onClick={() => {
                  MODULES.forEach(m => {
                    if (isCustom(selectedUser.id, m.code)) {
                      start(async () => {
                        await resetUserPermission(selectedUser.id, m.code, orgId);
                        setPerms(p => {
                          const n = {...p};
                          if (n[selectedUser.id]) delete n[selectedUser.id][m.code];
                          return n;
                        });
                      });
                    }
                  });
                }}
                disabled={isPending}
                className="text-xs text-[#E24B4A] border border-[#4A1C20] bg-[#2A1215] hover:bg-[#3A1A1E] px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                <i className="ti ti-refresh mr-1" />إعادة تعيين للافتراضي
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-[#0F1117] border border-[#1F2937] rounded-2xl flex items-center justify-center">
            <div className="text-center py-16">
              <i className="ti ti-user-search text-[48px] text-[#2D3748]" />
              <p className="text-sm text-[#4B5563] mt-3">اختر مستخدماً من القائمة</p>
              <p className="text-xs text-[#2D3748] mt-1">لعرض وتعديل صلاحياته</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
