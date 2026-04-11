-- Remove 'hybrid' value from delivery_mode enum
-- Any existing rows with hybrid are updated to 'in_person' before removal

-- Step 1: Update any existing rows that use 'hybrid'
UPDATE "Group" SET "deliveryMode" = 'in_person' WHERE "deliveryMode" = 'hybrid';

-- Step 2: Remove hybrid from the enum
-- PostgreSQL does not support DROP VALUE directly; we rename and recreate the enum
ALTER TYPE "delivery_mode" RENAME TO "delivery_mode_old";

CREATE TYPE "delivery_mode" AS ENUM ('in_person', 'online');

ALTER TABLE "Group" ALTER COLUMN "deliveryMode" TYPE "delivery_mode" USING "deliveryMode"::text::"delivery_mode";

DROP TYPE "delivery_mode_old";
