-- Phase 6: Multi-branch PractitionerAvailability support.
-- Adds optional branchId to PractitionerAvailability.
-- NULL branchId = practitioner available at all branches (backward-compatible default).
-- Non-NULL branchId = availability scoped to a specific branch only.
-- PractitionerAvailabilityService.getSlots() filters by branchId when provided.

ALTER TABLE "practitioner_availabilities"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "practitioner_availabilities"
  ADD CONSTRAINT "practitioner_availabilities_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL;

-- Drop old composite index and recreate with branchId included
DROP INDEX IF EXISTS "practitioner_availabilities_practitioner_id_day_of_week_is_act";

CREATE INDEX IF NOT EXISTS "practitioner_availabilities_pract_day_active_branch_idx"
  ON "practitioner_availabilities" ("practitioner_id", "day_of_week", "is_active", "branch_id");
