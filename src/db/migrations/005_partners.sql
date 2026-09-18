CREATE TYPE "public"."partner_type" AS ENUM('local_ngo', 'international_ngo', 'government', 'community_based', 'private_sector', 'un_agency');--> statement-breakpoint
CREATE TYPE "public"."due_diligence_status" AS ENUM('pending', 'cleared', 'flagged', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sub_grant_status" AS ENUM('draft', 'active', 'completed', 'terminated', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."disbursement_status" AS ENUM('pending', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_review_status" AS ENUM('pending', 'approved', 'needs_revision');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "partners" (
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
	"name" text NOT NULL,
	"name_ar" text,
	"partner_type" "partner_type" NOT NULL,
	"country" text,
	"registration_number" text,
	"contact_person" text,
	"email" text,
	"phone" text,
	"capacity_assessment_score" integer,
	"capacity_assessment_date" timestamp with time zone,
	"due_diligence_status" "due_diligence_status" DEFAULT 'pending' NOT NULL,
	"due_diligence_notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "partners_code_unique" UNIQUE("code")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_grants" (
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
	"parent_grant_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"currency_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"disbursed_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"reported_spent_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"agreement_signed_date" timestamp with time zone,
	"sub_grant_status" "sub_grant_status" DEFAULT 'draft' NOT NULL,
	"description" text,
	CONSTRAINT "sub_grants_code_unique" UNIQUE("code")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_grant_disbursements" (
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
	"sub_grant_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"disbursement_date" timestamp with time zone DEFAULT now() NOT NULL,
	"method" text,
	"reference_number" text,
	"disbursement_status" "disbursement_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partner_reports" (
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
	"sub_grant_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"narrative_report" text,
	"financial_report_amount" numeric(18, 2),
	"submitted_date" timestamp with time zone DEFAULT now() NOT NULL,
	"review_status" "report_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_comments" text
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partners" ADD CONSTRAINT "partners_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_parent_grant_id_grants_id_fk" FOREIGN KEY ("parent_grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grant_disbursements" ADD CONSTRAINT "sub_grant_disbursements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grant_disbursements" ADD CONSTRAINT "sub_grant_disbursements_sub_grant_id_sub_grants_id_fk" FOREIGN KEY ("sub_grant_id") REFERENCES "public"."sub_grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_grant_disbursements" ADD CONSTRAINT "sub_grant_disbursements_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_reports" ADD CONSTRAINT "partner_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_reports" ADD CONSTRAINT "partner_reports_sub_grant_id_sub_grants_id_fk" FOREIGN KEY ("sub_grant_id") REFERENCES "public"."sub_grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partner_reports" ADD CONSTRAINT "partner_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_org_idx" ON "partners" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subgrant_org_idx" ON "sub_grants" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subgrant_parent_idx" ON "sub_grants" USING btree ("parent_grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subgrant_partner_idx" ON "sub_grants" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disb_subgrant_idx" ON "sub_grant_disbursements" USING btree ("sub_grant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "preport_subgrant_idx" ON "partner_reports" USING btree ("sub_grant_id");
