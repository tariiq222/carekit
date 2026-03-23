-- 1. Add rescheduled_from_id to bookings (self-referential reschedule chain)
ALTER TABLE "bookings" ADD COLUMN "rescheduled_from_id" TEXT;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_key" UNIQUE ("rescheduled_from_id");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rescheduled_from_id_fkey"
  FOREIGN KEY ("rescheduled_from_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Add no_show to booking_status enum
ALTER TYPE "booking_status" ADD VALUE 'no_show';

-- 3. Add read_at to notifications
ALTER TABLE "notifications" ADD COLUMN "read_at" TIMESTAMP(3);

-- 4. Add description_ar to permissions
ALTER TABLE "permissions" ADD COLUMN "description_ar" TEXT;
