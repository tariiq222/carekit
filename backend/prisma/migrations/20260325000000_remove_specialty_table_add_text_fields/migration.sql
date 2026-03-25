-- Migration: Remove specialty_id FK, add specialty/specialty_ar text fields
-- Step 1: Add new text columns with defaults
ALTER TABLE "practitioners" ADD COLUMN "specialty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "practitioners" ADD COLUMN "specialty_ar" TEXT NOT NULL DEFAULT '';

-- Step 2: Copy existing specialty name into new columns from the specialties table
UPDATE "practitioners" p
SET
  "specialty" = COALESCE(s."name_en", ''),
  "specialty_ar" = COALESCE(s."name_ar", '')
FROM "specialties" s
WHERE p."specialty_id" = s."id";

-- Step 3: Drop the old foreign key and column
ALTER TABLE "practitioners" DROP CONSTRAINT IF EXISTS "practitioners_specialty_id_fkey";
ALTER TABLE "practitioners" DROP COLUMN "specialty_id";

-- Step 4: Drop old index on specialty_id if it exists
DROP INDEX IF EXISTS "practitioners_specialty_id_idx";

-- Step 5: Drop specialties table
DROP TABLE IF EXISTS "specialties";
