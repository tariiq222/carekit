/*
  Warnings:

  - Added the required column `endsAt` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "endsAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_tenantId_employeeId_endsAt_idx" ON "Booking"("tenantId", "employeeId", "endsAt");
