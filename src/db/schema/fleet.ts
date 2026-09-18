import {
  pgTable,text,boolean,uuid,integer,decimal,timestamp,index,pgEnum
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./base";
import { organizations, users } from "./shared";
import { grants } from "./grants";
import { warehouses } from "./inventory";
import { vendors } from "./vendors";

// ═══════════════════════════════════════════════════════════════
// Logistics / Fleet Management — المركبات، الوقود، الصيانة، بوليصة الشحن
// ═══════════════════════════════════════════════════════════════

export const vehicleTypeEnum = pgEnum("vehicle_type", ["pickup","truck","sedan","suv","motorcycle","bus","other"]);
export const vehicleStatusEnum = pgEnum("vehicle_status", ["active","maintenance","inactive","disposed"]);

export const vehicles = pgTable("vehicles",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  code:           text("code").unique().notNull(),
  plateNumber:    text("plate_number").notNull(),
  make:           text("make"),
  model:          text("model"),
  year:           integer("year"),
  vehicleType:    vehicleTypeEnum("vehicle_type").notNull(),
  vehicleStatus:  vehicleStatusEnum("vehicle_status").default("active").notNull(),
  fuelType:       text("fuel_type").default("diesel"), // diesel | petrol | electric
  currentOdometer: integer("current_odometer").default(0).notNull(),
  assignedDriverId: uuid("assigned_driver_id"), // FK إلى drivers، مُعرَّف أدناه
  warehouseId:    uuid("warehouse_id").references(()=>warehouses.id), // موقع التمركز الأساسي
  nextServiceOdometer: integer("next_service_odometer"),
  nextServiceDate: timestamp("next_service_date",{withTimezone:true}),
},(t)=>({ orgIdx: index("vehicle_org_idx").on(t.organizationId) }));

export const drivers = pgTable("drivers",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  fullName:       text("full_name").notNull(),
  licenseNumber:  text("license_number").notNull(),
  licenseExpiryDate: timestamp("license_expiry_date",{withTimezone:true}),
  phone:          text("phone"),
  isActive:       boolean("is_active").default(true).notNull(),
},(t)=>({ orgIdx: index("driver_org_idx").on(t.organizationId) }));

export const tripStatusEnum = pgEnum("trip_status", ["planned","in_progress","completed","cancelled"]);

// بوليصة الشحن / رحلة النقل (Waybill)
export const vehicleTrips = pgTable("vehicle_trips",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  vehicleId:      uuid("vehicle_id").references(()=>vehicles.id).notNull(),
  driverId:       uuid("driver_id").references(()=>drivers.id).notNull(),
  grantId:        uuid("grant_id").references(()=>grants.id), // لتوزيع تكلفة النقل على المشروع
  waybillNumber:  text("waybill_number").unique().notNull(),
  purpose:        text("purpose").notNull(),
  origin:         text("origin").notNull(),
  destination:    text("destination").notNull(),
  cargoDescription: text("cargo_description"),
  departureDate:  timestamp("departure_date",{withTimezone:true}).notNull(),
  returnDate:     timestamp("return_date",{withTimezone:true}),
  startOdometer:  integer("start_odometer").notNull(),
  endOdometer:    integer("end_odometer"),
  tripStatus:     tripStatusEnum("trip_status").default("planned").notNull(),
},(t)=>({
  orgIdx: index("trip_org_idx").on(t.organizationId),
  vehicleIdx: index("trip_vehicle_idx").on(t.vehicleId),
}));

export const fuelLogs = pgTable("fuel_logs",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  vehicleId:      uuid("vehicle_id").references(()=>vehicles.id).notNull(),
  fuelDate:       timestamp("fuel_date",{withTimezone:true}).default(sql`now()`).notNull(),
  liters:         decimal("liters",{precision:10,scale:2}).notNull(),
  cost:           decimal("cost",{precision:12,scale:2}).notNull(),
  odometerAtFueling: integer("odometer_at_fueling").notNull(),
  station:        text("station"),
},(t)=>({ vehicleIdx: index("fuel_vehicle_idx").on(t.vehicleId) }));

export const maintenanceTypeEnum = pgEnum("maintenance_type", ["routine_service","repair","tire_change","inspection","other"]);

export const maintenanceRecords = pgTable("maintenance_records",{
  ...baseColumns,
  organizationId: uuid("organization_id").references(()=>organizations.id).notNull(),
  vehicleId:      uuid("vehicle_id").references(()=>vehicles.id).notNull(),
  vendorId:       uuid("vendor_id").references(()=>vendors.id),
  maintenanceType: maintenanceTypeEnum("maintenance_type").notNull(),
  maintenanceDate: timestamp("maintenance_date",{withTimezone:true}).default(sql`now()`).notNull(),
  odometerAtService: integer("odometer_at_service"),
  cost:           decimal("cost",{precision:12,scale:2}).notNull(),
  description:    text("description"),
  nextServiceOdometer: integer("next_service_odometer"),
  nextServiceDate: timestamp("next_service_date",{withTimezone:true}),
},(t)=>({ vehicleIdx: index("maint_vehicle_idx").on(t.vehicleId) }));
