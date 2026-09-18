-- v32 (تابع): ربط بند أمر الشراء بكتالوج أصناف المخزون، لتفعيل استلام
-- بضاعة فعلي يحدّث المخزون. راجع SECURITY_NOTES.md § v32 لسياق كامل
-- لماذا كان هذا الربط غائباً من الأصل.
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "item_id" uuid REFERENCES "items"("id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "po_items_item_idx" ON "purchase_order_items" USING btree ("item_id");--> statement-breakpoint
