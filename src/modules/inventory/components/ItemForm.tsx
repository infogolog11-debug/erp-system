// src/modules/inventory/components/ItemForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/modules/inventory/actions";
import type { AppLocale } from "@/lib/preferences";
import { commonCopy } from "@/lib/i18n";

type ItemFormProps = {
  categories: Array<{ id: string; name: string }>;
  organizationId: string;
  userId: string;
  locale: AppLocale;
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

export default function ItemForm({ categories, organizationId, userId, locale }: ItemFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    nameAr: "",
    categoryId: "",
    itemType: "consumable",
    unit: "",
    minStock: "0",
    unitCost: "",
    description: "",
  });

  const common = commonCopy[locale];
  const t = locale === "ar"
    ? {
        title: "إضافة صنف جديد",
        code: "كود الصنف",
        name: "اسم الصنف",
        nameAr: "الاسم بالعربية",
        category: "الفئة",
        chooseCategory: "اختر الفئة...",
        itemType: "نوع الصنف",
        unit: "الوحدة",
        unitPlaceholder: "مثال: قطعة، صندوق، كغ",
        minStock: "الحد الأدنى للمخزون",
        unitCost: "تكلفة الوحدة (تقديري)",
        description: "الوصف",
        save: "حفظ الصنف",
        types: {
          consumable: "استهلاكي",
          asset: "أصل ثابت",
          service: "خدمة",
        },
      }
    : {
        title: "Add New Item",
        code: "Item Code",
        name: "Item Name",
        nameAr: "Arabic Name",
        category: "Category",
        chooseCategory: "Select Category...",
        itemType: "Item Type",
        unit: "Unit",
        unitPlaceholder: "e.g. Piece, Box, KG",
        minStock: "Minimum Stock",
        unitCost: "Unit Cost (Est.)",
        description: "Description",
        save: "Save Item",
        types: {
          consumable: "Consumable",
          asset: "Fixed Asset",
          service: "Service",
        },
      };

  const itemTypes = [
    { value: "consumable", label: t.types.consumable },
    { value: "asset", label: t.types.asset },
    { value: "service", label: t.types.service },
  ];

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await createItem({
        ...form,
        organizationId,
        minStock: Number(form.minStock),
        unitCost: form.unitCost ? Number(form.unitCost) : undefined,
        userId,
      });
      if (res.success) router.push("/inventory");
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

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.code} required>
            <input value={form.code} onChange={e => upd("code", e.target.value)} className={inputCls} placeholder="ITEM-001" required dir="ltr" />
          </Field>
          <Field label={t.category}>
            <select value={form.categoryId} onChange={e => upd("categoryId", e.target.value)} className={inputCls + " cursor-pointer"}>
              <option value="">{t.chooseCategory}</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t.name} required>
            <input value={form.name} onChange={e => upd("name", e.target.value)} className={inputCls} placeholder="Item Name" required />
          </Field>
          <Field label={t.nameAr}>
            <input value={form.nameAr} onChange={e => upd("nameAr", e.target.value)} className={inputCls} placeholder="اسم الصنف بالعربية" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label={t.itemType} required>
            <select value={form.itemType} onChange={e => upd("itemType", e.target.value)} className={inputCls + " cursor-pointer"} required>
              {itemTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </Field>
          <Field label={t.unit} required>
            <input value={form.unit} onChange={e => upd("unit", e.target.value)} className={inputCls} placeholder={t.unitPlaceholder} required />
          </Field>
          <Field label={t.minStock} required>
            <input type="number" value={form.minStock} onChange={e => upd("minStock", e.target.value)} className={inputCls} placeholder="0" min="0" dir="ltr" required />
          </Field>
        </div>

        <Field label={t.unitCost}>
          <input type="number" value={form.unitCost} onChange={e => upd("unitCost", e.target.value)} className={inputCls} placeholder="0.00" min="0" step="0.01" dir="ltr" />
        </Field>

        <Field label={t.description}>
          <textarea value={form.description} onChange={e => upd("description", e.target.value)} className={inputCls + " resize-none"} rows={3} placeholder="..." />
        </Field>
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
