"use client";
import { useState, useTransition } from "react";
import { addPayrollAdjustment, deletePayrollAdjustment } from "@/modules/hr/actions";
import { useRouter } from "next/navigation";
import type { AppLocale } from "@/lib/preferences";

type Employee = { id:string; fullName:string };
type Adjustment = {
  id:string; employeeId:string; adjustmentType:"bonus"|"deduction";
  amount:string; description:string; consumedInRunId:string|null;
};

export default function PayrollAdjustmentsPanel({
  orgId, userId, month, year, employees, adjustments, locale = "ar",
}: {
  orgId:string; userId:string; month:number; year:number;
  employees: Employee[]; adjustments: Adjustment[]; locale?: AppLocale;
}) {
  const [show, setShow]     = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [type, setType]     = useState<"bonus"|"deduction">("bonus");
  const [amount, setAmount] = useState("");
  const [desc, setDesc]     = useState("");
  const [error, setError]   = useState("");
  const [isPending, start]  = useTransition();
  const router = useRouter();

  const isAr = locale === "ar";
  const t = isAr ? {
    title:"بونص وخصومات هذه الدورة",
    subtitle:`تُطبَّق تلقائياً عند معالجة كشف ${month}/${year} — كل بند لازم سبب موثّق`,
    add:"إضافة",
    employee:"الموظف",
    type:"النوع",
    bonus:"بونص",
    deduction:"خصم",
    amountLabel:"المبلغ (USD)",
    reason:"السبب",
    reasonPlaceholder:"مثال: مكافأة أداء Q1، أو سلفة شهر سابق",
    saving:"جارٍ الحفظ...",
    save:"حفظ",
    empty:"لا يوجد بونص/خصم مُدخَل لهذه الدورة بعد",
    errEmployee:"اختر موظف",
    errAmount:"المبلغ يجب أن يكون أكبر من صفر",
    errReason:"لازم توضيح السبب (3 أحرف على الأقل)",
  } : {
    title:"Bonuses & deductions for this cycle",
    subtitle:`Applied automatically when processing the ${month}/${year} run — each item requires a documented reason`,
    add:"Add",
    employee:"Employee",
    type:"Type",
    bonus:"Bonus",
    deduction:"Deduction",
    amountLabel:"Amount (USD)",
    reason:"Reason",
    reasonPlaceholder:"e.g. Q1 performance bonus, or a previous month advance",
    saving:"Saving...",
    save:"Save",
    empty:"No bonuses/deductions entered for this cycle yet",
    errEmployee:"Select an employee",
    errAmount:"Amount must be greater than zero",
    errReason:"Provide a reason (at least 3 characters)",
  };

  const empName = (id:string) => employees.find(e => e.id === id)?.fullName ?? id;

  function submit() {
    setError("");
    const amt = Number(amount);
    if (!employeeId) { setError(t.errEmployee); return; }
    if (!amt || amt <= 0) { setError(t.errAmount); return; }
    if (desc.trim().length < 3) { setError(t.errReason); return; }
    start(async () => {
      const res = await addPayrollAdjustment(orgId, userId, {
        employeeId, month, year, adjustmentType: type, amount: amt, description: desc.trim(),
      });
      if (!res.success) { setError(res.error); return; }
      setAmount(""); setDesc(""); setShow(false);
      router.refresh();
    });
  }

  function remove(id:string) {
    start(async () => {
      await deletePayrollAdjustment(orgId, userId, id);
      router.refresh();
    });
  }

  return (
    <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">{t.title}</h2>
          <p className="text-[11px] text-[#4B5563] mt-0.5">{t.subtitle}</p>
        </div>
        <button onClick={() => setShow(v => !v)}
          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#161B26] border border-[#2D3748] text-[#9CA3AF] hover:text-white">
          <i className="ti ti-plus" /> {t.add}
        </button>
      </div>

      {show && (
        <div className="bg-[#161B26] border border-[#2D3748] rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6B7280] block mb-1">{t.employee}</label>
              <select value={employeeId} onChange={e => setEmployeeId(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white">
                {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6B7280] block mb-1">{t.type}</label>
              <select value={type} onChange={e => setType(e.target.value as any)}
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white">
                <option value="bonus">{t.bonus}</option>
                <option value="deduction">{t.deduction}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[#6B7280] block mb-1">{t.amountLabel}</label>
              <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-[#6B7280] block mb-1">{t.reason}</label>
              <input value={desc} onChange={e => setDesc(e.target.value)}
                placeholder={t.reasonPlaceholder}
                className="w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-2 py-1.5 text-xs text-white" />
            </div>
          </div>
          {error && <p className="text-[11px] text-[#E24B4A]">{error}</p>}
          <button onClick={submit} disabled={isPending}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#0F6E56] text-white disabled:opacity-50">
            {isPending ? t.saving : t.save}
          </button>
        </div>
      )}

      {adjustments.length === 0 ? (
        <p className="text-[11px] text-[#2D3748]">{t.empty}</p>
      ) : (
        <div className="space-y-1.5">
          {adjustments.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-[#161B26] rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${a.adjustmentType === "bonus" ? "bg-[#0F6E56]/15 text-[#1D9E75]" : "bg-[#3D0A0A]/40 text-[#E24B4A]"}`}>
                  {a.adjustmentType === "bonus" ? t.bonus : t.deduction}
                </span>
                <span className="text-white">{empName(a.employeeId)}</span>
                <span className="text-[#4B5563]">— {a.description}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium tabular-nums text-[#D1D5DB]">{a.amount} USD</span>
                {!a.consumedInRunId && (
                  <button onClick={() => remove(a.id)} disabled={isPending}
                    className="text-[#4B5563] hover:text-[#E24B4A]">
                    <i className="ti ti-trash text-[13px]" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
