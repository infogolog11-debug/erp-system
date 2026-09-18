CREATE TYPE "public"."screening_entity_type" AS ENUM('partner', 'vendor', 'beneficiary', 'employee');--> statement-breakpoint
CREATE TYPE "public"."screening_result" AS ENUM('clear', 'potential_match', 'confirmed_match', 'pending_review');--> statement-breakpoint
CREATE TYPE "public"."screening_list" AS ENUM('un_consolidated_list', 'ofac_sdn', 'eu_sanctions_list', 'uk_hmt_list', 'national_list', 'other');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "screening_records" (
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
	"entity_type" "screening_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name_snapshot" text NOT NULL,
	"screened_against" "screening_list" NOT NULL,
	"screening_date" timestamp with time zone DEFAULT now() NOT NULL,
	"screened_by" uuid NOT NULL,
	"result" "screening_result" NOT NULL,
	"reference_number" text,
	"screening_notes" text,
	"next_screening_due" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screening_records" ADD CONSTRAINT "screening_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "screening_records" ADD CONSTRAINT "screening_records_screened_by_users_id_fk" FOREIGN KEY ("screened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screening_org_idx" ON "screening_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "screening_entity_idx" ON "screening_records" USING btree ("entity_type","entity_id");
