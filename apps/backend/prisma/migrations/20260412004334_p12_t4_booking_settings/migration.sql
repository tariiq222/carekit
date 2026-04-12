-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('FULL', 'PARTIAL', 'NONE');

-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "freeCancelBeforeHours" INTEGER NOT NULL DEFAULT 24,
    "freeCancelRefundType" "RefundType" NOT NULL DEFAULT 'FULL',
    "lateCancelRefundPercent" INTEGER NOT NULL DEFAULT 0,
    "maxReschedulesPerBooking" INTEGER NOT NULL DEFAULT 3,
    "autoCompleteAfterHours" INTEGER NOT NULL DEFAULT 2,
    "autoNoShowAfterMinutes" INTEGER NOT NULL DEFAULT 30,
    "minBookingLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxAdvanceBookingDays" INTEGER NOT NULL DEFAULT 90,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waitlistMaxPerSlot" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSettings_tenantId_idx" ON "BookingSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettings_tenantId_branchId_key" ON "BookingSettings"("tenantId", "branchId");
