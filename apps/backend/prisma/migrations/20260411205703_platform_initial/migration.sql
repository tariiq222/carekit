-- CreateEnum
CREATE TYPE "ProblemReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ProblemReportType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'OTHER');

-- CreateTable
CREATE TABLE "LicenseCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "features" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "type" "ProblemReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ProblemReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseCache_tenantId_key" ON "LicenseCache"("tenantId");

-- CreateIndex
CREATE INDEX "ProblemReport_tenantId_idx" ON "ProblemReport"("tenantId");

-- CreateIndex
CREATE INDEX "ProblemReport_status_idx" ON "ProblemReport"("status");

-- CreateIndex
CREATE INDEX "Integration_tenantId_idx" ON "Integration"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_tenantId_provider_key" ON "Integration"("tenantId", "provider");
