-- تدقيق أداء: 3 فهارس ناقصة على organizationId (العمود الأكثر استخداماً بكل استعلام)
CREATE INDEX IF NOT EXISTS "donors_org_idx" ON "donors" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "warehouses_org_idx" ON "warehouses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_runs_org_idx" ON "payroll_runs" USING btree ("organization_id");
