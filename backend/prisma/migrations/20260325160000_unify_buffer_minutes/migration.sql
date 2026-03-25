-- Unify buffer_before + buffer_after into a single buffer_minutes field
-- Override chain: PractitionerService > Service > BookingSettings (global)

-- ── practitioner_services ─────────────────────────────────────────────────
ALTER TABLE "practitioner_services"
  ADD COLUMN "buffer_minutes" INTEGER NOT NULL DEFAULT 0;

-- Migrate: take the larger of the two values
UPDATE "practitioner_services"
  SET "buffer_minutes" = GREATEST("buffer_before", "buffer_after");

ALTER TABLE "practitioner_services"
  DROP COLUMN "buffer_before",
  DROP COLUMN "buffer_after";

-- ── services ──────────────────────────────────────────────────────────────
ALTER TABLE "services"
  ADD COLUMN "buffer_minutes" INTEGER NOT NULL DEFAULT 0;

-- Migrate: take the larger of the two values
UPDATE "services"
  SET "buffer_minutes" = GREATEST("buffer_before_minutes", "buffer_after_minutes");

ALTER TABLE "services"
  DROP COLUMN "buffer_before_minutes",
  DROP COLUMN "buffer_after_minutes";
