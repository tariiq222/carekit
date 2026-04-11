-- Add branch attribution to bookings so branch-scoped settings, dashboards,
-- and reporting can resolve from the booking row itself.

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "bookings"
  DROP CONSTRAINT IF EXISTS "bookings_branch_id_fkey";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prefer explicit primary-branch attribution for historical bookings.
UPDATE "bookings" AS b
SET "branch_id" = pb."branch_id"
FROM "practitioner_branches" AS pb
WHERE pb."practitioner_id" = b."practitioner_id"
  AND pb."is_primary" = true
  AND b."branch_id" IS NULL;

-- Fall back to the sole practitioner branch when no primary flag exists.
WITH single_branch AS (
  SELECT "practitioner_id", MIN("branch_id") AS "branch_id"
  FROM "practitioner_branches"
  GROUP BY "practitioner_id"
  HAVING COUNT(*) = 1
)
UPDATE "bookings" AS b
SET "branch_id" = sb."branch_id"
FROM single_branch AS sb
WHERE sb."practitioner_id" = b."practitioner_id"
  AND b."branch_id" IS NULL;

CREATE INDEX IF NOT EXISTS "bookings_branch_id_idx"
  ON "bookings" ("branch_id");

CREATE INDEX IF NOT EXISTS "bookings_branch_id_date_idx"
  ON "bookings" ("branch_id", "date");

CREATE INDEX IF NOT EXISTS "bookings_branch_id_status_idx"
  ON "bookings" ("branch_id", "status");
