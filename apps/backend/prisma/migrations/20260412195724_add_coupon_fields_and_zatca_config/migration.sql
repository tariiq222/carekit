-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "maxUsesPerUser" INTEGER,
ADD COLUMN     "serviceIds" TEXT[];

-- CreateTable
CREATE TABLE "ZatcaConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vatRegistrationNumber" TEXT,
    "sellerName" TEXT,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZatcaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaConfig_tenantId_key" ON "ZatcaConfig"("tenantId");

-- CreateIndex
CREATE INDEX "ZatcaConfig_tenantId_idx" ON "ZatcaConfig"("tenantId");
