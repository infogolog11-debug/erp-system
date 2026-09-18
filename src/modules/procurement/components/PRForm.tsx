"use client";
import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter }                  from "next/navigation";
import { createPurchaseRequest }      from "@/modules/procurement/actions";
import { getRequiredApprovers }       from "@/lib/approval/matrix";
import { checkBudgetWithWarning }     from "@/lib/budget/warning";
import BudgetWarningBar               from "@/modules/grants/components/BudgetWarningBar";

interface PRItem { itemDescription:string; unit:string; quantity:string; estimatedUnitPrice:string; specifications:string }
const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";
function F({ label, required, children }: { label:string; required?:boolean; children:React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">
        {label}{required && <span className="text-[#E24B4A] mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

type ApprovalLevel = { level:number; levelName:string; ruleId:string; slaHours:number };
type BudgetCheck   = { canProceed:boolean; utilizationPct:number; remainingAmount:number; plannedAmount:number; spentAmount:number; committedAmount:number; warningLevel:string; message:string };

type GrantOption = {
  id: string; name: string; code: string; status: string;
  budgetLines?: Array<{ id:string; name:string; nameAr?:string|null; plannedAmount:string|number; spentAmount:string|number; warningThreshold?:number|null; blockThreshold?:number|null }>;
};
type CurrencyOption = { id:string; code:string };

export default function PRForm({ grants, currencies, organizationId, userId }: {
  grants: GrantOption[]; currencies: CurrencyOption[]; organizationId:string; userId:string;
}) {
  const router = useRouter();
  const [isPending, start]      = useTransition();
  const [error,     setError]   = useState("");
  const [items, setItems]       = useState<PRItem[]>([{ itemDescription:"", unit:"", quantity:"", estimatedUnitPrice:"", specifications:"" }]);
  const [form,  setForm]        = useState<{title:string;grantId:string;budgetLineId:string;priority:"low"|"medium"|"high"|"urgent";requiredDate:string;currencyId:string;justification:string}>({ title:"", grantId:"", budgetLineId:"", priority:"medium", requiredDate:"", currencyId:"", justification:"" });
  const [isEmergency, setEmergency] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");

  // Layer 1 previews
  const [approvalLevels, setApprovalLevels] = useState<ApprovalLevel[]>([]);
  const [budgetCheck,    setBudgetCheck]    = useState<BudgetCheck | null>(null);
  const [checkingBudget, setCheckingBudget] = useState(false);

  const upd     = (k:string, v:string) => setForm(p => ({ ...p, [k]:v }));
  const updItem = (i:number, k:keyof PRItem, v:string) => setItems(p => p.map((it,idx) => idx===i ? {...it,[k]:v} : it));
  const addItem = () => setItems(p => [...p, { itemDescription:"", unit:"", quantity:"", estimatedUnitPrice:"", specifications:"" }]);
  const remItem = (i:number) => setItems(p => p.filter((_,idx) => idx!==i));

  const total = items.reduce((s,it) => s + (Number(it.quantity)||0)*(Number(it.estimatedUnitPrice)||0), 0);
  const selGrant = grants.find((g:any) => g.id === form.grantId);
  const selBudgetLine = selGrant?.budgetLines?.find((l:any) => l.id === form.budgetLineId);

  // جلب مستويات الموافقة عند تغيير المبلغ الإجمالي
  const fetchApprovers = useCallback(async () => {
    if (total <= 0) { setApprovalLevels([]); return; }
    const res = await getRequiredApprovers(organizationId, "procurement", total);
    if (res.success) setApprovalLevels(res.data.levels.map(l => ({
      level:     l.level,
      levelName: l.levelName,
      ruleId:    l.ruleId,
      slaHours:  l.slaHours,
    })));
    else setApprovalLevels([]);
  }, [total, organizationId]);

  useEffect(() => {
    const t = setTimeout(fetchApprovers, 600);
    return () => clearTimeout(t);
  }, [fetchApprovers]);

  // فحص الميزانية عند تغيير البند أو المبلغ
  const checkBudget = useCallback(async () => {
    if (!form.budgetLineId || total <= 0) { setBudgetCheck(null); return; }
    setCheckingBudget(true);
    const res = await checkBudgetWithWarning(form.budgetLineId, total, organizationId, userId);
    if (res.success) setBudgetCheck(res.data);
    setCheckingBudget(false);
  }, [form.budgetLineId, total, organizationId, userId]);

  useEffect(() => {
    const t = setTimeout(checkBudget, 800);
    return () => clearTimeout(t);
  }, [checkBudget]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if (isEmergency && !emergencyReason.trim()) { setError("يجب ذكر سبب الطوارئ"); return; }
    if (budgetCheck && !budgetCheck.canProceed && !isEmergency) {
      setError("الميزانية غير كافية — فعّل مسار الطوارئ إذا كان ضرورياً"); return;
    }
    start(async () => {
      const res = await createPurchaseRequest({
        ...form, organizationId, requestedBy: userId,
        estimatedTotal: total || undefined,
        isEmergency,
        emergencyReason: isEmergency ? emergencyReason : undefined,
        items: items.map(it => ({ ...it, quantity:Number(it.quantity), estimatedUnitPrice:Number(it.estimatedUnitPrice)||undefined })),
      }, userId);
      if (res.success) router.push(`/procurement/requests/${res.data.id}`);
      else setError(res.error);
    });
  }

  const warnColor: Record<string,string> = {
    ok:"text-[#1D9E75]", warning:"text-[#EF9F27]", critical:"text-[#E07020]", blocked:"text-[#E24B4A]"
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">
          <i className="ti ti-alert-circle" />{error}
        </div>
      )}

      {/* تفاصيل الطلب */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">تفاصيل الطلب</h2>
        <F label="عنوان الطلب" required>
          <input value={form.title} onChange={e=>upd("title",e.target.value)} className={inputCls} placeholder="ما الذي تحتاج شراءه؟" required />
        </F>
        <div className="grid grid-cols-2 gap-4">
          <F label="المنحة الممولة">
            <select value={form.grantId} onChange={e=>{ upd("grantId",e.target.value); upd("budgetLineId",""); }} className={inputCls+" cursor-pointer"}>
              <option value="">بدون منحة</option>
              {grants.map((g:any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </F>
          {(selGrant?.budgetLines?.length ?? 0) > 0 && (
            <F label="بند الميزانية">
              <select value={form.budgetLineId} onChange={e=>upd("budgetLineId",e.target.value)} className={inputCls+" cursor-pointer"}>
                <option value="">اختر البند...</option>
                {selGrant?.budgetLines?.map((l:any) => (
                  <option key={l.id} value={l.id}>
                    {l.nameAr ?? l.name} — متبقي: {Number(l.plannedAmount - l.spentAmount).toLocaleString()}
                  </option>
                ))}
              </select>
            </F>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <F label="الأولوية">
            <select value={form.priority} onChange={e=>upd("priority",e.target.value)} className={inputCls+" cursor-pointer"}>
              {[{v:"low",l:"منخفضة"},{v:"medium",l:"متوسطة"},{v:"high",l:"عالية"},{v:"urgent",l:"عاجل"}].map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </F>
          <F label="تاريخ الحاجة"><input type="date" value={form.requiredDate} onChange={e=>upd("requiredDate",e.target.value)} className={inputCls} dir="ltr" /></F>
          <F label="العملة">
            <select value={form.currencyId} onChange={e=>upd("currencyId",e.target.value)} className={inputCls+" cursor-pointer"}>
              <option value="">اختر...</option>
              {currencies.map((c:any) => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </F>
        </div>
        <F label="المبرر">
          <textarea value={form.justification} onChange={e=>upd("justification",e.target.value)} className={inputCls+" resize-none"} rows={2} placeholder="لماذا هذا الطلب ضروري؟" />
        </F>
      </div>

      {/* الأصناف */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
          <h2 className="text-sm font-semibold text-white">الأصناف المطلوبة</h2>
          <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-[#0F6E56] hover:text-[#1D9E75]">
            <i className="ti ti-plus" />صنف جديد
          </button>
        </div>
        {items.map((it,i) => (
          <div key={i} className="p-3 bg-[#161B26] rounded-xl border border-[#1F2937] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#6B7280]">الصنف {i+1}</span>
              {items.length > 1 && (
                <button type="button" onClick={() => remItem(i)} className="text-[#4B5563] hover:text-[#E24B4A]">
                  <i className="ti ti-trash text-[14px]" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="وصف الصنف" required><input value={it.itemDescription} onChange={e=>updItem(i,"itemDescription",e.target.value)} className={inputCls+" text-xs"} placeholder="ما هو الصنف؟" required /></F>
              <F label="الوحدة" required><input value={it.unit} onChange={e=>updItem(i,"unit",e.target.value)} className={inputCls+" text-xs"} placeholder="قطعة / كيلو / لتر..." required /></F>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <F label="الكمية" required><input type="number" value={it.quantity} onChange={e=>updItem(i,"quantity",e.target.value)} className={inputCls+" text-xs"} min="0" required dir="ltr" /></F>
              <F label="السعر التقديري"><input type="number" value={it.estimatedUnitPrice} onChange={e=>updItem(i,"estimatedUnitPrice",e.target.value)} className={inputCls+" text-xs"} min="0" step="0.01" dir="ltr" /></F>
              <F label="الإجمالي">
                <div className={inputCls+" text-xs text-[#1D9E75] font-semibold tabular-nums"}>
                  {((Number(it.quantity)||0)*(Number(it.estimatedUnitPrice)||0)).toLocaleString()}
                </div>
              </F>
            </div>
          </div>
        ))}
        <div className="flex justify-between items-center text-xs text-[#6B7280] pt-2 border-t border-[#1F2937]">
          <span>الإجمالي التقديري</span>
          <span className="font-bold text-lg text-[#EF9F27] tabular-nums">{total.toLocaleString()} USD</span>
        </div>
      </div>

      {/* ── طبقة 1: تحذير الميزانية الفوري ── */}
      {form.budgetLineId && selBudgetLine && (
        <div className="space-y-2">
          {checkingBudget ? (
            <div className="flex items-center gap-2 text-xs text-[#4B5563]">
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              جارٍ فحص الميزانية...
            </div>
          ) : budgetCheck && (
            <>
              <BudgetWarningBar
                lineName={selBudgetLine.nameAr ?? selBudgetLine.name}
                plannedAmount={budgetCheck.plannedAmount}
                spentAmount={budgetCheck.spentAmount}
                committedAmount={budgetCheck.committedAmount}
                warningThreshold={selBudgetLine.warningThreshold ?? 80}
                blockThreshold={selBudgetLine.blockThreshold ?? 100}
              />
              {budgetCheck.message && (
                <p className={`text-xs flex items-center gap-1 ${warnColor[budgetCheck.warningLevel]}`}>
                  <i className="ti ti-info-circle" />{budgetCheck.message}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── طبقة 1: معاينة مستويات الموافقة ── */}
      {approvalLevels.length > 0 && (
        <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ti ti-shield-check text-[#0F6E56]" />
            مراحل الموافقة المطلوبة لهذا الطلب
          </h2>
          <div className="space-y-2">
            {approvalLevels.map((l, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-[#161B26] rounded-xl border border-[#1F2937]">
                <span className="w-6 h-6 flex items-center justify-center bg-[#0F6E56]/20 text-[#1D9E75] text-xs font-bold rounded-md shrink-0">
                  {l.level}
                </span>
                <span className="text-sm text-[#D1D5DB] flex-1">{l.levelName}</span>
                <span className="text-[10px] text-[#4B5563]">SLA: {l.slaHours}س</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#4B5563] flex items-center gap-1">
            <i className="ti ti-info-circle" />
            ستُرسل إشعارات تلقائية لكل موافق عند وصول الطلب لمرحلته
          </p>
        </div>
      )}

      {/* ── طبقة 1: مسار الطوارئ ── */}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <i className="ti ti-alert-triangle text-[#EF9F27]" />مسار الشراء الطارئ
          </h2>
          <button type="button" onClick={() => setEmergency(!isEmergency)}
            className={`relative w-11 h-6 rounded-full transition-all ${isEmergency ? "bg-[#EF9F27]" : "bg-[#1F2937]"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isEmergency ? "right-0.5" : "left-0.5"}`} />
          </button>
        </div>
        {isEmergency && (
          <div className="space-y-2">
            <div className="bg-[#1A1400] border border-[#3D2E00] rounded-xl p-3 text-xs text-[#EF9F27]">
              تفعيل مسار الطوارئ يتجاوز إجراءات المناقصة ويكتفي بموافقتين فقط.
              يُلزم بمراجعة الطلب خلال 30 يوماً من الاعتماد.
            </div>
            <textarea value={emergencyReason} onChange={e => setEmergencyReason(e.target.value)}
              placeholder="سبب الطوارئ — مثال: كارثة طبيعية، نقص حاد في مواد إغاثة..."
              rows={2}
              className={inputCls+" resize-none border-[#3D2E00] focus:border-[#EF9F27]"} />
          </div>
        )}
      </div>

      {/* أزرار الإرسال */}
      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB]">
          إلغاء
        </button>
        <button type="submit" disabled={isPending || (!!budgetCheck && !budgetCheck.canProceed && !isEmergency)}
          className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
          {isPending
            ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
            : <i className="ti ti-device-floppy" />
          }
          {isEmergency ? "حفظ كطلب طارئ" : "حفظ الطلب"}
        </button>
      </div>
    </form>
  );
}
