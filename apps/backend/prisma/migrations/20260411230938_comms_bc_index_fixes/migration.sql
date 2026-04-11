/*
  Warnings:

  - You are about to drop the column `subject` on the `EmailTemplate` table. All the data in the column will be lost.
  - Added the required column `subjectAr` to the `EmailTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "CommsChatMessage_tenantId_conversationId_idx";

-- DropIndex
DROP INDEX "Notification_tenantId_recipientId_isRead_idx";

-- AlterTable
ALTER TABLE "EmailTemplate" DROP COLUMN "subject",
ADD COLUMN     "subjectAr" TEXT NOT NULL,
ADD COLUMN     "subjectEn" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "ChatConversation_tenantId_status_lastMessageAt_idx" ON "ChatConversation"("tenantId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "CommsChatMessage_tenantId_conversationId_createdAt_idx" ON "CommsChatMessage"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_recipientId_createdAt_idx" ON "Notification"("tenantId", "recipientId", "createdAt");
