-- Phase 6: Multi-branch BookingSettings support.
-- Adds optional branchId to BookingSettings.
-- NULL branchId = global default row (the existing singleton).
-- Non-NULL branchId = branch-specific override row.
-- Resolution logic in BookingSettingsService.getForBranch(branchId): branch row ?? global row.
-- Two partial unique indexes enforce singleton-per-scope at DB level.

ALTER TABLE "booking_settings"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "booking_settings"
  ADD CONSTRAINT "booking_settings_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "booking_settings_branch_id_idx"
  ON "booking_settings" ("branch_id");

-- Enforce: at most one global row (branch_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS "booking_settings_global_unique_idx"
  ON "booking_settings" ((1))
  WHERE "branch_id" IS NULL;

-- Enforce: at most one row per branch
CREATE UNIQUE INDEX IF NOT EXISTS "booking_settings_branch_unique_idx"
  ON "booking_settings" ("branch_id")
  WHERE "branch_id" IS NOT NULL;
