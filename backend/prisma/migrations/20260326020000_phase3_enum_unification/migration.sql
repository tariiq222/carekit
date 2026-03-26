-- Phase 3: Enum Unification — Convert String fields to proper Enums
-- Adds: CancelledBy, RefundType, NoShowPolicy, ChatIntent, KbFileType
-- Unifies: AccountType values to lower_case (FULL→full, WALK_IN→walk_in)

-- ──────────────────────────────────────────────
-- 1. Create new enum types
-- ──────────────────────────────────────────────

CREATE TYPE "cancelled_by" AS ENUM ('patient', 'practitioner', 'admin', 'system');
CREATE TYPE "refund_type" AS ENUM ('full', 'partial', 'none');
CREATE TYPE "no_show_policy" AS ENUM ('keep_full', 'partial_refund', 'admin_decides');
CREATE TYPE "chat_intent" AS ENUM ('book', 'modify', 'cancel', 'query', 'handoff', 'greeting');
CREATE TYPE "kb_file_type" AS ENUM ('pdf', 'docx', 'doc', 'txt');

-- ──────────────────────────────────────────────
-- 2. bookings.cancelled_by — String → cancelled_by enum
-- ──────────────────────────────────────────────
ALTER TABLE "bookings"
  ALTER COLUMN "cancelled_by" TYPE "cancelled_by"
  USING "cancelled_by"::"cancelled_by";

-- ──────────────────────────────────────────────
-- 3. bookings.suggested_refund_type — String → refund_type enum
-- ──────────────────────────────────────────────
ALTER TABLE "bookings"
  ALTER COLUMN "suggested_refund_type" TYPE "refund_type"
  USING "suggested_refund_type"::"refund_type";

-- ──────────────────────────────────────────────
-- 4. booking_settings.free_cancel_refund_type — String → refund_type enum
-- ──────────────────────────────────────────────
ALTER TABLE "booking_settings" ALTER COLUMN "free_cancel_refund_type" DROP DEFAULT;
ALTER TABLE "booking_settings"
  ALTER COLUMN "free_cancel_refund_type" TYPE "refund_type"
  USING "free_cancel_refund_type"::"refund_type";
ALTER TABLE "booking_settings" ALTER COLUMN "free_cancel_refund_type" SET DEFAULT 'full'::"refund_type";

-- ──────────────────────────────────────────────
-- 5. booking_settings.late_cancel_refund_type — String → refund_type enum
-- ──────────────────────────────────────────────
ALTER TABLE "booking_settings" ALTER COLUMN "late_cancel_refund_type" DROP DEFAULT;
ALTER TABLE "booking_settings"
  ALTER COLUMN "late_cancel_refund_type" TYPE "refund_type"
  USING "late_cancel_refund_type"::"refund_type";
ALTER TABLE "booking_settings" ALTER COLUMN "late_cancel_refund_type" SET DEFAULT 'none'::"refund_type";

-- ──────────────────────────────────────────────
-- 6. booking_settings.no_show_policy — String → no_show_policy enum
-- ──────────────────────────────────────────────
ALTER TABLE "booking_settings" ALTER COLUMN "no_show_policy" DROP DEFAULT;
ALTER TABLE "booking_settings"
  ALTER COLUMN "no_show_policy" TYPE "no_show_policy"
  USING "no_show_policy"::"no_show_policy";
ALTER TABLE "booking_settings" ALTER COLUMN "no_show_policy" SET DEFAULT 'keep_full'::"no_show_policy";

-- ──────────────────────────────────────────────
-- 7. chat_messages.intent — String → chat_intent enum
-- Existing rows with NULL or unknown values stay NULL
-- ──────────────────────────────────────────────
ALTER TABLE "chat_messages"
  ALTER COLUMN "intent" TYPE "chat_intent"
  USING CASE
    WHEN "intent" IN ('book','modify','cancel','query','handoff','greeting')
      THEN "intent"::"chat_intent"
    ELSE NULL
  END;

-- ──────────────────────────────────────────────
-- 8. knowledge_base_files.file_type — String → kb_file_type enum
-- ──────────────────────────────────────────────
ALTER TABLE "knowledge_base_files"
  ALTER COLUMN "file_type" TYPE "kb_file_type"
  USING CASE
    WHEN "file_type" = 'docx' THEN 'docx'::"kb_file_type"
    WHEN "file_type" = 'doc'  THEN 'doc'::"kb_file_type"
    WHEN "file_type" = 'txt'  THEN 'txt'::"kb_file_type"
    ELSE 'pdf'::"kb_file_type"
  END;

-- ──────────────────────────────────────────────
-- 9. AccountType unification: FULL→full, WALK_IN→walk_in
-- Rename existing enum values (PostgreSQL supports ALTER TYPE RENAME VALUE)
-- ──────────────────────────────────────────────
ALTER TYPE "account_type" RENAME VALUE 'FULL' TO 'full';
ALTER TYPE "account_type" RENAME VALUE 'WALK_IN' TO 'walk_in';
