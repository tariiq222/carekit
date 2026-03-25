-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('FULL', 'WALK_IN');

-- AlterTable: add accountType and claimedAt
ALTER TABLE "users"
  ADD COLUMN "account_type" "account_type" NOT NULL DEFAULT 'FULL',
  ADD COLUMN "claimed_at" TIMESTAMP(3);

-- CreateIndex: unique on phone (only for non-null values)
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone") WHERE "phone" IS NOT NULL;
