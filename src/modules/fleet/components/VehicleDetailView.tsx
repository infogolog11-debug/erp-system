"use client";
import { useState, useTransition } from "react";
import {
  assignDriver, createTrip, completeTrip, createFuelLog, createMaintenanceRecord, setVehicleStatus,
} from "@/modules/fleet/actions";
import { fuelEfficiency, costPerKm, tripDistance } from "@/lib/fleet/calculations";

const inputCls = "w-full bg-[#0F1117] border border-[#2D3748] rounded-lg px-3 py-2 text-sm text-white placeholder-[#4B5563] focus:outline-none focus:border-[#0F6E56]";
const STATUS_LABEL: Record<string,string> = { active:"نشطة", maintenance:"تحت الصيانة", inactive:"غير نشطة", disposed:"مُستبعدة" };
const STATUS_STYLE: Record<string,string> = {
  active:"bg-[#001A12] text-[#1D9E75]", maintenance:"bg-[#271E0A] text-[#EF9F27]",
  inactive:"bg-[#1F2937] text-[#9CA3AF]", disposed:"bg-[#2A1215] text-[#E24B4A]",
};
const TRIP_STATUS_LABEL: Record<string,string> = { planned:"مخطَّطة", in_progress:"جارية", completed:"مكتملة", cancelled:"ملغاة" };

export default function VehicleDetailView({ vehicle, orgDrivers, orgGrants, userId, organizationId }: {
  vehicle: any; orgDrivers: any[]; orgGrants: any[]; userId: string; organizationId: string;
}) {
  const [tab, setTab] = useState<"trips"|"fuel"|"maintenance">("trips");
  const [isPending, startTransition] = useTransition();

  const totalFuelCost = vehicle.fuelLogs.reduce((s:number,f:any)=>s+Number(f.cost),0);
  const totalFuelLiters = vehicle.fuelLogs.reduce((s:number,f:any)=>s+Number(f.liters),0);
  const totalMaintCost = vehicle.maintenanceRecords.reduce((s:number,m:any)=>s+Number(m.cost),0);
  const totalKm = vehicle.trips.reduce((s:number,t:any)=>s+tripDistance(t.startOdometer,t.endOdometer),0);

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
          <p className="text-sm text-[#6B7280] mt-1">العداد الحالي: {vehicle.currentOdometer.toLocaleString()} كم</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={vehicle.assignedDriverId ?? ""} onChange={e=>onAssignDriver(e.target.value)} className={inputCls+" cursor-pointer w-auto"}>
            <option value="">بدون سائق مُعيَّن</option>
            {orgDrivers.map((d:any)=><option key={d.id} value={d.id}>{d.fullName}</option>)}
          </select>
          <select value={vehicle.vehicleStatus} onChange={e=>changeStatus(e.target.value as any)} className={inputCls+" cursor-pointer w-auto"} disabled={isPending}>
            {Object.entries(STATUS_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label:"إجمالي المسافة", value:`${totalKm.toLocaleString()} كم`, icon:"road" },
          { label:"تكلفة الوقود", value: totalFuelCost.toLocaleString(), icon:"gas-station" },
          { label:"كفاءة الوقود", value: totalKm>0 ? `${fuelEfficiency(totalFuelLiters,totalKm).toFixed(1)} ل/100كم` : "—", icon:"droplet" },
          { label:"تكلفة/كم", value: totalKm>0 ? costPerKm(totalFuelCost+totalMaintCost,totalKm).toFixed(2) : "—", icon:"calculator" },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6B7280] text-[12px] mb-1"><i className={`ti ti-${s.icon}`}/>{s.label}</div>
            <div className="text-lg font-semibold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 border-b border-[#1F2937]">
        {[["trips",`الرحلات / بوليصة الشحن (${vehicle.trips.length})`],["fuel",`سجل الوقود (${vehicle.fuelLogs.length})`],["maintenance",`الصيانة (${vehicle.maintenanceRecords.length})`]].map(([k,label]) => (
          <button key={k} onClick={()=>setTab(k as any)} className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${tab===k?"border-[#0F6E56] text-white":"border-transparent text-[#6B7280] hover:text-[#D1D5DB]"}`}>{label}</button>
        ))}
      </div>

      {tab === "trips" && <TripsTab vehicle={vehicle} orgDrivers={orgDrivers} orgGrants={orgGrants} userId={userId} organizationId={organizationId} />}
      {tab === "fuel" && <FuelTab vehicle={vehicle} userId={userId} organizationId={organizationId} />}
      {tab === "maintenance" && <MaintenanceTab vehicle={vehicle} userId={userId} organizationId={organizationId} />}
    </div>
  );
}

function TripsTab({ vehicle, orgDrivers, orgGrants, userId, organizationId }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ driverId: vehicle.assignedDriverId ?? "", grantId:"", purpose:"", origin:"", destination:"", cargoDescription:"", departureDate:"", startOdometer: String(vehicle.currentOdometer) });
  const [completingId, setCompletingId] = useState<string|null>(null);
  const [endOdometer, setEndOdometer] = useState("");

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
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>رحلة جديدة</button></div>
      {error && <p className="text-[12px] text-[#E24B4A]">{error}</p>}
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.driverId} onChange={e=>setForm(p=>({...p,driverId:e.target.value}))} className={inputCls+" cursor-pointer"} required>
              <option value="">اختر السائق...</option>
              {orgDrivers.map((d:any)=><option key={d.id} value={d.id}>{d.fullName}</option>)}
            </select>
            <select value={form.grantId} onChange={e=>setForm(p=>({...p,grantId:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="">بدون ربط بمشروع</option>
              {orgGrants.map((g:any)=><option key={g.id} value={g.id}>{g.nameAr || g.name}</option>)}
            </select>
          </div>
          <input placeholder="الغرض من الرحلة" value={form.purpose} onChange={e=>setForm(p=>({...p,purpose:e.target.value}))} className={inputCls} required/>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="نقطة الانطلاق" value={form.origin} onChange={e=>setForm(p=>({...p,origin:e.target.value}))} className={inputCls} required/>
            <input placeholder="الوجهة" value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))} className={inputCls} required/>
          </div>
          <input placeholder="وصف البضاعة/الحمولة (اختياري)" value={form.cargoDescription} onChange={e=>setForm(p=>({...p,cargoDescription:e.target.value}))} className={inputCls}/>
          <div className="grid grid-cols-2 gap-3">
            <input type="datetime-local" value={form.departureDate} onChange={e=>setForm(p=>({...p,departureDate:e.target.value}))} className={inputCls} dir="ltr" required/>
            <input type="number" placeholder="قراءة العداد عند الانطلاق" value={form.startOdometer} onChange={e=>setForm(p=>({...p,startOdometer:e.target.value}))} className={inputCls} dir="ltr" required/>
          </div>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">حفظ (بوليصة الشحن)</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{["رقم البوليصة","السائق","من - إلى","المسافة","الحالة",""].map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.trips.map((t:any) => (
              <tr key={t.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 font-mono text-xs text-[#4B5563]">{t.waybillNumber}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{t.driver?.fullName}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{t.origin} ← {t.destination}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px] tabular-nums">{tripDistance(t.startOdometer,t.endOdometer).toLocaleString()} كم</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{TRIP_STATUS_LABEL[t.tripStatus]}</td>
                <td className="px-4 py-3">
                  {t.tripStatus === "in_progress" && (
                    completingId === t.id ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" placeholder="عداد العودة" value={endOdometer} onChange={e=>setEndOdometer(e.target.value)} className={inputCls+" w-28"} dir="ltr"/>
                        <button onClick={()=>submitComplete(t.id)} className="text-[11px] text-[#0F6E56]">حفظ</button>
                      </div>
                    ) : (
                      <button onClick={()=>setCompletingId(t.id)} className="text-[11px] text-[#378ADD]">إنهاء الرحلة</button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {vehicle.trips.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">لا توجد رحلات مسجّلة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FuelTab({ vehicle, userId, organizationId }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ liters:"", cost:"", odometerAtFueling: String(vehicle.currentOdometer), station:"" });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await createFuelLog({ organizationId, vehicleId: vehicle.id, liters: Number(form.liters), cost: Number(form.cost), odometerAtFueling: Number(form.odometerAtFueling), station: form.station || undefined }, userId);
      setShowForm(false); setForm({ liters:"", cost:"", odometerAtFueling: String(vehicle.currentOdometer), station:"" });
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>تعبئة وقود</button></div>
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 grid grid-cols-4 gap-3">
          <input type="number" step="0.01" placeholder="اللترات" value={form.liters} onChange={e=>setForm(p=>({...p,liters:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input type="number" step="0.01" placeholder="التكلفة" value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input type="number" placeholder="قراءة العداد" value={form.odometerAtFueling} onChange={e=>setForm(p=>({...p,odometerAtFueling:e.target.value}))} className={inputCls} dir="ltr" required/>
          <input placeholder="المحطة" value={form.station} onChange={e=>setForm(p=>({...p,station:e.target.value}))} className={inputCls}/>
          <button type="submit" disabled={isPending} className="col-span-4 text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">حفظ</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{["التاريخ","اللترات","التكلفة","المحطة"].map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.fuelLogs.map((f:any) => (
              <tr key={f.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(f.fuelDate).toLocaleDateString("ar")}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{f.liters}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{f.cost}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{f.station ?? "—"}</td>
              </tr>
            ))}
            {vehicle.fuelLogs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">لا توجد سجلات وقود</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MaintenanceTab({ vehicle, userId, organizationId }: any) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ maintenanceType:"routine_service", cost:"", description:"", nextServiceOdometer:"", nextServiceDate:"", setUnderMaintenance:false });

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
      <div className="flex justify-end"><button onClick={()=>setShowForm(s=>!s)} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-3.5 py-2 flex items-center gap-1.5"><i className="ti ti-plus"/>سجل صيانة</button></div>
      {showForm && (
        <form onSubmit={submit} className="bg-[#0F1117] border border-[#1F2937] rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.maintenanceType} onChange={e=>setForm(p=>({...p,maintenanceType:e.target.value}))} className={inputCls+" cursor-pointer"}>
              <option value="routine_service">صيانة دورية</option><option value="repair">إصلاح</option><option value="tire_change">تغيير إطارات</option><option value="inspection">فحص</option><option value="other">أخرى</option>
            </select>
            <input type="number" step="0.01" placeholder="التكلفة" value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} className={inputCls} dir="ltr" required/>
          </div>
          <textarea placeholder="الوصف" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className={inputCls+" resize-none"} rows={2}/>
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="موعد الصيانة القادمة (عداد)" value={form.nextServiceOdometer} onChange={e=>setForm(p=>({...p,nextServiceOdometer:e.target.value}))} className={inputCls} dir="ltr"/>
            <input type="date" placeholder="موعد الصيانة القادمة (تاريخ)" value={form.nextServiceDate} onChange={e=>setForm(p=>({...p,nextServiceDate:e.target.value}))} className={inputCls} dir="ltr"/>
          </div>
          <label className="flex items-center gap-2 text-[12px] text-[#D1D5DB]">
            <input type="checkbox" checked={form.setUnderMaintenance} onChange={e=>setForm(p=>({...p,setUnderMaintenance:e.target.checked}))} />
            وضع المركبة تحت الصيانة الآن
          </label>
          <button type="submit" disabled={isPending} className="text-[13px] font-medium text-white bg-[#0F6E56] rounded-lg px-4 py-2">حفظ</button>
        </form>
      )}
      <div className="bg-[#0F1117] border border-[#1F2937] rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-[#1F2937]">{["التاريخ","النوع","التكلفة","الوصف"].map(h=><th key={h} className="text-right text-xs font-medium text-[#6B7280] px-4 py-3">{h}</th>)}</tr></thead>
          <tbody>
            {vehicle.maintenanceRecords.map((m:any) => (
              <tr key={m.id} className="border-b border-[#1F2937] last:border-none hover:bg-[#161B26]">
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{new Date(m.maintenanceDate).toLocaleDateString("ar")}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px]">{m.maintenanceType}</td>
                <td className="px-4 py-3 text-[#D1D5DB] text-[13px] tabular-nums">{m.cost}</td>
                <td className="px-4 py-3 text-[#9CA3AF] text-[13px]">{m.description ?? "—"}</td>
              </tr>
            ))}
            {vehicle.maintenanceRecords.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-[#6B7280]">لا توجد سجلات صيانة</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
