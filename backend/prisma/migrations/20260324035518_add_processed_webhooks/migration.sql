/*
  Warnings:

  - The values [reviewing] on the enum `problem_report_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "problem_report_status_new" AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
ALTER TABLE "public"."problem_reports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "problem_reports" ALTER COLUMN "status" TYPE "problem_report_status_new" USING ("status"::text::"problem_report_status_new");
ALTER TYPE "problem_report_status" RENAME TO "problem_report_status_old";
ALTER TYPE "problem_report_status_new" RENAME TO "problem_report_status";
DROP TYPE "public"."problem_report_status_old";
ALTER TABLE "problem_reports" ALTER COLUMN "status" SET DEFAULT 'open';
COMMIT;

-- DropIndex
DROP INDEX "knowledge_base_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "bank_transfer_receipts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "chat_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ratings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "processed_webhooks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhooks_event_id_key" ON "processed_webhooks"("event_id");

-- CreateIndex
CREATE INDEX "processed_webhooks_processed_at_idx" ON "processed_webhooks"("processed_at");
