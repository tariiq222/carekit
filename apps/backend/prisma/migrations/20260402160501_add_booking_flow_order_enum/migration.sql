-- ============================================================
-- Migration: Add BookingFlowOrder enum and migrate column
-- ============================================================

-- Step 1: Create the enum type
CREATE TYPE "booking_flow_order" AS ENUM ('service_first', 'practitioner_first', 'both');

-- Step 2: Add a new typed column with default
ALTER TABLE "booking_settings"
  ADD COLUMN "booking_flow_order_new" "booking_flow_order" NOT NULL DEFAULT 'service_first';

-- Step 3: Copy existing data (cast String → enum, fallback to service_first for unknown values)
UPDATE "booking_settings"
SET "booking_flow_order_new" = CASE
  WHEN "booking_flow_order" = 'practitioner_first' THEN 'practitioner_first'::"booking_flow_order"
  WHEN "booking_flow_order" = 'both'               THEN 'both'::"booking_flow_order"
  ELSE                                                   'service_first'::"booking_flow_order"
END;

-- Step 4: Drop old String column
ALTER TABLE "booking_settings" DROP COLUMN "booking_flow_order";

-- Step 5: Rename new column to the original name
ALTER TABLE "booking_settings" RENAME COLUMN "booking_flow_order_new" TO "booking_flow_order";
