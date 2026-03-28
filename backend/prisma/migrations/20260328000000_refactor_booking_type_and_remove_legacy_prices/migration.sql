-- Rename old BookingType values to new ones
-- Step 1: Add new enum values
ALTER TYPE "booking_type" ADD VALUE IF NOT EXISTS 'in_person';
ALTER TYPE "booking_type" ADD VALUE IF NOT EXISTS 'online';

-- Step 2: Migrate existing data
UPDATE "bookings" SET "type" = 'in_person' WHERE "type" = 'clinic_visit';
UPDATE "bookings" SET "type" = 'online'    WHERE "type" IN ('phone_consultation', 'video_consultation');

-- Update PractitionerService.availableTypes array
UPDATE "practitioner_services"
SET "available_types" = ARRAY(
  SELECT CASE
    WHEN unnested = 'clinic_visit'          THEN 'in_person'
    WHEN unnested = 'phone_consultation'    THEN 'online'
    WHEN unnested = 'video_consultation'    THEN 'online'
    ELSE unnested
  END
  FROM unnest("available_types") AS unnested
)::booking_type[];

-- Update PractitionerServiceType.bookingType
UPDATE "practitioner_service_types"
SET "booking_type" = 'in_person' WHERE "booking_type" = 'clinic_visit';
UPDATE "practitioner_service_types"
SET "booking_type" = 'online'    WHERE "booking_type" IN ('phone_consultation', 'video_consultation');

-- Update ServiceBookingType.bookingType if table exists
UPDATE "service_booking_types"
SET "booking_type" = 'in_person' WHERE "booking_type" = 'clinic_visit';
UPDATE "service_booking_types"
SET "booking_type" = 'online'    WHERE "booking_type" IN ('phone_consultation', 'video_consultation');

-- Step 3: Remove old enum values (requires recreating the enum in Postgres)
-- We do this via a temporary rename + recreate pattern
ALTER TYPE "booking_type" RENAME TO "booking_type_old";

CREATE TYPE "booking_type" AS ENUM ('in_person', 'online', 'walk_in');

-- Migrate columns to new type
ALTER TABLE "bookings"
  ALTER COLUMN "type" TYPE "booking_type" USING "type"::text::"booking_type";

ALTER TABLE "practitioner_services"
  ALTER COLUMN "available_types" TYPE "booking_type"[]
  USING "available_types"::text[]::"booking_type"[];

ALTER TABLE "practitioner_service_types"
  ALTER COLUMN "booking_type" TYPE "booking_type" USING "booking_type"::text::"booking_type";

ALTER TABLE "service_booking_types"
  ALTER COLUMN "booking_type" TYPE "booking_type" USING "booking_type"::text::"booking_type";

DROP TYPE "booking_type_old";

-- Step 4: Remove legacy price columns from practitioner_services
ALTER TABLE "practitioner_services"
  DROP COLUMN IF EXISTS "price_clinic",
  DROP COLUMN IF EXISTS "price_phone",
  DROP COLUMN IF EXISTS "price_video";

-- Step 5: Remove legacy price columns from practitioners
ALTER TABLE "practitioners"
  DROP COLUMN IF EXISTS "price_clinic",
  DROP COLUMN IF EXISTS "price_phone",
  DROP COLUMN IF EXISTS "price_video";
