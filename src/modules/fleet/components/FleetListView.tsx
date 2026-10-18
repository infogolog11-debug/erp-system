"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { createVehicle, createDriver } from "@/modules/fleet/actions";
import { isMaintenanceDue, isLicenseExpiringSoon } from "@/lib/fleet/calculations";
import type { AppLocale } from "@/lib/preferences";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { active:"نشطة", maintenance:"تحت الصيانة", inactive:"غير نشطة", disposed:"مُستبعدة" },
  en: { active:"Active", maintenance:"Under maintenance", inactive:"Inactive", disposed:"Disposed" },
};
const STATUS_STYLE: Record<string,string> = {
  active:"bg-[#001A12] text-[#1D9E75]", maintenance:"bg-[#271E0A] text-[#EF9F27]",
  inactive:"bg-[#1F2937] text-[#9CA3AF]", disposed:"bg-[#2A1215] text-[#E24B4A]",
};
const TYPE_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { pickup:"بيك أب", truck:"شاحنة", sedan:"سيدان", suv:"دفع رباعي", motorcycle:"دراجة نارية", bus:"حافلة", other:"أخرى" },
  en: { pickup:"Pickup", truck:"Truck", sedan:"Sedan", suv:"SUV", motorcycle:"Motorcycle", bus:"Bus", other:"Other" },
};

export default function FleetListView({ vehicles, drivers, organizationId, userId, alertVehicles, alertDrivers, locale = "ar" }: {
  vehicles:any[]; drivers:any[]; organizationId:string; userId:string;
  // إصلاح v32: لو الصفحة الأم تجلب vehicles/drivers مُقسَّمة لصفحات (limit
  // per page)، حساب التنبيهات من نفس المصفوفة يصير خاطئاً (يفوّت مركبات/
  // سائقين بصفحات أخرى). alertVehicles/alertDrivers اختياريان — لو
  // انمرّرا (من استعلام منفصل غير مُقسَّم بالسيرفر) نستخدمهما للتنبيهات،
  // وإلا نرجع للسلوك القديم (حساب من vehicles/drivers نفسها، صحيح فقط
  // طالما هذي المصفوفة تمثّل كل السجلات).
  alertVehicles?: any[]; alertDrivers?: any[];
  locale?: AppLocale;
}) {
  const [isPending, startTransition] = useTransition();
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [error, setError] = useState("");
  const [vForm, setVForm] = useState({ plateNumber:"", make:"", model:"", year:"", vehicleType:"pickup", currentOdometer:"0" });
  const [dForm, setDForm] = useState({ fullName:"", licenseNumber:"", licenseExpiryDate:"", phone:"" });

  const isAr = locale === "ar";
  const statusLabel = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const typeLabel = TYPE_LABEL[locale] ?? TYPE_LABEL.ar;
  const t = isAr ? {
    alertsTitle:"تنبيهات تستدعي المتابعة",
    vehicleService:(plate:string, code:string)=>`— المركبة ${plate} (${code}) تستحق صيانة`,
    driverLicense:(name:string)=>`— رخصة السائق ${name} تنتهي قريباً`,
    newVehicle:"مركبة جديدة", newDriver:"سائق جديد",
    platePlaceholder:"رقم اللوحة", odometerPlaceholder:"قراءة العداد الحالية",
    makePlaceholder:"الشركة المصنّعة", modelPlaceholder:"الطراز", yearPlaceholder:"سنة الصنع",
    saveVehicle:"حفظ المركبة", driverNamePlaceholder:"اسم السائق", licensePlaceholder:"رقم الرخصة",
    licenseExpiryPlaceholder:"تاريخ انتهاء الرخصة", phonePlaceholder:"الهاتف", saveDriver:"حفظ السائق",
    headers:["الكود","اللوحة","النوع","السائق","العداد","الحالة"],
    km:(n:string)=>locale === "ar" ? `${n} كم` : `${n} km`,
    empty:"لا توجد مركبات مسجّلة",
  } : {
    alertsTitle:"Alerts requiring follow-up",
    vehicleService:(plate:string, code:string)=>`— Vehicle ${plate} (${code}) is due for maintenance`,
    driverLicense:(name:string)=>`— Driver ${name}'s license expires soon`,
    newVehicle:"New vehicle", newDriver:"New driver",
    platePlaceholder:"Plate number", odometerPlaceholder:"Current odometer reading",
    makePlaceholder:"Manufacturer", modelPlaceholder:"Model", yearPlaceholder:"Year of manufacture",
    saveVehicle:"Save vehicle", driverNamePlaceholder:"Driver name", licensePlaceholder:"License number",
    licenseExpiryPlaceholder:"License expiry date", phonePlaceholder:"Phone", saveDriver:"Save driver",
    headers:["Code","Plate","Type","Driver","Odometer","Status"],
    km:(n:string)=>`${n} km`,
    empty:"No vehicles recorded",
  };

  function submitVehicle(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createVehicle({
        organizationId, plateNumber: vForm.plateNumber, make: vForm.make || undefined, model: vForm.model || undefined,
        year: vForm.year ? Number(vForm.year) : undefined, vehicleType: vForm.vehicleType as any, currentOdometer: Number(vForm.currentOdometer) || 0,
      }, userId);
      if (res.success) { setShowVehicleForm(false); setVForm({ plateNumber:"", make:"", model:"", year:"", vehicleType:"pickup", currentOdometer:"0" }); }
      else setError(res.error);
    });
  }
  function submitDriver(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createDriver({ organizationId, fullName: dForm.fullName, licenseNumber: dForm.licenseNumber, licenseExpiryDate: dForm.licenseExpiryDate || undefined, phone: dForm.phone || undefined }, userId);
      if (res.success) { setShowDriverForm(false); setDForm({ fullName:"", licenseNumber:"", licenseExpiryDate:"", phone:"" }); }
      else setError(res.error);
    });
  }

  const alerts = (alertVehicles ?? vehicles).filter(v => isMaintenanceDue(v.currentOdometer, v.nextServiceOdometer, v.nextServiceDate ? new Date(v.nextServiceDate) : null));
  const licenseAlerts = (alertDrivers ?? drivers).filter(d => isLicenseExpiringSoon(d.licenseExpiryDate ? new Date(d.licenseExpiryDate) : null));

  return (
    <div className="space-y-4">
      {(alerts.length > 0 || licenseAlerts.length > 0) && (
        <div className="bg-[#271E0A] border border-[#4A3510] rounded-xl p-4 space-y-1.5">
          <p className="text-[13px] font-medium text-[#EF9F27] flex items-center gap-1.5"><i className="ti ti-alert-triangle"/>{t.alertsTitle}</p>
          {alerts.map(v => <p key={v.id} className="text-[12px] text-[#D1D5DB]">{t.vehicleService(v.plateNumber, v.code)}</p>)}
          {licenseAlerts.map(d => <p key={d.id} className="text-[12px] text-[#D1D5DB]">{t.driverLicense(d.fullName)}</p>)}
        </div>
      )}

      {error && <div className="bg-[#2A1215] border border-[#4A1C20] rounded-xl px-4 py-3 text-sm text-[#E24B4A]">{error}</div>}

      <div className="flex gap-2">
        <button onClick={()=>setShowVehicleForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] hover:bg-[#0D5C48] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>{t.newVehicle}</button>
        <button onClick={()=>setShowDriverForm(s=>!s)} className="text-[13px] font-medium text-[#D1D5DB] bg-[#111827] border border-[#1F2937] hover:border-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>{t.newDriver}</button>
      </div>

      {showVehicleForm && (
        <form onSubmit={submitVehicle} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 grid grid-cols-3 gap-3">
          <input placeholder={t.platePlaceholder} value={vForm.plateNumber} onChange={e=>setVForm(p=>({...p,plateNumber:e.target.value}))} className={inputCls} required/>
          <select value={vForm.vehicleType} onChange={e=>setVForm(p=>({...p,vehicleType:e.target.value}))} className={inputCls+" cursor-pointer"}>
            {Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
          <input type="number" placeholder={t.odometerPlaceholder} value={vForm.currentOdometer} onChange={e=>setVForm(p=>({...p,currentOdometer:e.target.value}))} className={inputCls} dir="ltr"/>
          <input placeholder={t.makePlaceholder} value={vForm.make} onChange={e=>setVForm(p=>({...p,make:e.target.value}))} className={inputCls}/>
          <input placeholder={t.modelPlaceholder} value={vForm.model} onChange={e=>setVForm(p=>({...p,model:e.target.value}))} className={inputCls}/>
          <input type="number" placeholder={t.yearPlaceholder} value={vForm.year} onChange={e=>setVForm(p=>({...p,year:e.target.value}))} className={inputCls} dir="ltr"/>
          <button type="submit" disabled={isPending} className="col-span-3 text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.saveVehicle}</button>
        </form>
      )}
      {showDriverForm && (
        <form onSubmit={submitDriver} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 grid grid-cols-2 gap-3">
          <input placeholder={t.driverNamePlaceholder} value={dForm.fullName} onChange={e=>setDForm(p=>({...p,fullName:e.target.value}))} className={inputCls} required/>
          <input placeholder={t.licensePlaceholder} value={dForm.licenseNumber} onChange={e=>setDForm(p=>({...p,licenseNumber:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input type="date" placeholder={t.licenseExpiryPlaceholder} value={dForm.licenseExpiryDate} onChange={e=>setDForm(p=>({...p,licenseExpiryDate:e.target.value}))} className={inputCls} dir="ltr"/>
          <input placeholder={t.phonePlaceholder} value={dForm.phone} onChange={e=>setDForm(p=>({...p,phone:e.target.value}))} className={inputCls} dir="ltr"/>
          <button type="submit" disabled={isPending} className="col-span-2 text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.saveDriver}</button>
        </form>
      )}

      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">
            {t.headers.map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}
          </tr></thead>
          <tbody>
            {vehicles.map((v,i) => (
              <tr key={v.id} className={`border-b border-[#1F2937] hover:bg-[#161B26] ${i===vehicles.length-1?"border-none":""}`}>
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{v.code}</td>
                <td className="px-4 py-3"><Link href={`/logistics/fleet/${v.id}`} className="text-[#D1D5DB] hover:text-white">{v.plateNumber}</Link></td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{typeLabel[v.vehicleType]}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{v.assignedDriver?.fullName ?? "—"}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px] tabular-nums">{t.km(v.currentOdometer.toLocaleString())}</td>
                <td className="px-4 py-3"><span className={`text-[11px] font-medium px-2 py-1 rounded-full ${STATUS_STYLE[v.vehicleStatus]}`}>{statusLabel[v.vehicleStatus]}</span></td>
              </tr>
            ))}
            {vehicles.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
