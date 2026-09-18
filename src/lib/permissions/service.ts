// ════════════════════════════════════════════════════════════
// خدمة الصلاحيات الدقيقة per-module
// التسلسل الهرمي:
//   super_admin → كل الصلاحيات دائماً
//   admin       → كل الصلاحيات دائماً
//   غيرهم      → حسب user_module_permissions أو الـ role defaults
// ════════════════════════════════════════════════════════════
import { db }    from "@/db";
import { userModulePermissions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cache }   from "react";

export type PermissionLevel = "none"|"view"|"create"|"edit"|"approve"|"admin";
export type ModuleCode =
  | "grants"|"procurement"|"vendors"|"hr"|"inventory"|"accounting"
  | "reports"|"settings"|"notifications"|"beneficiaries"|"partners"|"cfm"
  | "fleet"|"screening";

// صلاحيات الأدوار الافتراضية (تُستخدم إذا لم تُعيَّن صلاحية مخصصة)
const ROLE_DEFAULTS: Record<string, Record<ModuleCode, PermissionLevel>> = {
  super_admin: { grants:"admin", procurement:"admin", vendors:"admin",  hr:"admin", inventory:"admin", accounting:"admin",  reports:"admin", settings:"admin", notifications:"admin", beneficiaries:"admin", partners:"admin", cfm:"admin", fleet:"admin", screening:"admin" },
  admin:       { grants:"admin", procurement:"admin", vendors:"admin",  hr:"admin", inventory:"admin", accounting:"admin",  reports:"admin", settings:"admin", notifications:"admin", beneficiaries:"admin", partners:"admin", cfm:"admin", fleet:"admin", screening:"admin" },
  finance:     { grants:"edit",  procurement:"edit",  vendors:"view",   hr:"view",  inventory:"view",  accounting:"admin",  reports:"admin", settings:"none",  notifications:"view",  beneficiaries:"view",  partners:"view",  cfm:"view",  fleet:"view",  screening:"none" },
  hr:          { grants:"view",  procurement:"view",  vendors:"none",   hr:"admin", inventory:"view",  accounting:"none",   reports:"view",  settings:"none",  notifications:"view",  beneficiaries:"none",  partners:"none",  cfm:"view",  fleet:"none",  screening:"none" },
  procurement: { grants:"view",  procurement:"admin", vendors:"edit",   hr:"none",  inventory:"edit",  accounting:"none",   reports:"view",  settings:"none",  notifications:"view",  beneficiaries:"none",  partners:"view",  cfm:"none",  fleet:"edit",  screening:"view" },
  inventory:   { grants:"none",  procurement:"view",  vendors:"view",   hr:"none",  inventory:"admin", accounting:"none",   reports:"view",  settings:"none",  notifications:"view",  beneficiaries:"none",  partners:"none",  cfm:"none",  fleet:"edit",  screening:"none" },
  viewer:      { grants:"view",  procurement:"view",  vendors:"view",   hr:"view",  inventory:"view",  accounting:"view",   reports:"view",  settings:"none",  notifications:"view",  beneficiaries:"view",  partners:"view",  cfm:"view",  fleet:"view",  screening:"none" },
};

const PERMISSION_RANK: Record<PermissionLevel, number> = {
  none:0, view:1, create:2, edit:3, approve:4, admin:5,
};

// ─── جلب صلاحية مستخدم لوحدة معينة ────────────────────────────────────────
export const getUserPermission = cache(async (
  userId:         string,
  organizationId: string,
  moduleCode:     ModuleCode,
  userRole:       string,
): Promise<PermissionLevel> => {
  // super_admin و admin → صلاحية كاملة دائماً
  if (userRole === "super_admin" || userRole === "admin") return "admin";

  // ابحث عن صلاحية مخصصة في DB
  const custom = await db.query.userModulePermissions.findFirst({
    where: and(
      eq(userModulePermissions.userId,         userId),
      eq(userModulePermissions.organizationId, organizationId),
      eq(userModulePermissions.moduleCode,     moduleCode),
    ),
  });

  if (custom) return custom.permission as PermissionLevel;

  // fallback: صلاحية الدور الافتراضية
  return ROLE_DEFAULTS[userRole]?.[moduleCode] ?? "none";
});

// ─── جلب كل صلاحيات مستخدم دفعةً ────────────────────────────────────────
export const getAllUserPermissions = cache(async (
  userId:         string,
  organizationId: string,
  userRole:       string,
): Promise<Record<ModuleCode, PermissionLevel>> => {
  if (userRole === "super_admin" || userRole === "admin") {
    return Object.fromEntries(
      Object.keys(ROLE_DEFAULTS.admin).map(k => [k,"admin"])
    ) as Record<ModuleCode, PermissionLevel>;
  }

  // جلب كل الصلاحيات المخصصة
  const customs = await db.query.userModulePermissions.findMany({
    where: and(
      eq(userModulePermissions.userId,         userId),
      eq(userModulePermissions.organizationId, organizationId),
    ),
  });
  const customMap = Object.fromEntries(customs.map(c => [c.moduleCode, c.permission]));

  const defaults = ROLE_DEFAULTS[userRole] ?? ROLE_DEFAULTS.viewer;
  return Object.fromEntries(
    (Object.keys(defaults) as ModuleCode[]).map(mod => [
      mod,
      (customMap[mod] as PermissionLevel) ?? defaults[mod]
    ])
  ) as Record<ModuleCode, PermissionLevel>;
});

// ─── دوال مساعدة للفحص السريع ───────────────────────────────────────────
export function can(perm: PermissionLevel, required: PermissionLevel): boolean {
  return PERMISSION_RANK[perm] >= PERMISSION_RANK[required];
}

export function canView(perm:    PermissionLevel) { return can(perm, "view");    }
export function canCreate(perm:  PermissionLevel) { return can(perm, "create");  }
export function canEdit(perm:    PermissionLevel) { return can(perm, "edit");    }
export function canApprove(perm: PermissionLevel) { return can(perm, "approve"); }
export function canAdmin(perm:   PermissionLevel) { return can(perm, "admin");   }
