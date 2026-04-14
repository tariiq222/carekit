-- CreateEnum (IF NOT EXISTS workaround)
DO $$ BEGIN
  CREATE TYPE "RecurringFrequency" AS ENUM ('DAILY', 'WEEKLY', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex (disabled for local dev - index doesn't exist without pgvector)
-- DROP INDEX "DocumentChunk_embedding_cosine_idx";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "recurringGroupId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "recurringPattern" "RecurringFrequency";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_recurringGroupId_idx" ON "Booking"("recurringGroupId");
