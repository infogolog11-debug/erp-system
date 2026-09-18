// src/modules/grants/components/GrantForm.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createGrant } from "@/modules/grants/actions";

interface BudgetLine { code:string; name:string; budgetCategory:string; plannedAmount:string; }
const CATEGORIES = [
  {value:"staff",label:"الموارد البشرية"},{value:"supplies",label:"المستلزمات"},
  {value:"services",label:"الخدمات"},{value:"travel",label:"السفر"},{value:"other",label:"أخرى"},
];
const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56] focus:ring-1 focus:ring-[#0F6E56] transition-all";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return(<div><label className="block text-xs font-medium text-[#9CA3AF] mb-1.5">{label}{required&&<span className="text-[#E24B4A] mr-1">*</span>}</label>{children}</div>);
}
export default function GrantForm({donors,currencies,managers,organizationId,userId}:any){
  const router=useRouter();
  const [isPending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const [lines,setLines]=useState<BudgetLine[]>([{code:"BL-001",name:"",budgetCategory:"staff",plannedAmount:""}]);
  const [form,setForm]=useState({donorId:"",currencyId:"",code:"",name:"",nameAr:"",totalAmount:"",startDate:"",endDate:"",grantManagerId:"",description:""});
  const upd=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
  const addLine=()=>setLines(p=>[...p,{code:`BL-${String(p.length+1).padStart(3,"0")}`,name:"",budgetCategory:"other",plannedAmount:""}]);
  const updLine=(i:number,k:keyof BudgetLine,v:string)=>setLines(p=>p.map((l,idx)=>idx===i?{...l,[k]:v}:l));
  const remLine=(i:number)=>setLines(p=>p.filter((_,idx)=>idx!==i));
  const totalBudget=lines.reduce((s,l)=>s+(Number(l.plannedAmount)||0),0);
  const grantTotal=Number(form.totalAmount)||0;
  const diff=grantTotal-totalBudget;
  function handleSubmit(e:React.FormEvent){
    e.preventDefault();setError("");
    startTransition(async()=>{
      const res=await createGrant({...form,organizationId,totalAmount:Number(form.totalAmount)},userId);
      if(res.success)router.push(`/grants/${res.data.id}`);
      else setError(res.error);
    });
  }
  return(
    <form onSubmit={handleSubmit} className="space-y-5">
      {error&&<div className="flex items-center gap-2 bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]"><i className="ti ti-alert-circle"/>{error}</div>}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white pb-3 border-b border-[#1F2937]">المعلومات الأساسية</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="كود المنحة" required><input value={form.code} onChange={e=>upd("code",e.target.value)} className={inputCls} placeholder="G-2025-001" required dir="ltr"/></Field>
          <Field label="المانح" required><select value={form.donorId} onChange={e=>upd("donorId",e.target.value)} className={inputCls+" cursor-pointer"} required><option value="">اختر المانح...</option>{donors.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        </div>
        <Field label="اسم المنحة" required><input value={form.name} onChange={e=>upd("name",e.target.value)} className={inputCls} placeholder="Grant Name" required/></Field>
        <Field label="الاسم بالعربية"><input value={form.nameAr} onChange={e=>upd("nameAr",e.target.value)} className={inputCls} placeholder="اسم المنحة بالعربية"/></Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="المبلغ الكلي" required><input type="number" value={form.totalAmount} onChange={e=>upd("totalAmount",e.target.value)} className={inputCls} placeholder="0.00" required min="0" step="0.01" dir="ltr"/></Field>
          <Field label="العملة" required><select value={form.currencyId} onChange={e=>upd("currencyId",e.target.value)} className={inputCls+" cursor-pointer"} required><option value="">اختر...</option>{currencies.map((c:any)=><option key={c.id} value={c.id}>{c.code}</option>)}</select></Field>
          <Field label="مدير المنحة"><select value={form.grantManagerId} onChange={e=>upd("grantManagerId",e.target.value)} className={inputCls+" cursor-pointer"}><option value="">اختياري</option>{managers.map((m:any)=><option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="تاريخ البداية" required><input type="date" value={form.startDate} onChange={e=>upd("startDate",e.target.value)} className={inputCls} required dir="ltr"/></Field>
          <Field label="تاريخ الانتهاء" required><input type="date" value={form.endDate} onChange={e=>upd("endDate",e.target.value)} className={inputCls} required dir="ltr"/></Field>
        </div>
        <Field label="الوصف"><textarea value={form.description} onChange={e=>upd("description",e.target.value)} className={inputCls+" resize-none"} rows={3} placeholder="وصف موجز..."/></Field>
      </div>
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1F2937]">
          <h2 className="text-sm font-semibold text-white">بنود الميزانية</h2>
          <div className="flex items-center gap-3">
            {grantTotal>0&&<span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${Math.abs(diff)<0.01?"bg-[#001A12] text-[#1D9E75]":diff<0?"bg-[#2A1215] text-[#E24B4A]":"bg-[#271E0A] text-[#EF9F27]"}`}>{Math.abs(diff)<0.01?"✓ متوازنة":diff>0?`متبقي: ${diff.toLocaleString()}`:`تجاوز: ${Math.abs(diff).toLocaleString()}`}</span>}
            <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-[#0F6E56] hover:text-[#1D9E75]"><i className="ti ti-plus"/>بند جديد</button>
          </div>
        </div>
        {lines.map((line,i)=>(
          <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 bg-[#161B26] rounded-xl border border-[#1F2937]">
            <div className="col-span-2"><input value={line.code} onChange={e=>updLine(i,"code",e.target.value)} className={inputCls+" text-xs"} placeholder="BL-001" dir="ltr"/></div>
            <div className="col-span-4"><input value={line.name} onChange={e=>updLine(i,"name",e.target.value)} className={inputCls+" text-xs"} placeholder="اسم البند" required/></div>
            <div className="col-span-3"><select value={line.budgetCategory} onChange={e=>updLine(i,"budgetCategory",e.target.value)} className={inputCls+" text-xs cursor-pointer"}>{CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="col-span-2"><input type="number" value={line.plannedAmount} onChange={e=>updLine(i,"plannedAmount",e.target.value)} className={inputCls+" text-xs"} placeholder="المبلغ" min="0" step="0.01" dir="ltr"/></div>
            <div className="col-span-1 flex justify-center">{lines.length>1&&<button type="button" onClick={()=>remLine(i)} className="text-[#4B5563] hover:text-[#E24B4A]"><i className="ti ti-trash text-[15px]"/></button>}</div>
          </div>
        ))}
        <div className="flex justify-between text-xs text-[#6B7280] pt-1"><span>إجمالي البنود</span><span className="font-semibold text-[#D1D5DB] tabular-nums">{totalBudget.toLocaleString("ar-SA")}</span></div>
      </div>
      <div className="flex items-center justify-end gap-3 pb-6">
        <button type="button" onClick={()=>router.back()} className="px-5 py-2.5 text-sm text-[#6B7280] hover:text-[#D1D5DB] transition-colors">إلغاء</button>
        <button type="submit" disabled={isPending} className="flex items-center gap-2 bg-[#0F6E56] hover:bg-[#1D9E75] disabled:opacity-50 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all">
          {isPending?<svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>:<i className="ti ti-device-floppy"/>}
          حفظ المنحة
        </button>
      </div>
    </form>
  );
}
