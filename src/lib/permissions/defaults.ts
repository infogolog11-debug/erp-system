// ⚠️ المفاتيح تطابق حرفياً قيم enum "user_role" في قاعدة البيانات، وتطابق أيضاً
// ROLE_DEFAULTS في src/lib/permissions/service.ts (النسخة المربوطة فعلياً بفحص
// الصلاحيات). هذا الملف منفصل عنها لأن هذا الأخير يُستورد في مكوّن client
// ولا يجوز أن يجرّ معه اتصال قاعدة البيانات.
export const ROLE_DEFAULTS: Record<string, Record<string,string>> = {
  super_admin: { grants:"admin", procurement:"admin", vendors:"admin",  hr:"admin", inventory:"admin", accounting:"admin",  reports:"admin", settings:"admin"  },
  admin:       { grants:"admin", procurement:"admin", vendors:"admin",  hr:"admin", inventory:"admin", accounting:"admin",  reports:"admin", settings:"admin"  },
  finance_manager:     { grants:"edit",  procurement:"edit",   vendors:"view",   hr:"view",  inventory:"view",  accounting:"admin",  reports:"admin", settings:"none"   },
  program_manager:     { grants:"edit",  procurement:"create", vendors:"view",   hr:"view",  inventory:"view",  accounting:"none",   reports:"view",  settings:"none"   },
  hr_manager:          { grants:"view",  procurement:"view",   vendors:"none",   hr:"admin", inventory:"view",  accounting:"none",   reports:"view",  settings:"none"   },
  procurement_officer: { grants:"view",  procurement:"admin",  vendors:"edit",   hr:"none",  inventory:"edit",  accounting:"none",   reports:"view",  settings:"none"   },
  warehouse_manager:   { grants:"none",  procurement:"view",   vendors:"view",   hr:"none",  inventory:"admin", accounting:"none",   reports:"view",  settings:"none"   },
  viewer:              { grants:"view",  procurement:"view",   vendors:"view",   hr:"view",  inventory:"view",  accounting:"view",   reports:"view",  settings:"none"   },
};

export const MODULES = [
  { code:"grants",       label:"المنح",             icon:"ti-coins"         },
  { code:"procurement",  label:"المشتريات",         icon:"ti-shopping-cart" },
  { code:"vendors",      label:"الموردون",           icon:"ti-truck"         },
  { code:"hr",           label:"الموارد البشرية",   icon:"ti-users"         },
  { code:"inventory",    label:"المخزون والأصول",   icon:"ti-package"       },
  { code:"accounting",   label:"المحاسبة",          icon:"ti-calculator"    },
  { code:"reports",      label:"التقارير",          icon:"ti-chart-bar"     },
  { code:"settings",     label:"الإعدادات",         icon:"ti-settings-2"    },
];

export const PERMISSIONS: { value:string; label:string; color:string }[] = [
  { value:"none",    label:"لا شيء",  color:"text-[#4B5563]"  },
  { value:"view",    label:"عرض",     color:"text-[#6B7280]"  },
  { value:"create",  label:"إنشاء",   color:"text-[#378ADD]"  },
  { value:"edit",    label:"تعديل",   color:"text-[#EF9F27]"  },
  { value:"approve", label:"اعتماد",  color:"text-[#A855F7]"  },
  { value:"admin",   label:"مدير",    color:"text-[#1D9E75]"  },
];
