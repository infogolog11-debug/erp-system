// لوحة الإعدادات الكاملة — 6 تصنيفات تفاعلية
"use client";
import { useState, useTransition } from "react";
import { updateSettingsBatch }      from "@/modules/settings/actions";

type Setting = {
  settingKey: string; value: string; valueType: string;
  labelAr?: string | null; label: string;
  descriptionAr?: string | null; description?: string | null;
  unit?: string | null; minValue?: string | null; maxValue?: string | null;
};

type Props = {
  organizationId: string;
  settings:       Record<string, Record<string, string>>;
};

// تعريف التصنيفات وترتيبها وأيقوناتها
const CATEGORIES = [
  { key:"payroll",       labelAr:"الرواتب",         icon:"ti-moneybag",         color:"text-[#1D9E75]"  },
  { key:"budget",        labelAr:"الميزانية",        icon:"ti-chart-pie",         color:"text-[#378ADD]"  },
  { key:"procurement",   labelAr:"المشتريات",        icon:"ti-shopping-cart",     color:"text-[#EF9F27]"  },
  { key:"assets",        labelAr:"الأصول الثابتة",   icon:"ti-building",          color:"text-[#A855F7]"  },
  { key:"hr",            labelAr:"الموارد البشرية",  icon:"ti-users",             color:"text-[#E07020]"  },
  { key:"notifications", labelAr:"الإشعارات",        icon:"ti-bell",              color:"text-[#E24B4A]"  },
];

// تعريف الإعدادات مع labels العربية وأوصافها
const SETTING_META: Record<string, { labelAr: string; desc: string; valueType: string; unit?: string; min?: number; max?: number; options?: string[] }> = {
  income_tax_rate:              { labelAr:"نسبة ضريبة الدخل",              desc:"تُطبَّق على الراتب فوق حد الإعفاء",     valueType:"number", unit:"%",    min:0,  max:50  },
  social_security_rate:         { labelAr:"نسبة الضمان الاجتماعي",         desc:"تُخصم من إجمالي الراتب الشهري",       valueType:"number", unit:"%",    min:0,  max:30  },
  overtime_multiplier:          { labelAr:"معامل الأوفرتايم",               desc:"عامل الضرب لكل ساعة إضافية",          valueType:"number", unit:"×",    min:1,  max:3   },
  working_days_per_month:       { labelAr:"أيام العمل في الشهر",           desc:"يُستخدم لحساب اليومية",                valueType:"number", unit:"يوم",  min:18, max:26  },
  tax_exempt_threshold:         { labelAr:"حد الإعفاء الضريبي",            desc:"المبلغ المعفى من الضريبة شهرياً",      valueType:"number", unit:"USD",  min:0,  max:5000},
  weekend_days:                 { labelAr:"أيام العطلة (0=أحد..6=سبت)",   desc:"أرقام مفصولة بفاصلة",                  valueType:"string"                         },
  warning_threshold:            { labelAr:"نسبة تحذير الميزانية",          desc:"إشعار عند بلوغ هذه النسبة",            valueType:"number", unit:"%",    min:50, max:95  },
  critical_threshold:           { labelAr:"نسبة الخطر الحرج",              desc:"تحذير أشد عند هذه النسبة",             valueType:"number", unit:"%",    min:80, max:99  },
  block_threshold:              { labelAr:"نسبة الحجب",                    desc:"حجب الطلبات الجديدة بعد هذه النسبة",   valueType:"number", unit:"%",    min:95, max:110 },
  notify_cooldown_hours:        { labelAr:"فترة التهدئة بين الإشعارات",    desc:"لا يُعاد الإشعار قبل انقضاء هذه المدة",valueType:"number", unit:"ساعة", min:1,  max:168 },
  matching_tolerance_pct:       { labelAr:"هامش تسامح المطابقة الثلاثية", desc:"نسبة الاختلاف المقبولة في الكميات/الأسعار",valueType:"number",unit:"%",  min:0,  max:10  },
  emergency_review_days:        { labelAr:"مدة مراجعة الطوارئ",            desc:"أيام مراجعة طلب الطوارئ بعد الاعتماد", valueType:"number", unit:"يوم",  min:7,  max:90  },
  approval_sla_hours:           { labelAr:"مهلة الموافقة الافتراضية",      desc:"ساعات قبل التصعيد التلقائي",           valueType:"number", unit:"ساعة", min:4,  max:240 },
  rfq_min_vendors:              { labelAr:"الحد الأدنى لموردي RFQ",        desc:"عدد الموردين المطلوب في كل طلب عروض",  valueType:"number", unit:"مورد", min:1,  max:10  },
  default_depreciation_method:  { labelAr:"طريقة الاستهلاك الافتراضية",   desc:"تُطبَّق على الأصول الجديدة",            valueType:"string", options:["straight_line","declining_balance"] },
  it_depreciation_rate:         { labelAr:"معدل استهلاك أجهزة IT",         desc:"نسبة الاستهلاك السنوية",               valueType:"number", unit:"%",    min:5,  max:50  },
  vehicle_depreciation_rate:    { labelAr:"معدل استهلاك المركبات",         desc:"نسبة الاستهلاك السنوية",               valueType:"number", unit:"%",    min:5,  max:40  },
  furniture_depreciation_rate:  { labelAr:"معدل استهلاك الأثاث",           desc:"نسبة الاستهلاك السنوية",               valueType:"number", unit:"%",    min:5,  max:30  },
  payroll_notify_day:           { labelAr:"يوم تذكير الرواتب",             desc:"يوم الشهر لإرسال تذكير معالجة الرواتب", valueType:"number", unit:"يوم",  min:1,  max:28  },
  budget_alert_emails:          { labelAr:"إيميلات تنبيه الميزانية",       desc:"إيميلات مفصولة بفاصلة",                valueType:"string"                         },
  approval_reminder_hours:      { labelAr:"تذكير الموافقة المعلقة",        desc:"إرسال تذكير للموافق بعد هذه الساعات",  valueType:"number", unit:"ساعة", min:1,  max:72  },
  annual_leave_days:            { labelAr:"أيام الإجازة السنوية",          desc:"عدد الأيام السنوية المستحقة",           valueType:"number", unit:"يوم",  min:14, max:60  },
  sick_leave_days:              { labelAr:"أيام الإجازة المرضية",          desc:"الحد الأقصى السنوي للإجازات المرضية",   valueType:"number", unit:"يوم",  min:7,  max:30  },
  probation_months:             { labelAr:"مدة الاختبار",                  desc:"شهور فترة الاختبار للموظف الجديد",      valueType:"number", unit:"شهر",  min:1,  max:6   },
};

export default function SettingsPanel({ organizationId, settings }: Props) {
  const [activeTab, setActiveTab] = useState("payroll");
  const [values,    setValues]    = useState<Record<string,string>>(
    Object.fromEntries(
      Object.entries(settings).flatMap(([, v]) => Object.entries(v))
    )
  );
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [isPending, start]        = useTransition();
  const [saveStatus, setSaveStatus] = useState<Record<string,"saved"|"error"|null>>({});

  function handleChange(key: string, val: string) {
    setValues(p => ({ ...p, [key]: val }));
    setDirtyKeys(p => new Set([...p, key]));
    setSaveStatus(p => ({ ...p, [key]: null }));
  }

  function saveCategory(cat: string) {
    const categoryKeys = Object.keys(settings[cat] ?? {});
    const updates = categoryKeys
      .filter(k => dirtyKeys.has(k))
      .map(k => ({ category: cat, key: k, value: values[k] ?? "" }));

    if (!updates.length) return;

    start(async () => {
      const res = await updateSettingsBatch(organizationId, updates, "current-user");
      if (res.success) {
        const newDirty = new Set(dirtyKeys);
        updates.forEach(u => newDirty.delete(u.key));
        setDirtyKeys(newDirty);
        const newStatus: Record<string,"saved"|"error"|null> = {};
        updates.forEach(u => { newStatus[u.key] = "saved"; });
        setSaveStatus(p => ({ ...p, ...newStatus }));
        setTimeout(() => setSaveStatus(p => {
          const c = { ...p };
          updates.forEach(u => { c[u.key] = null; });
          return c;
        }), 3000);
      }
    });
  }

  const activeCat = CATEGORIES.find(c => c.key === activeTab)!;
  const catSettings = settings[activeTab] ?? {};
  const dirtyInTab = Object.keys(catSettings).some(k => dirtyKeys.has(k));

  return (
    <div className="flex gap-5">
      {/* Sidebar Tabs */}
      <div className="w-48 shrink-0 space-y-1">
        {CATEGORIES.map(cat => (
          <button key={cat.key} onClick={() => setActiveTab(cat.key)}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-all text-right ${
              activeTab === cat.key
                ? "bg-[#0F1117] border border-[#2D3748] text-white"
                : "text-[#6B7280] hover:text-[#D1D5DB] hover:bg-[#0F1117]"
            }`}>
            <i className={`ti ${cat.icon} text-[15px] ${activeTab === cat.key ? cat.color : ""}`} />
            <span>{cat.labelAr}</span>
            {Object.keys(settings[cat.key] ?? {}).some(k => dirtyKeys.has(k)) && (
              <span className="mr-auto w-1.5 h-1.5 rounded-full bg-[#EF9F27] animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Settings Panel */}
      <div className="flex-1 bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        {/* Tab Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <i className={`ti ${activeCat.icon} text-[20px] ${activeCat.color}`} />
            <div>
              <h2 className="text-base font-semibold text-white">{activeCat.labelAr}</h2>
              <p className="text-xs text-[#4B5563]">{Object.keys(catSettings).length} إعداد</p>
            </div>
          </div>
          {dirtyInTab && (
            <button onClick={() => saveCategory(activeTab)} disabled={isPending}
              className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-all">
              {isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                : <i className="ti ti-device-floppy" />
              }
              حفظ التغييرات
            </button>
          )}
        </div>

        {/* Settings List */}
        <div className="divide-y divide-[#1F2937]">
          {Object.entries(catSettings).map(([key, _]) => {
            const meta    = SETTING_META[key];
            if (!meta) return null;
            const val     = values[key] ?? "";
            const isDirty = dirtyKeys.has(key);
            const status  = saveStatus[key];

            return (
              <div key={key} className={`flex items-center gap-5 px-6 py-4 transition-colors ${isDirty ? "bg-[#0D0A00]" : "hover:bg-[#161B26]"}`}>
                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#D1D5DB]">{meta.labelAr}</p>
                  <p className="text-xs text-[#4B5563] mt-0.5">{meta.desc}</p>
                </div>

                {/* Input */}
                <div className="flex items-center gap-2 shrink-0">
                  {meta.options ? (
                    <select
                      value={val}
                      onChange={e => handleChange(key, e.target.value)}
                      className="bg-[#161B26] border border-[#2D3748] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#0F6E56] min-w-[160px]"
                    >
                      {meta.options.map(o => (
                        <option key={o} value={o}>
                          {o === "straight_line" ? "قسط ثابت" :
                           o === "declining_balance" ? "قسط متناقص" : o}
                        </option>
                      ))}
                    </select>
                  ) : meta.valueType === "number" ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={val}
                        min={meta.min}
                        max={meta.max}
                        step={key.includes("rate") || key.includes("multiplier") ? "0.1" : "1"}
                        onChange={e => handleChange(key, e.target.value)}
                        className="w-24 bg-[#161B26] border border-[#2D3748] text-white text-sm text-center rounded-lg px-2 py-2 focus:outline-none focus:border-[#0F6E56] tabular-nums"
                      />
                      {meta.unit && <span className="text-xs text-[#4B5563] min-w-[28px]">{meta.unit}</span>}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={val}
                      onChange={e => handleChange(key, e.target.value)}
                      className="w-48 bg-[#161B26] border border-[#2D3748] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#0F6E56]"
                    />
                  )}

                  {/* Status indicator */}
                  <div className="w-6 flex items-center justify-center">
                    {status === "saved"  && <i className="ti ti-check text-[#1D9E75] text-[14px]" />}
                    {status === "error"  && <i className="ti ti-x text-[#E24B4A] text-[14px]" />}
                    {isDirty && !status  && <span className="w-1.5 h-1.5 rounded-full bg-[#EF9F27] animate-pulse" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {Object.keys(catSettings).length === 0 && (
          <div className="py-16 text-center">
            <i className="ti ti-settings-off text-[40px] text-[#2D3748]" />
            <p className="text-sm text-[#4B5563] mt-3">لا توجد إعدادات لهذا التصنيف</p>
          </div>
        )}
      </div>
    </div>
  );
}
