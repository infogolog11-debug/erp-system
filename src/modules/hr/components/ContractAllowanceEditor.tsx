// نموذج صغير لتخصيص بدل السكن/المواصلات لعقد موظف محدد
// (بدل الاعتماد فقط على القيمة الافتراضية بالكتالوج لكل الموظفين)
"use client";
import { useState, useTransition } from "react";
import { updateContractAllowances } from "@/modules/hr/actions";

export default function ContractAllowanceEditor({
  organizationId, contractId, userId,
  housingAllowance, transportAllowance,
  housingDefault, transportDefault,
}: {
  organizationId: string;
  contractId: string;
  userId: string;
  housingAllowance: string | null;
  transportAllowance: string | null;
  housingDefault: number;
  transportDefault: number;
}) {
  const [editing, setEditing]     = useState(false);
  const [housing, setHousing]     = useState(housingAllowance ?? "");
  const [transport, setTransport] = useState(transportAllowance ?? "");
  const [error, setError]         = useState("");
  const [saved, setSaved]         = useState(false);
  const [isPending, start]        = useTransition();

  const isOverridden = housingAllowance != null || transportAllowance != null;

  function save() {
    setError(""); setSaved(false);
    const h = housing.trim() === "" ? null : Number(housing);
    const t = transport.trim() === "" ? null : Number(transport);
    if ((h !== null && (isNaN(h) || h < 0)) || (t !== null && (isNaN(t) || t < 0))) {
      setError("القيمة يجب أن تكون رقم موجب");
      return;
    }
    start(async () => {
      const res = await updateContractAllowances(organizationId, contractId, userId, {
        housingAllowance: h, transportAllowance: t,
      });
      if (!res.success) { setError(res.error); return; }
      setSaved(true);
      setEditing(false);
    });
  }

  function resetToCatalog() {
    setHousing(""); setTransport(""); setError("");
    start(async () => {
      const res = await updateContractAllowances(organizationId, contractId, userId, {
        housingAllowance: null, transportAllowance: null,
      });
      if (!res.success) { setError(res.error); return; }
      setSaved(true);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="flex justify-between items-center pt-2 border-t border-[#1F2937]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#4B5563]">بدلات السكن والمواصلات</span>
          {isOverridden && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0F6E56]/15 text-[#1D9E75] border border-[#0F6E56]/30">
              مخصّصة
            </span>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-[#1D9E75] hover:underline"
        >
          {isOverridden ? "تعديل" : "تخصيص"}
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-[#1F2937] space-y-2">
      <p className="text-[10px] text-[#4B5563]">
        اترك الحقل فارغاً للرجوع للقيمة الافتراضية بالكتالوج (سكن: {housingDefault} / مواصلات: {transportDefault})
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-[#4B5563] block mb-1">بدل السكن</label>
          <input
            type="number" min="0" value={housing}
            onChange={e => setHousing(e.target.value)}
            placeholder={String(housingDefault)}
            className="w-full bg-[#161B26] border border-[#1F2937] rounded-lg px-2 py-1.5 text-xs text-white"
          />
        </div>
        <div>
          <label className="text-[10px] text-[#4B5563] block mb-1">بدل المواصلات</label>
          <input
            type="number" min="0" value={transport}
            onChange={e => setTransport(e.target.value)}
            placeholder={String(transportDefault)}
            className="w-full bg-[#161B26] border border-[#1F2937] rounded-lg px-2 py-1.5 text-xs text-white"
          />
        </div>
      </div>
      {error && <p className="text-[11px] text-[#E24B4A]">{error}</p>}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={save} disabled={isPending}
          className="text-[11px] px-2.5 py-1 rounded-lg bg-[#0F6E56] text-white disabled:opacity-50"
        >
          {isPending ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        {isOverridden && (
          <button
            onClick={resetToCatalog} disabled={isPending}
            className="text-[11px] px-2.5 py-1 rounded-lg border border-[#1F2937] text-[#9CA3AF]"
          >
            رجوع للافتراضي
          </button>
        )}
        <button
          onClick={() => { setEditing(false); setError(""); setHousing(housingAllowance ?? ""); setTransport(transportAllowance ?? ""); }}
          className="text-[11px] px-2.5 py-1 text-[#6B7280]"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
