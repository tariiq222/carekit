-- Drop unused max_recurring_weeks column from booking_settings
ALTER TABLE "booking_settings" DROP COLUMN IF EXISTS "max_recurring_weeks";
