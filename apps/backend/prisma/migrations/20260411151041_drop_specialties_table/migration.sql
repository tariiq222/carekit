-- Drop Specialty table and specialty_id FK from practitioners.
--
-- Context: the Specialty table was reference data never managed from the
-- dashboard (no UI, no API consumer). Practitioners carry specialty as
-- plain text fields (specialty/specialty_ar) which are the source of truth.
-- The ID-based path was dead weight after the specialties module was
-- removed from the backend (see refactor(backend/specialties)).
--
-- Backfill guard: copy Specialty names into the text columns for any
-- practitioner that still has specialty_id populated but an empty text
-- column, so no data is lost before the DROP.

-- 1. Backfill text columns from Specialty rows where still empty
UPDATE "practitioners" p
SET
  "specialty"    = COALESCE(NULLIF(p."specialty",    ''), s."name_en", ''),
  "specialty_ar" = COALESCE(NULLIF(p."specialty_ar", ''), s."name_ar", '')
FROM "specialties" s
WHERE p."specialty_id" = s."id";

-- 2. Drop FK constraint and column
ALTER TABLE "practitioners" DROP CONSTRAINT IF EXISTS "practitioners_specialty_id_fkey";
ALTER TABLE "practitioners" DROP COLUMN IF EXISTS "specialty_id";

-- 3. Drop the Specialty table
DROP TABLE IF EXISTS "specialties";
