-- CreateEnum
CREATE TYPE "zatca_status" AS ENUM ('not_applicable', 'pending', 'reported', 'failed');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoice_hash" TEXT,
ADD COLUMN     "previous_hash" TEXT,
ADD COLUMN     "qr_code_data" TEXT,
ADD COLUMN     "vat_amount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vat_rate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xml_content" TEXT,
ADD COLUMN     "zatca_response" JSONB,
ADD COLUMN     "zatca_status" "zatca_status" NOT NULL DEFAULT 'not_applicable';

-- CreateTable
CREATE TABLE "fcm_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fcm_tokens_user_id_idx" ON "fcm_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_tokens_user_id_token_key" ON "fcm_tokens"("user_id", "token");

-- AddForeignKey
ALTER TABLE "fcm_tokens" ADD CONSTRAINT "fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
