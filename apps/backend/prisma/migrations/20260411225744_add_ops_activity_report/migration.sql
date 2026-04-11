-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('REVENUE', 'ACTIVITY', 'BOOKINGS', 'EMPLOYEES');

-- CreateEnum
CREATE TYPE "ReportFormat" AS ENUM ('JSON', 'EXCEL');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" "ActivityAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'JSON',
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "params" JSONB NOT NULL,
    "resultUrl" TEXT,
    "resultData" JSONB,
    "errorMsg" TEXT,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_occurredAt_idx" ON "ActivityLog"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_entity_entityId_idx" ON "ActivityLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_userId_idx" ON "ActivityLog"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "Report_tenantId_type_createdAt_idx" ON "Report"("tenantId", "type", "createdAt");
