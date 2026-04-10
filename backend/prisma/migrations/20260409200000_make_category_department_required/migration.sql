-- Make department_id required on service_categories
-- Existing categories without a department must be assigned one before running this migration

-- Step 1: Drop the old nullable FK constraint
ALTER TABLE "service_categories" DROP CONSTRAINT IF EXISTS "service_categories_department_id_fkey";

-- Step 2: Make column NOT NULL
ALTER TABLE "service_categories" ALTER COLUMN "department_id" SET NOT NULL;

-- Step 3: Re-add FK with RESTRICT (prevent deleting a department that has categories)
ALTER TABLE "service_categories"
  ADD CONSTRAINT "service_categories_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
