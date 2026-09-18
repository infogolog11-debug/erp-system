CREATE TYPE "public"."fx_revaluation_type" AS ENUM('realized', 'unrealized');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exchange_rate_history" (
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
	"currency_id" uuid NOT NULL,
	"rate_date" timestamp with time zone NOT NULL,
	"rate_to_base" numeric(18, 6) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fx_revaluations" (
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
	"account_id" uuid,
	"currency_id" uuid NOT NULL,
	"revaluation_date" timestamp with time zone NOT NULL,
	"revaluation_type" "fx_revaluation_type" NOT NULL,
	"base_currency_amount" numeric(18, 2) NOT NULL,
	"original_rate" numeric(18, 6) NOT NULL,
	"current_rate" numeric(18, 6) NOT NULL,
	"gain_loss_amount" numeric(18, 2) NOT NULL,
	"journal_entry_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exchange_rate_history" ADD CONSTRAINT "exchange_rate_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "exchange_rate_history" ADD CONSTRAINT "exchange_rate_history_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fx_revaluations" ADD CONSTRAINT "fx_revaluations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fx_revaluations" ADD CONSTRAINT "fx_revaluations_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fx_revaluations" ADD CONSTRAINT "fx_revaluations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fx_revaluations" ADD CONSTRAINT "fx_revaluations_currency_id_currencies_id_fk" FOREIGN KEY ("currency_id") REFERENCES "public"."currencies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fx_revaluations" ADD CONSTRAINT "fx_revaluations_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_hist_curr_date_idx" ON "exchange_rate_history" USING btree ("currency_id","rate_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_hist_org_idx" ON "exchange_rate_history" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_reval_org_idx" ON "fx_revaluations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_reval_grant_idx" ON "fx_revaluations" USING btree ("grant_id");
