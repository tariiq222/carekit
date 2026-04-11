-- ============================================================
-- Migration: merge_courses_into_groups_rename_group_sessions
-- Date: 2026-04-10
-- Description:
--   1. Create new enums: group_scheduling_mode, group_status, group_payment_type
--   2. Update notification_type enum (remove course_*, add group_certificate_issued)
--   3. Drop course* tables (FK-safe order)
--   4. Drop course* enums
--   5. Rename group_sessions → groups (new CREATE + data migration + DROP old)
--   6. Rename group_session_id → group_id on group_enrollments
--   7. Add new columns to groups and group_enrollments
--   8. Create group_payments and group_certificates tables
--   9. Update license_config (rename has_group_sessions → has_groups, drop has_courses)
--  10. Data migrations: feature_flags + permissions
-- ============================================================

-- STEP 1: Create new enums

CREATE TYPE "group_scheduling_mode" AS ENUM ('fixed_date', 'on_capacity');

CREATE TYPE "group_status" AS ENUM ('open', 'awaiting_payment', 'confirmed', 'full', 'completed', 'cancelled');

CREATE TYPE "group_payment_type" AS ENUM ('FREE_HOLD', 'DEPOSIT', 'FULL_PAYMENT');

-- STEP 2: Update notification_type enum
-- (Remove course_* values, add group_certificate_issued)
-- Postgres cannot drop enum values directly — use CREATE TYPE + rename pattern.

BEGIN;
CREATE TYPE "notification_type_new" AS ENUM (
  'booking_confirmed',
  'booking_completed',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_expired',
  'booking_no_show',
  'booking_reminder',
  'booking_reminder_urgent',
  'booking_cancellation_requested',
  'booking_cancellation_rejected',
  'booking_practitioner_cancelled',
  'cancellation_rejected',
  'cancellation_requested',
  'no_show_review',
  'patient_arrived',
  'receipt_rejected',
  'reminder',
  'payment_received',
  'new_rating',
  'problem_report',
  'waitlist_slot_available',
  'system_alert',
  'group_enrollment_created',
  'group_capacity_reached',
  'group_session_confirmed',
  'group_payment_confirmed',
  'group_enrollment_expired',
  'group_session_cancelled',
  'group_session_cancelled_admin',
  'group_session_reminder',
  'group_certificate_issued'
);

-- Update any notifications using course_* types to system_alert before casting
UPDATE "notifications" SET "type" = 'system_alert'::text
WHERE "type" IN (
  'course_enrolled',
  'course_session_reminder',
  'course_cancelled',
  'course_completed',
  'course_attendance_marked'
);

ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "notification_type_new"
  USING ("type"::text::"notification_type_new");

ALTER TYPE "notification_type" RENAME TO "notification_type_old";
ALTER TYPE "notification_type_new" RENAME TO "notification_type";
DROP TYPE "notification_type_old";
COMMIT;

-- STEP 3: Drop course* tables (FK-safe order)

ALTER TABLE "course_payments" DROP CONSTRAINT IF EXISTS "course_payments_enrollment_id_fkey";
ALTER TABLE "course_payments" DROP CONSTRAINT IF EXISTS "course_payments_course_id_fkey";
ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "course_enrollments_course_id_fkey";
ALTER TABLE "course_enrollments" DROP CONSTRAINT IF EXISTS "course_enrollments_patient_id_fkey";
ALTER TABLE "course_sessions" DROP CONSTRAINT IF EXISTS "course_sessions_course_id_fkey";
ALTER TABLE "courses" DROP CONSTRAINT IF EXISTS "courses_practitioner_id_fkey";

DROP TABLE IF EXISTS "course_payments";
DROP TABLE IF EXISTS "course_enrollments";
DROP TABLE IF EXISTS "course_sessions";
DROP TABLE IF EXISTS "courses";

-- STEP 4: Drop course* enums

DROP TYPE IF EXISTS "course_enrollment_status";
DROP TYPE IF EXISTS "course_session_status";
DROP TYPE IF EXISTS "course_status";
DROP TYPE IF EXISTS "course_frequency";

-- STEP 5: Create new "groups" table (rename of group_sessions)
-- Strategy: CREATE new table, migrate data, DROP old table.
-- This is safer than ALTER TABLE RENAME when coupled with column renames.

CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "min_participants" INTEGER NOT NULL,
    "max_participants" INTEGER NOT NULL,
    "price_per_person_halalat" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "payment_deadline_hours" INTEGER NOT NULL DEFAULT 48,
    "payment_type" "group_payment_type" NOT NULL DEFAULT 'FULL_PAYMENT',
    "deposit_amount" INTEGER,
    "remaining_due_date" TIMESTAMP(3),
    "scheduling_mode" "group_scheduling_mode" NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "delivery_mode" "delivery_mode" NOT NULL DEFAULT 'in_person',
    "location" TEXT,
    "meeting_link" TEXT,
    "status" "group_status" NOT NULL DEFAULT 'open',
    "current_enrollment" INTEGER NOT NULL DEFAULT 0,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- Migrate existing group_sessions data into groups
-- Map: depositPercent → NULL (paymentType defaults to FULL_PAYMENT which matches depositPercent=100)
-- Map: scheduling_mode cast from old enum to new enum (same values)
INSERT INTO "groups" (
  "id", "practitioner_id", "name_ar", "name_en", "description_ar", "description_en",
  "min_participants", "max_participants", "price_per_person_halalat", "duration_minutes",
  "payment_deadline_hours", "payment_type", "scheduling_mode", "start_time", "end_time",
  "status", "current_enrollment", "reminder_sent", "is_published", "expires_at",
  "created_at", "updated_at", "deleted_at"
)
SELECT
  "id", "practitioner_id", "name_ar", "name_en", "description_ar", "description_en",
  "min_participants", "max_participants", "price_per_person_halalat", "duration_minutes",
  "payment_deadline_hours",
  'FULL_PAYMENT'::group_payment_type,
  "scheduling_mode"::text::"group_scheduling_mode",
  "start_time", "end_time",
  "status"::text::"group_status",
  "current_enrollment", "reminder_sent", "is_published", "expires_at",
  "created_at", "updated_at", "deleted_at"
FROM "group_sessions";

-- STEP 6: Update group_enrollments — rename group_session_id → group_id

-- Drop old FK and unique index
ALTER TABLE "group_enrollments" DROP CONSTRAINT IF EXISTS "group_enrollments_group_session_id_patient_id_key";
ALTER TABLE "group_enrollments" DROP CONSTRAINT IF EXISTS "group_enrollments_group_session_id_fkey";

-- Rename column
ALTER TABLE "group_enrollments" RENAME COLUMN "group_session_id" TO "group_id";

-- Add new columns to group_enrollments
ALTER TABLE "group_enrollments" ADD COLUMN "attended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "group_enrollments" ADD COLUMN "attended_at" TIMESTAMP(3);

-- Re-create unique constraint and indexes
CREATE UNIQUE INDEX "group_enrollments_group_id_patient_id_key" ON "group_enrollments"("group_id", "patient_id");

-- Re-add FK pointing to groups (was group_sessions)
ALTER TABLE "group_enrollments"
  ADD CONSTRAINT "group_enrollments_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 7: Drop old group_sessions table (after data migrated)

ALTER TABLE "group_sessions" DROP CONSTRAINT IF EXISTS "group_sessions_practitioner_id_fkey";
DROP TABLE "group_sessions";

-- Drop old enums (no longer needed)
DROP TYPE IF EXISTS "group_session_scheduling_mode";
DROP TYPE IF EXISTS "group_session_status";

-- STEP 8: Create group_payments table

CREATE TABLE "group_payments" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "remaining_amount" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "moyasar_payment_id" TEXT,
    "transaction_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_payments_enrollment_id_key" ON "group_payments"("enrollment_id");
CREATE UNIQUE INDEX "group_payments_moyasar_payment_id_key" ON "group_payments"("moyasar_payment_id");
CREATE INDEX "group_payments_status_idx" ON "group_payments"("status");
CREATE INDEX "group_payments_group_id_idx" ON "group_payments"("group_id");

ALTER TABLE "group_payments"
  ADD CONSTRAINT "group_payments_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "group_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_payments"
  ADD CONSTRAINT "group_payments_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 9: Create group_certificates table

CREATE TABLE "group_certificates" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "group_certificates_enrollment_id_key" ON "group_certificates"("enrollment_id");
CREATE INDEX "group_certificates_patient_id_idx" ON "group_certificates"("patient_id");
CREATE INDEX "group_certificates_group_id_idx" ON "group_certificates"("group_id");

ALTER TABLE "group_certificates"
  ADD CONSTRAINT "group_certificates_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "group_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "group_certificates"
  ADD CONSTRAINT "group_certificates_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "group_certificates"
  ADD CONSTRAINT "group_certificates_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Re-add FK for groups → practitioners

ALTER TABLE "groups"
  ADD CONSTRAINT "groups_practitioner_id_fkey"
  FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes on groups

CREATE INDEX "groups_practitioner_id_status_idx" ON "groups"("practitioner_id", "status");
CREATE INDEX "groups_status_expires_at_idx" ON "groups"("status", "expires_at");

-- STEP 10: Update license_config

ALTER TABLE "license_config" DROP COLUMN IF EXISTS "has_courses";
ALTER TABLE "license_config" RENAME COLUMN "has_group_sessions" TO "has_groups";

-- STEP 11: Data migrations — feature_flags and permissions

UPDATE "feature_flags" SET "key" = 'groups' WHERE "key" = 'group_sessions';
DELETE FROM "feature_flags" WHERE "key" = 'courses';

DELETE FROM "role_permissions" WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "module" = 'courses'
);
DELETE FROM "permissions" WHERE "module" = 'courses';
UPDATE "permissions" SET "module" = 'groups' WHERE "module" = 'group_sessions';
