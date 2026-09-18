"use server";

import { db } from "@/db";
import { vehicles, drivers, vehicleTrips, fuelLogs, maintenanceRecords, grants } from "@/db/schema";
import { createAuditLog } from "@/core/audit/audit-trail";
import { revalidatePath } from "next/cache";
import { eq, and, count, sql } from "drizzle-orm";
import { z } from "zod";
import { textField, optionalTextField } from "@/lib/security/sanitize";
import { requirePermission, assertOrgMatches } from "@/lib/auth/guard";
import { assertOwnedByOrg } from "@/lib/auth/ownership";

type ActionResult<T=void> = { success:true; data:T } | { success:false; error:string };

const CreateVehicleSchema = z.object({
  organizationId: z.string().uuid(),
  plateNumber: textField(50, 1),
  make: optionalTextField(100),
  model: optionalTextField(100),
  year: z.number().int().optional(),
  vehicleType: z.enum(["pickup","truck","sedan","suv","motorcycle","bus","other"]),
  currentOdometer: z.number().int().nonnegative().default(0),
});

export async function createVehicle(formData: z.infer<typeof CreateVehicleSchema>, userId: string): Promise<ActionResult<{id:string; code:string}>> {
  try {
    const v = CreateVehicleSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("fleet", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const [{ cnt }] = await db.select({ cnt: count() }).from(vehicles).where(eq(vehicles.organizationId, v.data.organizationId));
    const code = `VEH-${String(Number(cnt)+1).padStart(4,"0")}`;

    const [vehicle] = await db.insert(vehicles).values({
      organizationId: v.data.organizationId, code,
      plateNumber: v.data.plateNumber, make: v.data.make, model: v.data.model, year: v.data.year,
      vehicleType: v.data.vehicleType, currentOdometer: v.data.currentOdometer,
      createdBy: userId,
    }).returning();

    await createAuditLog({ organizationId: v.data.organizationId, userId, tableName:"vehicles", recordId:vehicle.id, action:"CREATE", newValues:{ code, plateNumber: v.data.plateNumber } });
    revalidatePath("/logistics/fleet");
    return { success:true, data:{ id:vehicle.id, code } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

const CreateDriverSchema = z.object({
  organizationId: z.string().uuid(), fullName: textField(100, 1), licenseNumber: z.string().min(1),
  licenseExpiryDate: z.string().optional(), phone: z.string().optional(),
});

export async function createDriver(formData: z.infer<typeof CreateDriverSchema>, userId: string): Promise<ActionResult<{id:string}>> {
  try {
    const v = CreateDriverSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("fleet", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const [driver] = await db.insert(drivers).values({
      organizationId: v.data.organizationId, fullName: v.data.fullName, licenseNumber: v.data.licenseNumber,
      licenseExpiryDate: v.data.licenseExpiryDate ? new Date(v.data.licenseExpiryDate) : undefined,
      phone: v.data.phone, createdBy: userId,
    }).returning();
    // إصلاح (بند "audit log integrity" v35): createDriver كانت تُدرج بلا أي
    // تسجيل تدقيق إطلاقاً — فجوة صامتة كاملة، لا فشل جزئي فقط.
    await createAuditLog({ organizationId: v.data.organizationId, userId, tableName:"drivers", recordId:driver.id, action:"CREATE", newValues:{ fullName: v.data.fullName, licenseNumber: v.data.licenseNumber } });
    revalidatePath("/logistics/fleet");
    return { success:true, data:{ id:driver.id } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function assignDriver(vehicleId: string, driverId: string, organizationId: string, userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("fleet", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v34 — راجع SECURITY_NOTES.md): driverId مُرسَل من العميل
    // ولم يكن يُتحقّق من ملكيته للمنظمة قبل ربطه بالمركبة. الفحص على
    // vehicleId ضمن WHERE يمنع الكتابة على مركبة منظمة أخرى، لكنه لا يمنع
    // ربط سائق تابع لمنظمة أخرى بمركبة تابعة لمنظمتك.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(drivers, driverId, organizationId)))
      return { success:false, error:"السائق غير موجود أو لا يتبع هذه المنظمة" };

    await db.update(vehicles).set({ assignedDriverId: driverId, updatedBy:userId, updatedAt:new Date() }).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, organizationId)));
    await createAuditLog({ organizationId, userId, tableName:"vehicles", recordId:vehicleId, action:"UPDATE", newValues:{ assignedDriverId: driverId } });
    revalidatePath(`/logistics/fleet/${vehicleId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

// ─── الرحلات / بوليصة الشحن (Waybill) ─────────────────────
const CreateTripSchema = z.object({
  organizationId: z.string().uuid(), vehicleId: z.string().uuid(), driverId: z.string().uuid(),
  grantId: z.string().uuid().optional(),
  purpose: textField(300, 1), origin: textField(200, 1), destination: textField(200, 1),
  cargoDescription: optionalTextField(500), departureDate: z.string(), startOdometer: z.number().int().nonnegative(),
});

export async function createTrip(formData: z.infer<typeof CreateTripSchema>, userId: string): Promise<ActionResult<{id:string; waybillNumber:string}>> {
  try {
    const v = CreateTripSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("fleet", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const vehicle = await db.query.vehicles.findFirst({ where: eq(vehicles.id, v.data.vehicleId) });
    if (!vehicle) return { success:false, error:"المركبة غير موجودة" };
    if (vehicle.organizationId !== v.data.organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذه المركبة" };
    if (vehicle.vehicleStatus !== "active") return { success:false, error:"المركبة غير متاحة حالياً (خارج الخدمة أو تحت الصيانة)" };
    if (v.data.startOdometer < vehicle.currentOdometer)
      return { success:false, error:`قراءة العداد أقل من آخر قراءة مسجّلة (${vehicle.currentOdometer})` };

    // إصلاح IDOR (v34): driverId وgrantId مُرسَلان من العميل ويُدرَجان مباشرة
    // بسجل الرحلة دون تحقق ملكية — نفس نمط grantId بموديول procurement
    // (راجع SECURITY_NOTES.md § v34 للشرح الكامل).
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(drivers, v.data.driverId, v.data.organizationId)))
      return { success:false, error:"السائق غير موجود أو لا يتبع هذه المنظمة" };

    if (v.data.grantId) {
      if (!(await assertOwnedByOrg(grants, v.data.grantId, v.data.organizationId)))
        return { success:false, error:"المنحة غير موجودة أو لا تتبع هذه المنظمة" };
    }

    const [{ cnt }] = await db.select({ cnt: count() }).from(vehicleTrips).where(eq(vehicleTrips.organizationId, v.data.organizationId));
    const waybillNumber = `WB-${new Date().getFullYear()}-${String(Number(cnt)+1).padStart(5,"0")}`;

    const [trip] = await db.insert(vehicleTrips).values({
      organizationId: v.data.organizationId, vehicleId: v.data.vehicleId, driverId: v.data.driverId,
      grantId: v.data.grantId, waybillNumber, purpose: v.data.purpose, origin: v.data.origin, destination: v.data.destination,
      cargoDescription: v.data.cargoDescription, departureDate: new Date(v.data.departureDate),
      startOdometer: v.data.startOdometer, tripStatus: "in_progress", createdBy: userId,
    }).returning();

    await createAuditLog({ organizationId: v.data.organizationId, userId, tableName:"vehicle_trips", recordId:trip.id, action:"CREATE", newValues:{ waybillNumber } });
    revalidatePath(`/logistics/fleet/${v.data.vehicleId}`);
    return { success:true, data:{ id:trip.id, waybillNumber } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function completeTrip(tripId: string, vehicleId: string, organizationId: string, endOdometer: number, userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("fleet", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    const trip = await db.query.vehicleTrips.findFirst({ where: eq(vehicleTrips.id, tripId) });
    if (!trip) return { success:false, error:"الرحلة غير موجودة" };
    if (trip.organizationId !== organizationId) return { success:false, error:"غير مصرَّح بالوصول لهذا السجل" };
    if (endOdometer < trip.startOdometer) return { success:false, error:"قراءة العداد النهائية أقل من قراءة الانطلاق" };

    await db.update(vehicleTrips)
      .set({ endOdometer, returnDate:new Date(), tripStatus:"completed", updatedBy:userId, updatedAt:new Date() })
      .where(and(eq(vehicleTrips.id, tripId), eq(vehicleTrips.organizationId, organizationId)));

    await db.update(vehicles).set({ currentOdometer: endOdometer, updatedBy:userId, updatedAt:new Date() }).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, organizationId)));

    await createAuditLog({ organizationId, userId, tableName:"vehicle_trips", recordId:tripId, action:"UPDATE", newValues:{ tripStatus:"completed", endOdometer } });
    revalidatePath(`/logistics/fleet/${vehicleId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

// ─── سجلات الوقود ─────────────────────
const CreateFuelLogSchema = z.object({
  organizationId: z.string().uuid(), vehicleId: z.string().uuid(),
  liters: z.number().positive(), cost: z.number().positive(), odometerAtFueling: z.number().int().nonnegative(), station: optionalTextField(150),
});

export async function createFuelLog(formData: z.infer<typeof CreateFuelLogSchema>, userId: string): Promise<ActionResult<{id:string}>> {
  try {
    const v = CreateFuelLogSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("fleet", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v34): كانت هذه الدالة تُدرج سجل وقود بـvehicleId مُرسَل من
    // العميل دون أي تحقق من ملكيته — مستخدم من منظمة A كان يقدر يُدرج سجل
    // وقود (وتكلفة مرتبطة به) على مركبة تابعة لمنظمة B.
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(vehicles, v.data.vehicleId, v.data.organizationId)))
      return { success:false, error:"المركبة غير موجودة أو لا تتبع هذه المنظمة" };

    const [log] = await db.insert(fuelLogs).values({
      organizationId: v.data.organizationId, vehicleId: v.data.vehicleId, liters: String(v.data.liters),
      cost: String(v.data.cost), odometerAtFueling: v.data.odometerAtFueling, station: v.data.station, createdBy: userId,
    }).returning();

    // إصلاح (audit log integrity v35): سجل وقود يحمل تكلفة فعلية (cost) كان
    // يُدرج بلا أي تسجيل تدقيق — فجوة أثر مالي كاملة، لا فشل جزئي.
    await createAuditLog({ organizationId: v.data.organizationId, userId, tableName:"fuel_logs", recordId:log.id, action:"CREATE", newValues:{ vehicleId: v.data.vehicleId, cost: v.data.cost, liters: v.data.liters } });
    revalidatePath(`/logistics/fleet/${v.data.vehicleId}`);
    return { success:true, data:{ id:log.id } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

// ─── سجلات الصيانة ─────────────────────
const CreateMaintenanceSchema = z.object({
  organizationId: z.string().uuid(), vehicleId: z.string().uuid(),
  maintenanceType: z.enum(["routine_service","repair","tire_change","inspection","other"]),
  cost: z.number().nonnegative(), description: optionalTextField(1000),
  odometerAtService: z.number().int().nonnegative().optional(),
  nextServiceOdometer: z.number().int().nonnegative().optional(),
  nextServiceDate: z.string().optional(),
  setVehicleUnderMaintenance: z.boolean().default(false),
});

export async function createMaintenanceRecord(formData: z.infer<typeof CreateMaintenanceSchema>, userId: string): Promise<ActionResult<{id:string}>> {
  try {
    const v = CreateMaintenanceSchema.safeParse(formData);
    if (!v.success) return { success:false, error:v.error.errors[0].message };

    const session = await requirePermission("fleet", "create");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(v.data.organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    // إصلاح IDOR (v34): نفس ثغرة createFuelLog تماماً — vehicleId لم يكن
    // يُتحقق من ملكيته قبل إدراج سجل الصيانة (والتحديث اللاحق على vehicles
    // كان آمناً بفضل WHERE organizationId، لكن الإدراج بجدول maintenanceRecords
    // نفسه لم يكن محمياً).
    // موحَّد الآن عبر assertOwnedByOrg (v38) — راجع SECURITY_NOTES.md
    if (!(await assertOwnedByOrg(vehicles, v.data.vehicleId, v.data.organizationId)))
      return { success:false, error:"المركبة غير موجودة أو لا تتبع هذه المنظمة" };

    const [record] = await db.insert(maintenanceRecords).values({
      organizationId: v.data.organizationId, vehicleId: v.data.vehicleId, maintenanceType: v.data.maintenanceType,
      cost: String(v.data.cost), description: v.data.description, odometerAtService: v.data.odometerAtService,
      nextServiceOdometer: v.data.nextServiceOdometer,
      nextServiceDate: v.data.nextServiceDate ? new Date(v.data.nextServiceDate) : undefined,
      createdBy: userId,
    }).returning();

    await db.update(vehicles).set({
      nextServiceOdometer: v.data.nextServiceOdometer,
      nextServiceDate: v.data.nextServiceDate ? new Date(v.data.nextServiceDate) : undefined,
      ...(v.data.setVehicleUnderMaintenance ? { vehicleStatus: "maintenance" as const } : {}),
      updatedBy: userId, updatedAt: new Date(),
    }).where(and(eq(vehicles.id, v.data.vehicleId), eq(vehicles.organizationId, v.data.organizationId)));

    // إصلاح (audit log integrity v35): سجل صيانة يحمل تكلفة فعلية (cost) كان
    // يُدرج بلا أي تسجيل تدقيق.
    await createAuditLog({ organizationId: v.data.organizationId, userId, tableName:"maintenance_records", recordId:record.id, action:"CREATE", newValues:{ vehicleId: v.data.vehicleId, cost: v.data.cost, maintenanceType: v.data.maintenanceType } });
    revalidatePath(`/logistics/fleet/${v.data.vehicleId}`);
    return { success:true, data:{ id:record.id } };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}

export async function setVehicleStatus(vehicleId: string, organizationId: string, status: "active"|"maintenance"|"inactive"|"disposed", userId: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("fleet", "edit");
    if (!session.ok) return { success:false, error:session.error };
    if (!assertOrgMatches(organizationId, session)) return { success:false, error:"غير مصرَّح بالوصول لهذه المنظمة" };

    await db.update(vehicles).set({ vehicleStatus: status, updatedBy:userId, updatedAt:new Date() }).where(and(eq(vehicles.id, vehicleId), eq(vehicles.organizationId, organizationId)));
    await createAuditLog({ organizationId, userId, tableName:"vehicles", recordId:vehicleId, action:"UPDATE", newValues:{ vehicleStatus: status } });
    revalidatePath(`/logistics/fleet/${vehicleId}`);
    return { success:true, data:undefined };
  } catch (e) { console.error(e); return { success:false, error:"حدث خطأ غير متوقع" }; }
}
