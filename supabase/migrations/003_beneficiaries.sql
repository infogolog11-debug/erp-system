CREATE TYPE "public"."beneficiary_gender" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected', 'flagged_duplicate');--> statement-breakpoint
CREATE TYPE "public"."vulnerability_category" AS ENUM('none', 'elderly', 'disability', 'chronic_illness', 'female_headed_household', 'child_headed_household', 'unaccompanied_minor', 'pregnant_lactating', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_type" AS ENUM('protection', 'referral', 'complaint', 'assistance_request', 'follow_up', 'other');--> statement-breakpoint
CREATE TYPE "public"."case_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('open', 'in_progress', 'referred', 'closed');--> statement-breakpoint
CREATE TYPE "public"."distribution_type" AS ENUM('in_kind', 'cash', 'voucher', 'service');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "beneficiaries" (
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
	"grant_id" uuid,
	"code" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"full_name_ar" text,
	"date_of_birth" text,
	"gender" "beneficiary_gender" NOT NULL,
	"national_id" text,
	"phone" text,
	"governorate" text,
	"district" text,
	"community" text,
	"address_detail" text,
	"household_size" integer DEFAULT 1 NOT NULL,
	"vulnerability_category" "vulnerability_category" DEFAULT 'none' NOT NULL,
	"vulnerability_score" integer DEFAULT 0 NOT NULL,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"registration_date" timestamp with time zone DEFAULT now() NOT NULL,
	"duplicate_check_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "beneficiaries_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "household_members" (
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
	"beneficiary_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"relationship" text NOT NULL,
	"age" integer,
	"gender" "beneficiary_gender",
	"is_vulnerable" boolean DEFAULT false NOT NULL,
	"vulnerability_note" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_records" (
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
	"beneficiary_id" uuid NOT NULL,
	"code" text NOT NULL,
	"case_type" "case_type" NOT NULL,
	"priority" "case_priority" DEFAULT 'medium' NOT NULL,
	"case_status" "case_status" DEFAULT 'open' NOT NULL,
	"assigned_to" uuid,
	"description" text NOT NULL,
	"opened_date" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_date" timestamp with time zone,
	"is_confidential" boolean DEFAULT true NOT NULL,
	CONSTRAINT "case_records_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "case_notes" (
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
	"case_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "distributions" (
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
	"beneficiary_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"item_id" uuid,
	"distribution_type" "distribution_type" NOT NULL,
	"quantity" numeric(18, 3),
	"cash_amount" numeric(18, 2),
	"currency_code" text,
	"distribution_date" timestamp with time zone DEFAULT now() NOT NULL,
	"distributed_by" uuid NOT NULL,
	"location" text,
	"signature_confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_members" ADD CONSTRAINT "household_members_beneficiary_id_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."beneficiaries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "household_members" ADD CONSTRAINT "household_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_records" ADD CONSTRAINT "case_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_records" ADD CONSTRAINT "case_records_beneficiary_id_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."beneficiaries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_records" ADD CONSTRAINT "case_records_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_case_id_case_records_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."case_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "case_notes" ADD CONSTRAINT "case_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distributions" ADD CONSTRAINT "distributions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distributions" ADD CONSTRAINT "distributions_beneficiary_id_beneficiaries_id_fk" FOREIGN KEY ("beneficiary_id") REFERENCES "public"."beneficiaries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distributions" ADD CONSTRAINT "distributions_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distributions" ADD CONSTRAINT "distributions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "distributions" ADD CONSTRAINT "distributions_distributed_by_users_id_fk" FOREIGN KEY ("distributed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ben_org_idx" ON "beneficiaries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ben_grant_idx" ON "beneficiaries" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ben_dup_hash_idx" ON "beneficiaries" USING btree ("duplicate_check_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ben_national_id_idx" ON "beneficiaries" USING btree ("national_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hh_beneficiary_idx" ON "household_members" USING btree ("beneficiary_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_org_idx" ON "case_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_beneficiary_idx" ON "case_records" USING btree ("beneficiary_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "case_note_case_idx" ON "case_notes" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dist_org_idx" ON "distributions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dist_beneficiary_idx" ON "distributions" USING btree ("beneficiary_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dist_grant_idx" ON "distributions" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dist_date_idx" ON "distributions" USING btree ("distribution_date");
