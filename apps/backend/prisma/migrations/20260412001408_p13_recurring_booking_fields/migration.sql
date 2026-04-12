-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');

-- DropIndex
DROP INDEX "DocumentChunk_embedding_cosine_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "recurringGroupId" TEXT,
ADD COLUMN     "recurringPattern" "RecurringFrequency";

-- CreateIndex
CREATE INDEX "Booking_recurringGroupId_idx" ON "Booking"("recurringGroupId");
