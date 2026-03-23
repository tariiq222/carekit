/*
  Warnings:

  - Added the required column `updated_at` to the `practitioner_services` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "practitioner_service_id" TEXT;

-- AlterTable
ALTER TABLE "practitioner_services" ADD COLUMN     "available_types" "booking_type"[],
ADD COLUMN     "buffer_after" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buffer_before" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "custom_duration" INTEGER,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "price_clinic" INTEGER,
ADD COLUMN     "price_phone" INTEGER,
ADD COLUMN     "price_video" INTEGER,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "bookings_practitioner_service_id_idx" ON "bookings"("practitioner_service_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_practitioner_service_id_fkey" FOREIGN KEY ("practitioner_service_id") REFERENCES "practitioner_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
