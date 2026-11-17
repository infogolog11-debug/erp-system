// src/modules/hr/components/EmployeeForm.tsx
"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEmployee } from "@/modules/hr/actions";
import type { AppLocale } from "@/lib/preferences";
import { commonCopy } from "@/lib/i18n";

type Department = { id: string; name: string; nameAr: string | null };
type Position   = { id: string; title: string; titleAr: string | null; departmentId: string };
type Currency   = { id: string; code: string };

type EmployeeFormProps = {
  departments: Department[];
  positions:   Position[];
  currencies:  Currency[];
  organizationId: string;
  userId: string;
  locale?: AppLocale;
};

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
        {label}{required && <span className="text-[#E24B4A] mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function EmployeeForm({ departments, positions, currencies, organizationId, userId, locale = "ar" }: EmployeeFormProps) {
  const router = useRouter();
  const common = commonCopy[locale];
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "", firstName: "", lastName: "", firstNameAr: "", lastNameAr: "",
    gender: "male", departmentId: "", positionId: "", managerId: "",
    hireDate: "", dateOfBirth: "", nationality: "", nationalId: "", passportNo: "",
    phone: "", email: "", address: "",
    bankName: "", bankAccount: "", bankIban: "",
    contractType: "full_time", baseSalary: "", currencyId: "", contractEndDate: "",
  });

  const t = locale === "ar"
    ? {
        identity:    "البيانات الأساسية",
        code:        "كود الوكيل",
        firstName:   "الاسم الأول",
        lastName:    "اسم العائلة",
        firstNameAr: "الاسم الأول (عربي)",
        lastNameAr:  "اسم العائلة (عربي)",
        gender:      "الجنس",
        male:        "ذكر",
        female:      "أنثى",
        department:  "القسم",
        position:    "الوظيفة",
        chooseDepartment: "اختر القسم...",
        choosePosition:   "اختر الوظيفة...",
        noPositions: "لا توجد وظائف لهذا القسم",
        manager:     "المدير المباشر",
        noManager:   "بدون مدير مباشر",
        hireDate:    "تاريخ التعيين",
        dateOfBirth: "تاريخ الميلاد",
        nationality: "الجنسية",
        nationalId:  "الرقم الوطني",
        passportNo:  "رقم جواز السفر",
        contact:     "بيانات الاتصال",
        phone:       "الهاتف",
        email:       "البريد الإلكتروني",
        address:     "العنوان",
        bank:        "البيانات البنكية",
        bankName:    "اسم البنك",
        bankAccount: "رقم الحساب",
        bankIban:    "رقم الآيبان",
        contract:    "العقد الابتدائي",
        contractHint:"اترك المبلغ فارغاً إذا كان العقد سيُسجَّل لاحقاً — بدون عقد لا يظهر الوكيل في مسير الرواتب.",
        contractType:"نوع العقد",
        baseSalary:  "الراتب الأساسي",
        currency:    "العملة",
        endDate:     "تاريخ انتهاء العقد",
        save:        "حفظ الوكيل",
        contractTypes: {
          full_time:  "دوام كامل",
          part_time:  "دوام جزئي",
          consultant: "استشاري",
          volunteer:  "متطوع",
          intern:     "متدرب",
        },
      }
    : {
        identity:    "Basic information",
        code:        "Agent code",
        firstName:   "First name",
        lastName:    "Last name",
        firstNameAr: "First name (Arabic)",
        lastNameAr:  "Last name (Arabic)",
        gender:      "Gender",
        male:        "Male",
        female:      "Female",
        department:  "Department",
        position:    "Position",
        chooseDepartment: "Select department...",
        choosePosition:   "Select position...",
        noPositions: "No positions for this department",
        manager:     "Reporting manager",
        noManager:   "No reporting manager",
        hireDate:    "Hire date",
        dateOfBirth: "Date of birth",
        nationality: "Nationality",
        nationalId:  "National ID",
        passportNo:  "Passport number",
        contact:     "Contact details",
        phone:       "Phone",
        email:       "Email",
        address:     "Address",
        bank:        "Bank details",
        bankName:    "Bank name",
        bankAccount: "Account number",
        bankIban:    "IBAN",
        contract:    "Initial contract",
        contractHint:"Leave the salary empty if the contract will be registered later — without a contract the agent will not appear in payroll.",
        contractType:"Contract type",
        baseSalary:  "Base salary",
        currency:    "Currency",
        endDate:     "Contract end date",
        save:        "Save agent",
        contractTypes: {
          full_time:  "Full time",
          part_time:  "Part time",
          consultant: "Consultant",
          volunteer:  "Volunteer",
          intern:     "Intern",
        },
      };

  const contractTypes = (Object.keys(t.contractTypes) as Array<keyof typeof t.contractTypes>)
    .map(value => ({ value, label: t.contractTypes[value] }));

  const departmentPositions = useMemo(
    () => positions.filter(p => p.departmentId === form.departmentId),
    [positions, form.departmentId],
  );

  const upd = (k: string, v: string) =>
    setForm(p => {
      // تغيير القسم يُفرِّغ الوظيفة لأن الوظائف مرتبطة بالقسم
      if (k === "departmentId") return { ...p, departmentId: v, positionId: "" };
      return { ...p, [k]: v };
    });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createEmployee({
        ...form,
        organizationId,
        gender: form.gender as "male" | "female",
        contractType: form.contractType as "full_time" | "part_time" | "consultant" | "volunteer" | "intern",
        currencyId: form.currencyId || undefined,
        baseSalary: form.baseSalary === "" ? undefined : Number(form.baseSalary),
        contractEndDate: form.contractEndDate || undefined,
      }, userId);
      if (res.success) router.push(`/hr/employees/${res.data.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">
          <i className="ti ti-alert-circle" />{error}
        </div>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{t.identity}</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t.code} required>
            <input value={form.code} onChange={e => upd("code", e.target.value)} className={inputCls} placeholder="EMP-001" required dir="ltr" />
          </Field>
          <Field label={t.firstName} required>
            <input value={form.firstName} onChange={e => upd("firstName", e.target.value)} className={inputCls} required />
          </Field>
          <Field label={t.lastName} required>
            <input value={form.lastName} onChange={e => upd("lastName", e.target.value)} className={inputCls} required />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t.firstNameAr}>
            <input value={form.firstNameAr} onChange={e => upd("firstNameAr", e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.lastNameAr}>
            <input value={form.lastNameAr} onChange={e => upd("lastNameAr", e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.gender} required>
            <select value={form.gender} onChange={e => upd("gender", e.target.value)} className={inputCls + " cursor-pointer"} required>
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t.department} required>
            <select value={form.departmentId} onChange={e => upd("departmentId", e.target.value)} className={inputCls + " cursor-pointer"} required>
              <option value="">{t.chooseDepartment}</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {locale === "ar" ? (d.nameAr || d.name) : d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.position} required>
            <select
              value={form.positionId}
              onChange={e => upd("positionId", e.target.value)}
              className={inputCls + " cursor-pointer"}
              disabled={!form.departmentId || departmentPositions.length === 0}
              required
            >
              <option value="">
                {form.departmentId && departmentPositions.length === 0 ? t.noPositions : t.choosePosition}
              </option>
              {departmentPositions.map(p => (
                <option key={p.id} value={p.id}>
                  {locale === "ar" ? (p.titleAr || p.title) : p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t.hireDate} required>
            <input type="date" value={form.hireDate} onChange={e => upd("hireDate", e.target.value)} className={inputCls} required dir="ltr" />
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label={t.dateOfBirth}>
            <input type="date" value={form.dateOfBirth} onChange={e => upd("dateOfBirth", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={t.nationality}>
            <input value={form.nationality} onChange={e => upd("nationality", e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.nationalId}>
            <input value={form.nationalId} onChange={e => upd("nationalId", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={t.passportNo}>
            <input value={form.passportNo} onChange={e => upd("passportNo", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{t.contact}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.phone}>
            <input value={form.phone} onChange={e => upd("phone", e.target.value)} className={inputCls} placeholder="+962..." dir="ltr" />
          </Field>
          <Field label={t.email}>
            <input type="email" value={form.email} onChange={e => upd("email", e.target.value)} className={inputCls} placeholder="name@org.com" dir="ltr" />
          </Field>
        </div>
        <Field label={t.address}>
          <input value={form.address} onChange={e => upd("address", e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">{t.bank}</h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label={t.bankName}>
            <input value={form.bankName} onChange={e => upd("bankName", e.target.value)} className={inputCls} />
          </Field>
          <Field label={t.bankAccount}>
            <input value={form.bankAccount} onChange={e => upd("bankAccount", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={t.bankIban}>
            <input value={form.bankIban} onChange={e => upd("bankIban", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="pb-3 border-b border-[#1F2937]">
          <h2 className="text-sm font-semibold text-white">{t.contract}</h2>
          <p className="text-xs text-[#6B7280] mt-1">{t.contractHint}</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label={t.contractType}>
            <select value={form.contractType} onChange={e => upd("contractType", e.target.value)} className={inputCls + " cursor-pointer"}>
              {contractTypes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label={t.baseSalary}>
            <input type="number" value={form.baseSalary} onChange={e => upd("baseSalary", e.target.value)} className={inputCls} placeholder="0.00" min="0" step="0.01" dir="ltr" />
          </Field>
          <Field label={t.currency}>
            <select value={form.currencyId} onChange={e => upd("currencyId", e.target.value)} className={inputCls + " cursor-pointer"}>
              <option value="">{common.select}</option>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </Field>
          <Field label={t.endDate}>
            <input type="date" value={form.contractEndDate} onChange={e => upd("contractEndDate", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] transition-colors">
          {common.cancel}
        </button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
          {isPending ? (
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <i className="ti ti-device-floppy" />
          )}
          {t.save}
        </button>
      </div>
    </form>
  );
}
