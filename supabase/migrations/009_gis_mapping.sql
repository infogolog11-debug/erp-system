ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
ALTER TABLE "beneficiaries" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "latitude" numeric(10, 7);
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "longitude" numeric(10, 7);
