/*
  Warnings:

  - Made the column `practitioner_service_id` on table `bookings` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_practitioner_service_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "practitioner_service_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_practitioner_service_id_fkey" FOREIGN KEY ("practitioner_service_id") REFERENCES "practitioner_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
