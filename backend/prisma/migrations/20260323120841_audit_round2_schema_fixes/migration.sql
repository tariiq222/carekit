-- Backend Audit Round 2: Schema Fixes
-- Safe migration with USING casts for enum conversions

-- ══════════════════════════════════════════════════
-- 1. Create new enums
-- ══════════════════════════════════════════════════

CREATE TYPE "otp_type" AS ENUM ('login', 'reset_password', 'verify_email');
CREATE TYPE "kb_file_status" AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE "device_platform" AS ENUM ('ios', 'android');
CREATE TYPE "session_language" AS ENUM ('ar', 'en');

-- ══════════════════════════════════════════════════
-- 2. Convert string columns to enums (safe USING cast)
-- ══════════════════════════════════════════════════

-- OtpCode.type: String → OtpType
ALTER TABLE "otp_codes"
  ALTER COLUMN "type" TYPE "otp_type" USING "type"::"otp_type";

-- FcmToken.platform: String → DevicePlatform
ALTER TABLE "fcm_tokens"
  ALTER COLUMN "platform" TYPE "device_platform" USING "platform"::"device_platform";

-- KnowledgeBaseFile.status: String → KbFileStatus (with default)
ALTER TABLE "knowledge_base_files"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "kb_file_status" USING "status"::"kb_file_status",
  ALTER COLUMN "status" SET DEFAULT 'pending';

-- ChatSession.language: String? → SessionLanguage?
ALTER TABLE "chat_sessions"
  ALTER COLUMN "language" TYPE "session_language" USING "language"::"session_language";

-- ══════════════════════════════════════════════════
-- 3. Add @unique on Payment.moyasarPaymentId
-- ══════════════════════════════════════════════════

CREATE UNIQUE INDEX "payments_moyasar_payment_id_key" ON "payments"("moyasar_payment_id");

-- ══════════════════════════════════════════════════
-- 4. Add soft delete (deletedAt) to financial models
-- ══════════════════════════════════════════════════

ALTER TABLE "payments" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "bank_transfer_receipts" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "ratings" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- ══════════════════════════════════════════════════
-- 5. Add missing updatedAt columns
-- ══════════════════════════════════════════════════

ALTER TABLE "bank_transfer_receipts" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "invoices" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "ratings" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "chat_sessions" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();
ALTER TABLE "notifications" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now();

-- ══════════════════════════════════════════════════
-- 6. Add missing indexes
-- ══════════════════════════════════════════════════

CREATE INDEX "bookings_date_idx" ON "bookings"("date");
CREATE INDEX "practitioners_is_active_deleted_at_idx" ON "practitioners"("is_active", "deleted_at");
