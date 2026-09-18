ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_commit_within_planned" CHECK ("committed_amount" + "spent_amount" <= "planned_amount");--> statement-breakpoint
ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_committed_non_negative" CHECK ("committed_amount" >= 0);--> statement-breakpoint
ALTER TABLE "grant_budget_lines" ADD CONSTRAINT "grant_budget_lines_spent_non_negative" CHECK ("spent_amount" >= 0);--> statement-breakpoint
ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_within_total" CHECK ("disbursed_amount" <= "total_amount");--> statement-breakpoint
ALTER TABLE "sub_grants" ADD CONSTRAINT "sub_grants_disbursed_non_negative" CHECK ("disbursed_amount" >= 0);--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_within_ordered" CHECK ("received_qty" IS NULL OR "received_qty" <= "quantity");--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_received_non_negative" CHECK ("received_qty" IS NULL OR "received_qty" >= 0);
