-- Phase 6: Replace Coupon.serviceIds String[] array with CouponService pivot table.
-- Benefits: FK constraints, cascading deletes, referential integrity.
-- The old service_ids column is preserved (not dropped) for rollback safety.
-- Run cleanup migration to drop service_ids after 2-week verification window.

CREATE TABLE IF NOT EXISTS "coupon_services" (
  "id"         TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "coupon_id"  TEXT        NOT NULL,
  "service_id" TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "coupon_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_services_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coupon_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coupon_services_coupon_id_service_id_key"
    UNIQUE ("coupon_id", "service_id")
);

CREATE INDEX IF NOT EXISTS "coupon_services_coupon_id_idx"
  ON "coupon_services" ("coupon_id");

CREATE INDEX IF NOT EXISTS "coupon_services_service_id_idx"
  ON "coupon_services" ("service_id");

-- Migrate existing data: expand service_ids TEXT[] array into pivot rows.
-- Skips entries where the service no longer exists (orphan IDs in old array).
-- ON CONFLICT is idempotent — safe to re-run.
INSERT INTO "coupon_services" ("coupon_id", "service_id")
SELECT c.id, s.id
FROM "coupons" c
CROSS JOIN LATERAL unnest(c.service_ids) AS sid(value)
JOIN "services" s ON s.id = sid.value
ON CONFLICT ("coupon_id", "service_id") DO NOTHING;
