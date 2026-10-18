// صفحة البيانات الأساسية — Client Component مع تبويبات
"use client";
import { useState, useTransition } from "react";
import MasterDataTable from "./MasterDataTable";
import { updateMasterDataRecord, toggleMasterDataRecord, createMasterDataRecord } from "@/modules/settings/master-data-actions";
import type { AppLocale } from "@/lib/preferences";

// سجل بيانات أساسية عام — كل الجداول (departments, positions, etc) تشترك بهذا الشكل
type MasterDataRecord = {
  id: string;
  code?: string | null;
  name?: string | null;
  nameAr?: string | null;
  title?: string | null;
  titleAr?: string | null;
  isActive?: boolean;
  [key: string]: unknown;
};

type MasterDataKey = "departments"|"positions"|"costCenters"|"currencies"|"itemCategories"|"warehouses"|"donors";

type Props = {
  orgId: string;
  data: Record<MasterDataKey, MasterDataRecord[]>;
  locale?: AppLocale;
};

const TABS = [
  { key:"departments",    labelAr:"الأقسام",              labelEn:"Departments",     icon:"ti-building-community"  },
  { key:"positions",      labelAr:"المسميات الوظيفية",    labelEn:"Positions",       icon:"ti-user-star"           },
  { key:"costCenters",    labelAr:"مراكز التكلفة",        labelEn:"Cost centers",    icon:"ti-target"              },
  { key:"currencies",     labelAr:"العملات",              labelEn:"Currencies",      icon:"ti-currency-dollar"     },
  { key:"itemCategories", labelAr:"فئات المخزون",         labelEn:"Item categories", icon:"ti-category"            },
  { key:"warehouses",     labelAr:"المستودعات",           labelEn:"Warehouses",      icon:"ti-building-warehouse"  },
  { key:"donors",         labelAr:"جهات المانحين",        labelEn:"Donors",          icon:"ti-heart-handshake"     },
];

type ColumnDef = { key:string; label:string; editable?:boolean; type?:"text"|"number"|"badge" };

const COLUMNS: Record<AppLocale, Record<string, ColumnDef[]>> = {
  ar: {
    departments:    [
      { key:"code",       label:"الكود",     editable:true },
      { key:"nameAr",     label:"الاسم عربي",editable:true },
      { key:"name",       label:"الاسم إنجليزي", editable:true },
      { key:"isActive",   label:"الحالة",    type:"badge" },
    ],
    positions:      [
      { key:"code",       label:"الكود",     editable:true },
      { key:"titleAr",    label:"المسمى عربي",editable:true },
      { key:"title",      label:"المسمى إنجليزي", editable:true },
      { key:"gradeLevel", label:"الدرجة",    editable:true, type:"number" },
      { key:"minSalary",  label:"أدنى راتب", editable:true, type:"number" },
      { key:"maxSalary",  label:"أعلى راتب", editable:true, type:"number" },
      { key:"isActive",   label:"الحالة",    type:"badge" },
    ],
    costCenters:    [
      { key:"code",    label:"الكود",     editable:true },
      { key:"nameAr",  label:"الاسم عربي",editable:true },
      { key:"name",    label:"الاسم إنجليزي", editable:true },
      { key:"isActive",label:"الحالة",    type:"badge" },
    ],
    currencies:     [
      { key:"code",         label:"الرمز",         editable:true },
      { key:"nameAr",       label:"الاسم عربي",    editable:true },
      { key:"name",         label:"الاسم إنجليزي", editable:true },
      { key:"exchangeRate", label:"سعر الصرف vs USD", editable:true, type:"number" },
      { key:"symbol",       label:"الرمز",         editable:true },
      { key:"isActive",     label:"الحالة",        type:"badge" },
    ],
    itemCategories: [
      { key:"code",    label:"الكود",     editable:true },
      { key:"nameAr",  label:"الاسم عربي",editable:true },
      { key:"name",    label:"الاسم إنجليزي", editable:true },
    ],
    warehouses:     [
      { key:"code",     label:"الكود",     editable:true },
      { key:"nameAr",   label:"الاسم عربي",editable:true },
      { key:"name",     label:"الاسم إنجليزي", editable:true },
      { key:"location", label:"الموقع",    editable:true },
      { key:"isActive", label:"الحالة",    type:"badge" },
    ],
    donors:         [
      { key:"code",    label:"الكود",     editable:true },
      { key:"nameAr",  label:"الاسم عربي",editable:true },
      { key:"name",    label:"الاسم إنجليزي", editable:true },
      { key:"country", label:"الدولة",    editable:true },
      { key:"website", label:"الموقع",    editable:true },
    ],
  },
  en: {
    departments:    [
      { key:"code",       label:"Code",        editable:true },
      { key:"nameAr",     label:"Arabic name", editable:true },
      { key:"name",       label:"English name",editable:true },
      { key:"isActive",   label:"Status",      type:"badge" },
    ],
    positions:      [
      { key:"code",       label:"Code",        editable:true },
      { key:"titleAr",    label:"Arabic title",editable:true },
      { key:"title",      label:"English title", editable:true },
      { key:"gradeLevel", label:"Grade",       editable:true, type:"number" },
      { key:"minSalary",  label:"Min salary",  editable:true, type:"number" },
      { key:"maxSalary",  label:"Max salary",  editable:true, type:"number" },
      { key:"isActive",   label:"Status",      type:"badge" },
    ],
    costCenters:    [
      { key:"code",    label:"Code",        editable:true },
      { key:"nameAr",  label:"Arabic name", editable:true },
      { key:"name",    label:"English name",editable:true },
      { key:"isActive",label:"Status",      type:"badge" },
    ],
    currencies:     [
      { key:"code",         label:"Code",               editable:true },
      { key:"nameAr",       label:"Arabic name",        editable:true },
      { key:"name",         label:"English name",       editable:true },
      { key:"exchangeRate", label:"Exchange rate vs USD", editable:true, type:"number" },
      { key:"symbol",       label:"Symbol",             editable:true },
      { key:"isActive",     label:"Status",             type:"badge" },
    ],
    itemCategories: [
      { key:"code",    label:"Code",        editable:true },
      { key:"nameAr",  label:"Arabic name", editable:true },
      { key:"name",    label:"English name",editable:true },
    ],
    warehouses:     [
      { key:"code",     label:"Code",        editable:true },
      { key:"nameAr",   label:"Arabic name", editable:true },
      { key:"name",     label:"English name",editable:true },
      { key:"location", label:"Location",    editable:true },
      { key:"isActive", label:"Status",      type:"badge" },
    ],
    donors:         [
      { key:"code",    label:"Code",        editable:true },
      { key:"nameAr",  label:"Arabic name", editable:true },
      { key:"name",    label:"English name",editable:true },
      { key:"country", label:"Country",     editable:true },
      { key:"website", label:"Website",     editable:true },
    ],
  },
};

// نماذج الإضافة الافتراضية لكل تصنيف
const ADD_DEFAULTS: Record<string, Record<string,string>> = {
  departments:    { code:"", nameAr:"", name:"",       isActive:"true" },
  positions:      { code:"", titleAr:"", title:"", gradeLevel:"5", minSalary:"500", maxSalary:"2000" },
  costCenters:    { code:"", nameAr:"", name:"",       isActive:"true" },
  currencies:     { code:"", nameAr:"", name:"", symbol:"", exchangeRate:"1" },
  itemCategories: { code:"", nameAr:"", name:""       },
  warehouses:     { code:"", nameAr:"", name:"", location:"", isActive:"true" },
  donors:         { code:"", nameAr:"", name:"", country:"", website:"" },
};

export default function MasterDataPage({ orgId, data, locale = "ar" }: Props) {
  const isAr = locale === "ar";
  const t = isAr
    ? {
        title: "البيانات الأساسية",
        subtitle: "إدارة الجداول المرجعية للنظام",
        addNew: (label: string) => `إضافة ${label} جديد`,
        save: "حفظ",
        cancel: "إلغاء",
        error: "حدث خطأ",
      }
    : {
        title: "Master data",
        subtitle: "Manage the system's reference tables",
        addNew: (label: string) => `Add new ${label}`,
        save: "Save",
        cancel: "Cancel",
        error: "An error occurred",
      };
  const [activeTab, setActiveTab]   = useState<MasterDataKey>("departments");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRecord, setNewRecord]   = useState<Record<string,string>>({});
  const [isPending, start]          = useTransition();
  const [addError, setAddError]     = useState("");
  const [localData, setLocalData]   = useState<Record<MasterDataKey, MasterDataRecord[]>>(data);

  const tab     = TABS.find(o => o.key === activeTab)!;
  const columns = (COLUMNS[locale] ?? COLUMNS.ar)[activeTab] ?? [];
  const rows    = localData[activeTab] ?? [];

  async function handleSave(id: string, changes: Record<string,string>) {
    const res = await updateMasterDataRecord(activeTab, id, changes, orgId);
    if (res.success) {
      setLocalData(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map((r) =>
          r.id === id ? { ...r, ...changes } : r
        ),
      }));
    }
    return res;
  }

  async function handleToggle(id: string, isActive: boolean) {
    const res = await toggleMasterDataRecord(activeTab, id, isActive, orgId);
    if (res.success) {
      setLocalData(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map((r) =>
          r.id === id ? { ...r, isActive } : r
        ),
      }));
    }
    return res;
  }

  function openAddForm() {
    setNewRecord({ ...ADD_DEFAULTS[activeTab] });
    setShowAddForm(true);
    setAddError("");
  }

  function submitAdd() {
    setAddError("");
    start(async () => {
      const res = await createMasterDataRecord(activeTab, newRecord, orgId);
      if (res.success) {
        setLocalData(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], res.data],
        }));
        setShowAddForm(false);
      } else setAddError(res.error ?? t.error);
    });
  }

  const editableCols = columns.filter((c) => c.editable);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <i className="ti ti-database text-[#0F6E56]" />{t.title}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">{t.subtitle}</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(tabItem => (
          <button key={tabItem.key} onClick={() => { setActiveTab(tabItem.key as MasterDataKey); setShowAddForm(false); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
              activeTab === tabItem.key
                ? "bg-[#0F6E56] text-white font-medium"
                : "bg-[#0F1117] border border-[#1F2937] text-[#6B7280] hover:text-white"
            }`}>
            <i className={`ti ${tabItem.icon} text-[14px]`} />
            {isAr ? tabItem.labelAr : tabItem.labelEn}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              activeTab === tabItem.key ? "bg-white/20 text-white" : "bg-[#1F2937] text-[#4B5563]"
            }`}>
              {(localData[tabItem.key as MasterDataKey] ?? []).length}
            </span>
          </button>
        ))}
      </div>

      {/* نموذج الإضافة */}
      {showAddForm && (
        <div className="bg-[#0D0A00] border border-[#3D2E00] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#EF9F27] flex items-center gap-2">
              <i className="ti ti-plus" />{t.addNew(isAr ? tab.labelAr : tab.labelEn)}
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-[#4B5563] hover:text-white">
              <i className="ti ti-x" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {editableCols.map((col) => (
              <div key={col.key}>
                <label className="text-xs text-[#6B7280] block mb-1">{col.label}</label>
                <input
                  type={col.type === "number" ? "number" : "text"}
                  value={newRecord[col.key] ?? ""}
                  onChange={e => setNewRecord(p => ({ ...p, [col.key]: e.target.value }))}
                  className="w-full bg-[#161B26] border border-[#3D2E00] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#EF9F27]"
                />
              </div>
            ))}
          </div>
          {addError && <p className="text-xs text-[#E24B4A] flex items-center gap-1"><i className="ti ti-alert-circle" />{addError}</p>}
          <div className="flex gap-2">
            <button onClick={submitAdd} disabled={isPending}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-50">
              {isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                : <i className="ti ti-check" />
              }
              {t.save}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-[#6B7280] hover:text-white border border-[#2D3748] rounded-lg">
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {/* الجدول */}
      <MasterDataTable
        title={tab.labelEn}
        titleAr={tab.labelAr}
        icon={tab.icon}
        columns={columns}
        rows={rows}
        onSave={handleSave}
        onToggle={columns.some((c) => c.key === "isActive") ? handleToggle : undefined}
        onAdd={openAddForm}
        addLabel={isAr ? `إضافة ${tab.labelAr.replace("ال","")}` : `Add ${tab.labelEn}`}
        locale={locale}
      />
    </div>
  );
}
