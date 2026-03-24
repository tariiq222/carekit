-- Prevent double-booking at the database level.
-- This partial unique index ensures that no two active bookings
-- (pending, confirmed, checked_in, in_progress) can occupy the same
-- practitioner + date + start_time slot simultaneously.
-- Cancelled, no_show, and expired bookings are excluded.

CREATE UNIQUE INDEX "bookings_practitioner_slot_unique"
  ON "bookings" ("practitioner_id", "date", "start_time")
  WHERE "status" IN ('pending', 'confirmed', 'checked_in', 'in_progress')
    AND "deleted_at" IS NULL;
