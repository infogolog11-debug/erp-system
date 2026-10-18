"use client";
import { useState, useTransition } from "react";
import {
  assignDriver, createTrip, completeTrip, createFuelLog, createMaintenanceRecord, setVehicleStatus,
} from "@/modules/fleet/actions";
import { fuelEfficiency, costPerKm, tripDistance } from "@/lib/fleet/calculations";
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
const TRIP_STATUS_LABEL: Record<AppLocale, Record<string,string>> = {
  ar: { planned:"مخطَّطة", in_progress:"جارية", completed:"مكتملة", cancelled:"ملغاة" },
  en: { planned:"Planned", in_progress:"In progress", completed:"Completed", cancelled:"Cancelled" },
};

export default function VehicleDetailView({ vehicle, orgDrivers, orgGrants, userId, organizationId, locale = "ar" }: {
  vehicle: any; orgDrivers: any[]; orgGrants: any[]; userId: string; organizationId: string; locale?: AppLocale;
}) {
  const [tab, setTab] = useState<"trips"|"fuel"|"maintenance">("trips");
  const [isPending, startTransition] = useTransition();

  const isAr = locale === "ar";
  const statusLabel = STATUS_LABEL[locale] ?? STATUS_LABEL.ar;
  const t = isAr ? {
    currentOdometer:(n:string)=>`العداد الحالي: ${n} كم`,
    noDriver:"بدون سائق مُعيَّن",
    totalDistance:"إجمالي المسافة", fuelCost:"تكلفة الوقود", fuelEfficiencyLabel:"كفاءة الوقود", costPerKm:"تكلفة/كم",
    km:(n:string)=>`${n} كم`, lPer100km:(n:string)=>`${n} ل/100كم`,
    tripsTab:(n:number)=>`الرحلات / بوليصة الشحن (${n})`, fuelTab:(n:number)=>`سجل الوقود (${n})`, maintenanceTab:(n:number)=>`الصيانة (${n})`,
  } : {
    currentOdometer:(n:string)=>`Current odometer: ${n} km`,
    noDriver:"No assigned driver",
    totalDistance:"Total distance", fuelCost:"Fuel cost", fuelEfficiencyLabel:"Fuel efficiency", costPerKm:"Cost / km",
    km:(n:string)=>`${n} km`, lPer100km:(n:string)=>`${n} L/100km`,
    tripsTab:(n:number)=>`Trips / waybills (${n})`, fuelTab:(n:number)=>`Fuel log (${n})`, maintenanceTab:(n:number)=>`Maintenance (${n})`,
  };

  const totalFuelCost = vehicle.fuelLogs.reduce((s:number,f:any)=>s+Number(f.cost),0);
  const totalFuelLiters = vehicle.fuelLogs.reduce((s:number,f:any)=>s+Number(f.liters),0);
  const totalMaintCost = vehicle.maintenanceRecords.reduce((s:number,m:any)=>s+Number(m.cost),0);
  const totalKm = vehicle.trips.reduce((s:number,trip:any)=>s+tripDistance(trip.startOdometer,trip.endOdometer),0);

  function changeStatus(status: "active"|"maintenance"|"inactive"|"disposed") {
    startTransition(async () => { await setVehicleStatus(vehicle.id, organizationId, status, userId); });
  }
  function onAssignDriver(driverId: string) {
    startTransition(async () => { await assignDriver(vehicle.id, driverId, organizationId, userId); });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono text-[#4B5563] bg-[#161B26] px-2 py-0.5 rounded-md">{vehicle.code}</span>
          <h1 className="text-xl font-semibold text-white mt-1.5">{vehicle.plateNumber} — {vehicle.make} {vehicle.model}</h1>
          <p className="text-sm text-[#6B7280] mt-1">{t.currentOdometer(vehicle.currentOdometer.toLocaleString())}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={vehicle.assignedDriverId ?? ""} onChange={e=>onAssignDriver(e.target.value)} className={inputCls+" cursor-pointer w-auto"}>
            <option value="">{t.noDriver}</option>
            {orgDrivers.map((d:any)=><option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
          <select value={vehicle.vehicleStatus} onChange={e=>changeStatus(e.target.value as any)} className={inputCls+" cursor-pointer w-auto"} disabled={isPending}>
            {Object.entries(statusLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label:t.totalDistance, value:t.km(totalKm.toLocaleString()), icon:"road" },
          { label:t.fuelCost, value: totalFuelCost.toLocaleString(), icon:"gas-station" },
          { label:t.fuelEfficiencyLabel, value: totalKm>0 ? t.lPer100km(fuelEfficiency(totalFuelLiters,totalKm).toFixed(1)) : "—", icon:"droplet" },
          { label:t.costPerKm, value: totalKm>0 ? costPerKm(totalFuelCost+totalMaintCost,totalKm).toFixed(2) : "—", icon:"calculator" },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6B7280] text-[12px] mb-1"><i className={`ti ti-${s.icon}`}/>{s.label}</div>
            <div className="text-lg font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-[#1F2937]">
        {[["trips",t.tripsTab(vehicle.trips.length)],["fuel",t.fuelTab(vehicle.fuelLogs.length)],["maintenance",t.maintenanceTab(vehicle.maintenanceRecords.length)]].map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab===k?"border-[#0F6E56] text-white":"border-transparent text-[#6B7280] hover:text-[#D1D5DB]"}`}>{label}</button>
        ))}
      </div>

      {tab === "trips" && <TripsTab vehicle={vehicle} orgDrivers={orgDrivers} orgGrants={orgGrants} userId={userId} organizationId={organizationId} locale={locale} />}
      {tab === "fuel" && <FuelTab vehicle={vehicle} userId={userId} organizationId={organizationId} locale={locale} />}
      {tab === "maintenance" && <MaintenanceTab vehicle={vehicle} userId={userId} organizationId={organizationId} locale={locale} />}
    </div>
  );
}

function TripsTab({ vehicle, orgDrivers, orgGrants, userId, organizationId, locale = "ar" }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ driverId: vehicle.assignedDriverId ?? "", grantId:"", purpose:"", origin:"", destination:"", cargoDescription:"", departureDate:"", startOdometer: String(vehicle.currentOdometer) });
  const [completingId, setCompletingId] = useState<string|null>(null);
  const [endOdometer, setEndOdometer] = useState("");

  const isAr = locale === "ar";
  const tripStatusLabel = TRIP_STATUS_LABEL[locale as AppLocale] ?? TRIP_STATUS_LABEL.ar;
  const t = isAr ? {
    newTrip:"رحلة جديدة", chooseDriver:"اختر السائق...", noProjectLink:"بدون ربط بمشروع",
    purposePlaceholder:"الغرض من الرحلة", originPlaceholder:"نقطة الانطلاق", destinationPlaceholder:"الوجهة",
    cargoPlaceholder:"وصف البضاعة/الحمولة (اختياري)", startOdometerPlaceholder:"قراءة العداد عند الانطلاق",
    saveWaybill:"حفظ (بوليصة الشحن)", endOdometerPlaceholder:"عداد العودة", save:"حفظ", endTrip:"إنهاء الرحلة",
    headers:["رقم البوليصة","السائق","من - إلى","المسافة","الحالة",""],
    km:(n:string)=>`${n} كم`,
    empty:"لا توجد رحلات مسجّلة",
  } : {
    newTrip:"New trip", chooseDriver:"Choose driver...", noProjectLink:"No project link",
    purposePlaceholder:"Trip purpose", originPlaceholder:"Origin", destinationPlaceholder:"Destination",
    cargoPlaceholder:"Cargo description (optional)", startOdometerPlaceholder:"Start odometer reading",
    saveWaybill:"Save (waybill)", endOdometerPlaceholder:"End odometer", save:"Save", endTrip:"End trip",
    headers:["Waybill no.","Driver","From - To","Distance","Status",""],
    km:(n:string)=>`${n} km`,
    empty:"No trips recorded",
  };

  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const res = await createTrip({
        organizationId, vehicleId: vehicle.id, driverId: form.driverId, grantId: form.grantId || undefined,
        purpose: form.purpose, origin: form.origin, destination: form.destination, cargoDescription: form.cargoDescription || undefined,
        departureDate: form.departureDate, startOdometer: Number(form.startOdometer),
      }, userId);
      if (res.success) setShowForm(false); else setError(res.error);
    });
  }
  function submitComplete(tripId: string) {
    startTransition(async () => {
      const res = await completeTrip(tripId, vehicle.id, organizationId, Number(endOdometer), userId);
      if (res.success) { setCompletingId(null); setEndOdometer(""); }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>{t.newTrip}</button></div>
      {error && <p className="text-[12px] text-[#E24B4A]">{error}</p>}
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.driverId} onChange={e=>setForm(p=>({...p,driverId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
              <option value="">{t.chooseDriver}</option>
              {orgDrivers.map((d:any)=><option key={d.id} value={d.id}>{d.fullName}</option>)}
            </select>
            <select value={form.grantId} onChange={e=>setForm(p=>({...p,grantId:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="">{t.noProjectLink}</option>
              {orgGrants.map((g:any)=><option key={g.id} value={g.id}>{isAr ? (g.nameAr || g.name) : (g.name || g.nameAr)}</option>)}
            </select>
          </div>
          <input placeholder={t.purposePlaceholder} value={form.purpose} onChange={e=>setForm(p=>({...p,purpose:e.target.value}))} className={inputCls} required/>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder={t.originPlaceholder} value={form.origin} onChange={e=>setForm(p=>({...p,origin:e.target.value}))} className={inputCls} required/>
            <input placeholder={t.destinationPlaceholder} value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))} className={inputCls} required/>
          </div>
          <input placeholder={t.cargoPlaceholder} value={form.cargoDescription} onChange={e=>setForm(p=>({...p,cargoDescription:e.target.value}))} className={inputCls}/>
          <div className="grid grid-cols-2 gap-3">
            <input type="datetime-local" value={form.departureDate} onChange={e=>setForm(p=>({...p,departureDate:e.target.value}))} className={inputCls} dir="ltr" required/>
            <input type="number" placeholder={t.startOdometerPlaceholder} value={form.startOdometer} onChange={e=>setForm(p=>({...p,startOdometer:e.target.value}))} className={inputCls} dir="ltr" required/>
          </div>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.saveWaybill}</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{t.headers.map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.trips.map((trip:any) => (
              <tr key={trip.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{trip.waybillNumber}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{trip.driver?.fullName}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{trip.origin} ← {trip.destination}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px] tabular-nums">{t.km(tripDistance(trip.startOdometer,trip.endOdometer).toLocaleString())}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{tripStatusLabel[trip.tripStatus]}</td>
                <td className="px-4 py-3">
                  {trip.tripStatus === "in_progress" && (
                    completingId === trip.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" placeholder={t.endOdometerPlaceholder} value={endOdometer} onChange={e=>setEndOdometer(e.target.value)} className={inputCls+" w-28"} dir="ltr"/>
                        <button onClick={()=>submitComplete(trip.id)} className="text-[11px] text-[#0F6E56]">{t.save}</button>
                      </div>
                    ) : (
                      <button onClick={()=>setCompletingId(trip.id)} className="text-[11px] text-[#378ADD]">{t.endTrip}</button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {vehicle.trips.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FuelTab({ vehicle, userId, organizationId, locale = "ar" }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ liters:"", cost:"", odometerAtFueling: String(vehicle.currentOdometer), station:"" });

  const isAr = locale === "ar";
  const dateTag = isAr ? "ar" : "en-US";
  const t = isAr ? {
    addFuel:"تعبئة وقود", litersPlaceholder:"اللترات", costPlaceholder:"التكلفة", odometerPlaceholder:"قراءة العداد", stationPlaceholder:"المحطة",
    save:"حفظ", headers:["التاريخ","اللترات","التكلفة","المحطة"], empty:"لا توجد سجلات وقود",
  } : {
    addFuel:"Add fuel", litersPlaceholder:"Liters", costPlaceholder:"Cost", odometerPlaceholder:"Odometer reading", stationPlaceholder:"Station",
    save:"Save", headers:["Date","Liters","Cost","Station"], empty:"No fuel logs",
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createFuelLog({ organizationId, vehicleId: vehicle.id, liters: Number(form.liters), cost: Number(form.cost), odometerAtFueling: Number(form.odometerAtFueling), station: form.station || undefined }, userId);
      setShowForm(false); setForm({ liters:"", cost:"", odometerAtFueling: String(vehicle.currentOdometer), station:"" });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>{t.addFuel}</button></div>
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 grid grid-cols-4 gap-3">
          <input type="number" step="0.01" placeholder={t.litersPlaceholder} value={form.liters} onChange={e=>setForm(p=>({...p,liters:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input type="number" step="0.01" placeholder={t.costPlaceholder} value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input type="number" placeholder={t.odometerPlaceholder} value={form.odometerAtFueling} onChange={e=>setForm(p=>({...p,odometerAtFueling:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input placeholder={t.stationPlaceholder} value={form.station} onChange={e=>setForm(p=>({...p,station:e.target.value}))} className={inputCls}/>
          <button type="submit" disabled={isPending} className="col-span-4 text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.save}</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{t.headers.map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.fuelLogs.map((f:any) => (
              <tr key={f.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(f.fuelDate).toLocaleDateString(dateTag)}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{f.liters}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{f.cost}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{f.station ?? "—"}</td>
              </tr>
            ))}
            {vehicle.fuelLogs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceTab({ vehicle, userId, organizationId, locale = "ar" }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ maintenanceType:"routine_service", cost:"", description:"", nextServiceOdometer:"", nextServiceDate:"", setUnderMaintenance:false });

  const isAr = locale === "ar";
  const dateTag = isAr ? "ar" : "en-US";
  const t = isAr ? {
    addRecord:"سجل صيانة",
    typeRoutine:"صيانة دورية", typeRepair:"إصلاح", typeTire:"تغيير إطارات", typeInspection:"فحص", typeOther:"أخرى",
    costPlaceholder:"التكلفة", descriptionPlaceholder:"الوصف", nextOdometerPlaceholder:"موعد الصيانة القادمة (عداد)",
    nextDatePlaceholder:"موعد الصيانة القادمة (تاريخ)", setUnderMaintenance:"وضع المركبة تحت الصيانة الآن", save:"حفظ",
    headers:["التاريخ","النوع","التكلفة","الوصف"], empty:"لا توجد سجلات صيانة",
  } : {
    addRecord:"Add maintenance record",
    typeRoutine:"Routine service", typeRepair:"Repair", typeTire:"Tire change", typeInspection:"Inspection", typeOther:"Other",
    costPlaceholder:"Cost", descriptionPlaceholder:"Description", nextOdometerPlaceholder:"Next service due (odometer)",
    nextDatePlaceholder:"Next service due (date)", setUnderMaintenance:"Set vehicle under maintenance now", save:"Save",
    headers:["Date","Type","Cost","Description"], empty:"No maintenance records",
  };

  const maintenanceTypeLabel: Record<AppLocale, Record<string,string>> = {
    ar: { routine_service:"صيانة دورية", repair:"إصلاح", tire_change:"تغيير إطارات", inspection:"فحص", other:"أخرى" },
    en: { routine_service:"Routine service", repair:"Repair", tire_change:"Tire change", inspection:"Inspection", other:"Other" },
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createMaintenanceRecord({
        organizationId, vehicleId: vehicle.id, maintenanceType: form.maintenanceType as any, cost: Number(form.cost),
        description: form.description || undefined,
        nextServiceOdometer: form.nextServiceOdometer ? Number(form.nextServiceOdometer) : undefined,
        nextServiceDate: form.nextServiceDate || undefined,
        setVehicleUnderMaintenance: form.setUnderMaintenance,
      }, userId);
      setShowForm(false); setForm({ maintenanceType:"routine_service", cost:"", description:"", nextServiceOdometer:"", nextServiceDate:"", setUnderMaintenance:false });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>{t.addRecord}</button></div>
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.maintenanceType} onChange={e=>setForm(p=>({...p,maintenanceType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="routine_service">{t.typeRoutine}</option><option value="repair">{t.typeRepair}</option><option value="tire_change">{t.typeTire}</option><option value="inspection">{t.typeInspection}</option><option value="other">{t.typeOther}</option>
            </select>
            <input type="number" step="0.01" placeholder={t.costPlaceholder} value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} className={inputCls} dir="ltr" required/>
          </div>
          <textarea placeholder={t.descriptionPlaceholder} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className={inputCls+" resize-none"} rows={2}/>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder={t.nextOdometerPlaceholder} value={form.nextServiceOdometer} onChange={e=>setForm(p=>({...p,nextServiceOdometer:e.target.value}))} className={inputCls} dir="ltr"/>
            <input type="date" placeholder={t.nextDatePlaceholder} value={form.nextServiceDate} onChange={e=>setForm(p=>({...p,nextServiceDate:e.target.value}))} className={inputCls} dir="ltr"/>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#D1D5DB]">
            <input type="checkbox" checked={form.setUnderMaintenance} onChange={e=>setForm(p=>({...p,setUnderMaintenance:e.target.checked}))} />
            {t.setUnderMaintenance}
          </label>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">{t.save}</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{t.headers.map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.maintenanceRecords.map((m:any) => (
              <tr key={m.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(m.maintenanceDate).toLocaleDateString(dateTag)}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{maintenanceTypeLabel[locale as AppLocale][m.maintenanceType] || m.maintenanceType}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{m.cost}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{m.description ?? "—"}</td>
              </tr>
            ))}
            {vehicle.maintenanceRecords.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">{t.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
