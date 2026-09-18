-- v32: معالجة نقاط ضعف حقيقية
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "balance_qty" numeric(18,3);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "balance_avg_cost" numeric(18,4);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_org_idx" ON "stock_movements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stock_ref_idx" ON "stock_movements" USING btree ("reference_table","reference_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_item_idem_uidx" ON "stock_movements" ("item_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idempotency_keys" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,"organization_id" uuid NOT NULL,"key" text NOT NULL,"action" text NOT NULL,"response_json" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_org_key_action_uidx" ON "idempotency_keys" ("organization_id","key","action");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "prev_hash" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "hash" text;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_current_stock_non_negative" CHECK ("current_stock" >= 0);--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_amounts_non_negative" CHECK ("debit_amount" >= 0 AND "credit_amount" >= 0);--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_not_both_debit_and_credit" CHECK (NOT ("debit_amount" > 0 AND "credit_amount" > 0));--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_quantity_positive" CHECK ("quantity" > 0);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_type_valid" CHECK ("movement_type" IN ('in','out','transfer','adjustment'));--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_type_valid" CHECK ("entry_type" IN ('manual','procurement','payroll','depreciation','payment','reversal'));--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_posted_journal_line_change() RETURNS TRIGGER AS $$ DECLARE entry_posted boolean; BEGIN SELECT is_posted INTO entry_posted FROM journal_entries WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id); IF entry_posted THEN RAISE EXCEPTION 'Cannot modify posted journal line'; END IF; RETURN COALESCE(NEW, OLD); END; $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_prevent_posted_journal_line_change ON journal_lines;--> statement-breakpoint
CREATE TRIGGER trg_prevent_posted_journal_line_change BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_line_change();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_posted_journal_entry_amount_change() RETURNS TRIGGER AS $$ BEGIN IF OLD.is_posted THEN IF NEW.total_debit IS DISTINCT FROM OLD.total_debit OR NEW.total_credit IS DISTINCT FROM OLD.total_credit OR NEW.fiscal_period_id IS DISTINCT FROM OLD.fiscal_period_id OR NEW.entry_date IS DISTINCT FROM OLD.entry_date OR NEW.is_posted IS DISTINCT FROM OLD.is_posted THEN RAISE EXCEPTION 'Cannot modify posted entry amounts'; END IF; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_prevent_posted_journal_entry_amount_change ON journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_prevent_posted_journal_entry_amount_change BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_entry_amount_change();--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_journal_balance_on_post() RETURNS TRIGGER AS $$ DECLARE sd numeric(18,2); sc numeric(18,2); BEGIN IF NEW.is_posted AND NOT OLD.is_posted THEN SELECT COALESCE(SUM(debit_amount),0), COALESCE(SUM(credit_amount),0) INTO sd, sc FROM journal_lines WHERE journal_entry_id = NEW.id; IF sd != sc THEN RAISE EXCEPTION 'Journal unbalanced debit=% credit=%', sd, sc; END IF; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_enforce_journal_balance_on_post ON journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_enforce_journal_balance_on_post BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION enforce_journal_balance_on_post();--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_audit_log_modification() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'audit_logs append-only'; END; $$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_prevent_audit_log_modification ON audit_logs;--> statement-breakpoint
CREATE TRIGGER trg_prevent_audit_log_modification BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
