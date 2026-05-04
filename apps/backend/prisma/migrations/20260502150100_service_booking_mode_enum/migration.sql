-- DB-10: Introduce ServiceBookingMode enum for ServiceBookingConfig.bookingType.
-- Replaces the plain String column storing 'in_person' | 'online' with a
-- typed PostgreSQL enum. Existing rows are normalised to uppercase before casting.

-- 1. Create the enum type (idempotent).
DO $$ BEGIN
  CREATE TYPE "ServiceBookingMode" AS ENUM ('IN_PERSON', 'ONLINE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2 & 3. Normalise string values and cast column only if it is still text.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ServiceBookingConfig'
      AND column_name = 'bookingType'
      AND data_type = 'text'
  ) THEN
    -- 2. Normalise existing string values to match enum cases.
    UPDATE "ServiceBookingConfig"
    SET "bookingType" = CASE
      WHEN "bookingType" = 'in_person' THEN 'IN_PERSON'
      WHEN "bookingType" = 'online'    THEN 'ONLINE'
      ELSE UPPER(REPLACE("bookingType", ' ', '_'))
    END;

    -- 3. Change column type, casting the now-normalised strings to the enum.
    ALTER TABLE "ServiceBookingConfig"
      ALTER COLUMN "bookingType" TYPE "ServiceBookingMode"
      USING "bookingType"::"ServiceBookingMode";
  END IF;
END $$;
