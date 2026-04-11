-- AddColumn: service_duration_option_id on bookings (FK-backed, nullable)
-- This field stores the ServiceDurationOption ID when the booking was created using
-- a service-level duration option. It is distinct from durationOptionId which may
-- reference either ServiceDurationOption or PractitionerDurationOption (no FK possible
-- for the latter without schema restructuring).
-- onDelete: SetNull ensures orphan IDs are cleaned up when setBookingTypes() recreates options.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "service_duration_option_id" TEXT;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_duration_option_id_fkey"
  FOREIGN KEY ("service_duration_option_id")
  REFERENCES "service_duration_options"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
