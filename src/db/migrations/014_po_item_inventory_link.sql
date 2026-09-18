ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "item_id" uuid REFERENCES "items"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_items_item_idx" ON "purchase_order_items" USING btree ("item_id");
