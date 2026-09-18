"use client";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type Beneficiary = {
  id:string; code:string; firstName:string; lastName:string; fullNameAr:string|null;
  latitude:string; longitude:string; vulnerabilityCategory:string; verificationStatus:string;
};
type Warehouse = { id:string; code:string; name:string; nameAr:string|null; latitude:string; longitude:string };

const VULN_COLOR: Record<string,string> = {
  none:"#378ADD", elderly:"#EF9F27", disability:"#E24B4A", chronic_illness:"#E24B4A",
  female_headed_household:"#EF9F27", child_headed_household:"#E24B4A",
  unaccompanied_minor:"#E24B4A", pregnant_lactating:"#EF9F27", other:"#9CA3AF",
};

export default function GISMapView({ beneficiaries, warehouses }: { beneficiaries: Beneficiary[]; warehouses: Warehouse[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [layerFilter, setLayerFilter] = useState<"all"|"beneficiaries"|"warehouses">("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapRef.current || leafletMapRef.current) return;

      // مركز افتراضي على أول نقطة متاحة، أو مركز عام إن لم توجد بيانات
      const firstPoint = beneficiaries[0] ?? warehouses[0];
      const center: [number, number] = firstPoint
        ? [Number((firstPoint as any).latitude), Number((firstPoint as any).longitude)]
        : [33.5138, 36.2765];

      const map = L.map(mapRef.current, { zoomControl: true }).setView(center, firstPoint ? 9 : 6);
      leafletMapRef.current = map;

      // بلاطات OpenStreetMap — مجانية للاستخدام المعقول بدون مفتاح API
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const markers: any[] = [];

      if (layerFilter !== "warehouses") {
        for (const b of beneficiaries) {
          const color = VULN_COLOR[b.vulnerabilityCategory] ?? "#378ADD";
          const marker = L.circleMarker([Number(b.latitude), Number(b.longitude)], {
            radius: 6, color, fillColor: color, fillOpacity: 0.8, weight: 1,
          }).addTo(map);
          marker.bindPopup(`<b>${b.fullNameAr || `${b.firstName} ${b.lastName}`}</b><br/>${b.code}`);
          markers.push(marker);
        }
      }

      if (layerFilter !== "beneficiaries") {
        for (const w of warehouses) {
          const marker = L.marker([Number(w.latitude), Number(w.longitude)]).addTo(map);
          marker.bindPopup(`<b>🏬 ${w.nameAr || w.name}</b><br/>${w.code}`);
          markers.push(marker);
        }
      }

      if (markers.length > 1) {
        const group = L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
      }
    })();

    return () => {
      cancelled = true;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [beneficiaries, warehouses, layerFilter]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {[["all","الكل"],["beneficiaries","المستفيدون"],["warehouses","المستودعات"]].map(([k,label]) => (
          <button
            key={k} onClick={()=>setLayerFilter(k as any)}
            className={`text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${layerFilter===k?"bg-[#0F6E56] text-white":"bg-[#111827] text-[#9CA3AF] border border-[#1F2937]"}`}
          >{label}</button>
        ))}
      </div>
      <div ref={mapRef} className="w-full h-[560px] rounded-2xl border border-[#1F2937] overflow-hidden bg-[#111827]" />
      {beneficiaries.length === 0 && warehouses.length === 0 && (
        <p className="text-[12px] text-[#6B7280] text-center">
          لا توجد سجلات تحتوي على إحداثيات جغرافية بعد — يمكن إضافتها عند تسجيل مستفيد جديد أو من إعدادات المستودع
        </p>
      )}
    </div>
  );
}
