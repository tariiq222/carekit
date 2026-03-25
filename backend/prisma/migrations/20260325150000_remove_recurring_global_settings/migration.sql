-- Remove recurring global settings from booking_settings
-- These fields had no backend enforcement (patterns were hardcoded in service)
-- Each Service now controls its own allowed patterns and max recurrences

ALTER TABLE "booking_settings" DROP COLUMN IF EXISTS "max_recurring_weeks";
ALTER TABLE "booking_settings" DROP COLUMN IF EXISTS "allowed_recurring_patterns";
ALTER TABLE "booking_settings" DROP COLUMN IF EXISTS "max_recurrences";
