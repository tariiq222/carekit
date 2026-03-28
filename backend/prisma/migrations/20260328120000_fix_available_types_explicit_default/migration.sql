-- Fix: make availableTypes explicit — replace empty arrays with [in_person, online]
-- Previously [] meant "all types allowed" by convention only (silent bug risk).
-- Now the default is explicit and [] rows are backfilled.

ALTER TABLE "practitioner_services"
  ALTER COLUMN "available_types" SET DEFAULT ARRAY['in_person'::"booking_type", 'online'::"booking_type"];

UPDATE "practitioner_services"
  SET "available_types" = ARRAY['in_person'::"booking_type", 'online'::"booking_type"]
  WHERE "available_types" = '{}';
