CREATE TYPE "public"."vehicle_type" AS ENUM('pickup', 'truck', 'sedan', 'suv', 'motorcycle', 'bus', 'other');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('active', 'maintenance', 'inactive', 'disposed');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."maintenance_type" AS ENUM('routine_service', 'repair', 'tire_change', 'inspection', 'other');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"plate_number" text NOT NULL,
	"make" text,
	"model" text,
	"year" integer,
	"vehicle_type" "vehicle_type" NOT NULL,
	"vehicle_status" "vehicle_status" DEFAULT 'active' NOT NULL,
	"fuel_type" text DEFAULT 'diesel',
	"current_odometer" integer DEFAULT 0 NOT NULL,
	"assigned_driver_id" uuid,
	"warehouse_id" uuid,
	"next_service_odometer" integer,
	"next_service_date" timestamp with time zone,
	CONSTRAINT "vehicles_code_unique" UNIQUE("code")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"license_number" text NOT NULL,
	"license_expiry_date" timestamp with time zone,
	"phone" text,
	"is_active" boolean DEFAULT true NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicle_trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"grant_id" uuid,
	"waybill_number" text NOT NULL,
	"purpose" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"cargo_description" text,
	"departure_date" timestamp with time zone NOT NULL,
	"return_date" timestamp with time zone,
	"start_odometer" integer NOT NULL,
	"end_odometer" integer,
	"trip_status" "trip_status" DEFAULT 'planned' NOT NULL,
	CONSTRAINT "vehicle_trips_waybill_number_unique" UNIQUE("waybill_number")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fuel_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"fuel_date" timestamp with time zone DEFAULT now() NOT NULL,
	"liters" numeric(10, 2) NOT NULL,
	"cost" numeric(12, 2) NOT NULL,
	"odometer_at_fueling" integer NOT NULL,
	"station" text
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "record_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"notes" text,
	"organization_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"vendor_id" uuid,
	"maintenance_type" "maintenance_type" NOT NULL,
	"maintenance_date" timestamp with time zone DEFAULT now() NOT NULL,
	"odometer_at_service" integer,
	"cost" numeric(12, 2) NOT NULL,
	"description" text,
	"next_service_odometer" integer,
	"next_service_date" timestamp with time zone
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_assigned_driver_id_drivers_id_fk" FOREIGN KEY ("assigned_driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "drivers" ADD CONSTRAINT "drivers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_trips" ADD CONSTRAINT "vehicle_trips_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_trips" ADD CONSTRAINT "vehicle_trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_trips" ADD CONSTRAINT "vehicle_trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vehicle_trips" ADD CONSTRAINT "vehicle_trips_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicle_org_idx" ON "vehicles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "driver_org_idx" ON "drivers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_org_idx" ON "vehicle_trips" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_vehicle_idx" ON "vehicle_trips" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fuel_vehicle_idx" ON "fuel_logs" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maint_vehicle_idx" ON "maintenance_records" USING btree ("vehicle_id");
