// src/modules/accounting/components/JournalEntryForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJournalEntry } from "@/modules/accounting/actions";
import type { AppLocale } from "@/lib/preferences";
import { commonCopy, getLocaleTag } from "@/lib/i18n";

type JournalEntryFormProps = {
  periods: Array<{ id: string; name: string }>;
  accounts: Array<{ id: string; name: string; code: string }>;
  currencies: Array<{ id: string; code: string }>;
  grants: Array<{ id: string; name: string }>;
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

export default function JournalEntryForm({ periods, accounts, currencies, grants, organizationId, userId, locale }: JournalEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fiscalPeriodId: periods[0]?.id || "",
    currencyId: currencies.find(c => c.code === "USD")?.id || currencies[0]?.id || "",
    description: "",
    reference: "",
    grantId: "",
  });
  const [lines, setLines] = useState([
    { accountId: "", debitAmount: "0", creditAmount: "0", description: "" },
    { accountId: "", debitAmount: "0", creditAmount: "0", description: "" },
  ]);

  const localeTag = getLocaleTag(locale);
  const common = commonCopy[locale];
  const t = locale === "ar"
    ? {
        title: "قيد محاسبي جديد",
        period: "الفترة المالية",
        currency: "العملة",
        description: "الوصف العام",
        reference: "المرجع",
        grant: "المنحة (اختياري)",
        chooseGrant: "بدون منحة...",
        lines: "سطور القيد",
        account: "الحساب",
        debit: "مدين",
        credit: "دائن",
        lineDesc: "وصف السطر",
        addLine: "إضافة سطر",
        total: "الإجمالي",
        balanced: "متوازن",
        notBalanced: "غير متوازن",
        save: "حفظ القيد",
      }
    : {
        title: "New Journal Entry",
        period: "Fiscal Period",
        currency: "Currency",
        description: "General Description",
        reference: "Reference",
        grant: "Grant (Optional)",
        chooseGrant: "No grant...",
        lines: "Entry Lines",
        account: "Account",
        debit: "Debit",
        credit: "Credit",
        lineDesc: "Line Description",
        addLine: "Add Line",
        total: "Total",
        balanced: "Balanced",
        notBalanced: "Not Balanced",
        save: "Save Entry",
      };

  const upd = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));
  const updLine = (i: number, k: string, v: string) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  const addLine = () => setLines(p => [...p, { accountId: "", debitAmount: "0", creditAmount: "0", description: "" }]);
  const remLine = (i: number) => setLines(p => p.filter((_, idx) => idx !== i));

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBalanced) {
      setError(t.notBalanced);
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await createJournalEntry({
        ...form,
        organizationId,
        entryType: "manual",
        userId,
        lines: lines.map(l => ({
          accountId: l.accountId,
          debitAmount: Number(l.debitAmount),
          creditAmount: Number(l.creditAmount),
          description: l.description || undefined,
        })),
      });
      if (res.success) router.push("/accounting");
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
          <Field label={t.period} required>
            <select value={form.fiscalPeriodId} onChange={e => upd("fiscalPeriodId", e.target.value)} className={inputCls} required>
              {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label={t.currency} required>
            <select value={form.currencyId} onChange={e => upd("currencyId", e.target.value)} className={inputCls} required>
              {currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </Field>
        </div>

        <Field label={t.description} required>
          <input value={form.description} onChange={e => upd("description", e.target.value)} className={inputCls} required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t.reference}>
            <input value={form.reference} onChange={e => upd("reference", e.target.value)} className={inputCls} dir="ltr" />
          </Field>
          <Field label={t.grant}>
            <select value={form.grantId} onChange={e => upd("grantId", e.target.value)} className={inputCls}>
              <option value="">{t.chooseGrant}</option>
              {grants.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#1F2937] pb-3">
          <h2 className="text-sm font-semibold text-white">{t.lines}</h2>
          <button type="button" onClick={addLine} className="text-xs text-[#0F6E56] hover:text-[#1D9E75] flex items-center gap-1">
            <i className="ti ti-plus" />{t.addLine}
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start bg-[#161B26] p-3 rounded-xl border border-[#1F2937]">
              <div className="col-span-4">
                <select value={line.accountId} onChange={e => updLine(i, "accountId", e.target.value)} className={inputCls + " text-xs"} required>
                  <option value="">{t.account}...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <input type="number" value={line.debitAmount} onChange={e => updLine(i, "debitAmount", e.target.value)} className={inputCls + " text-xs"} placeholder={t.debit} min="0" step="0.01" dir="ltr" />
              </div>
              <div className="col-span-2">
                <input type="number" value={line.creditAmount} onChange={e => updLine(i, "creditAmount", e.target.value)} className={inputCls + " text-xs"} placeholder={t.credit} min="0" step="0.01" dir="ltr" />
              </div>
              <div className="col-span-3">
                <input value={line.description} onChange={e => updLine(i, "description", e.target.value)} className={inputCls + " text-xs"} placeholder={t.lineDesc} />
              </div>
              <div className="col-span-1 flex justify-center pt-2">
                {lines.length > 2 && (
                  <button type="button" onClick={() => remLine(i)} className="text-[#4B5563] hover:text-[#E24B4A]">
                    <i className="ti ti-trash" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#1F2937]">
          <div className="flex gap-6 text-xs font-medium">
            <div className="space-x-2">
              <span className="text-[#6B7280]">{t.debit}:</span>
              <span className="text-white tabular-nums">{totalDebit.toLocaleString(localeTag)}</span>
            </div>
            <div className="space-x-2">
              <span className="text-[#6B7280]">{t.credit}:</span>
              <span className="text-white tabular-nums">{totalCredit.toLocaleString(localeTag)}</span>
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${isBalanced ? "bg-[#001A12] text-[#1D9E75]" : "bg-[#2A1215] text-[#E24B4A]"}`}>
            {isBalanced ? t.balanced : t.notBalanced}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] transition-colors">
          {common.cancel}
        </button>
        <button type="submit" disabled={isPending || !isBalanced} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
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
