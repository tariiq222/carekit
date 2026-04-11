-- CreateEnum
CREATE TYPE "ClientGender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "ClientSource" AS ENUM ('WALK_IN', 'ONLINE', 'REFERRAL');

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gender" "ClientGender",
    "dateOfBirth" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "notes" TEXT,
    "source" "ClientSource" NOT NULL DEFAULT 'WALK_IN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Client_tenantId_idx" ON "Client"("tenantId");

-- CreateIndex
CREATE INDEX "Client_userId_idx" ON "Client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_phone_key" ON "Client"("tenantId", "phone");
