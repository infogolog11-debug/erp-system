-- إصلاح: البونص/الخصم كانا يُقرآن من كتالوج مستوى-المنظمة فقط (نفس القيمة
-- لكل الموظفين بكل دورة رواتب). هذا الجدول يسجّل بونص/خصم فعلي لكل موظف
-- بكل دورة، بسبب موثّق (description إلزامي)، وبمرجعية من أنشأه.
DO $$ BEGIN
  CREATE TYPE "payroll_adjustment_type" AS ENUM ('bonus','deduction');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" "record_status" DEFAULT 'draft' NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "is_archived" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone,
  "archived_by" uuid,
  "notes" text,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "month" integer NOT NULL,
  "year" integer NOT NULL,
  "adjustment_type" "payroll_adjustment_type" NOT NULL,
  "amount" decimal(12,2) NOT NULL,
  "description" text NOT NULL,
  "consumed_in_run_id" uuid
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "padj_period_idx" ON "payroll_adjustments" USING btree ("organization_id","year","month");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "padj_emp_idx" ON "payroll_adjustments" USING btree ("employee_id");
