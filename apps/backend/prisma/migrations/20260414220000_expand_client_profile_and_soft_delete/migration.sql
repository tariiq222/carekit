-- CreateEnum
CREATE TYPE "ClientAccountType" AS ENUM ('FULL', 'WALK_IN');

-- CreateEnum
CREATE TYPE "ClientBloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Client"
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "middleName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "nationality" TEXT,
  ADD COLUMN "nationalId" TEXT,
  ADD COLUMN "emergencyName" TEXT,
  ADD COLUMN "emergencyPhone" TEXT,
  ADD COLUMN "bloodType" "ClientBloodType",
  ADD COLUMN "allergies" TEXT,
  ADD COLUMN "chronicConditions" TEXT,
  ADD COLUMN "accountType" "ClientAccountType" NOT NULL DEFAULT 'WALK_IN',
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Backfill firstName/lastName from existing name column (best-effort split on first space)
UPDATE "Client"
SET
  "firstName" = CASE
    WHEN position(' ' IN "name") > 0 THEN substring("name" FROM 1 FOR position(' ' IN "name") - 1)
    ELSE "name"
  END,
  "lastName" = CASE
    WHEN position(' ' IN "name") > 0 THEN substring("name" FROM position(' ' IN "name") + 1)
    ELSE ''
  END
WHERE "firstName" IS NULL;

-- CreateIndex
CREATE INDEX "Client_tenantId_deletedAt_idx" ON "Client"("tenantId", "deletedAt");
