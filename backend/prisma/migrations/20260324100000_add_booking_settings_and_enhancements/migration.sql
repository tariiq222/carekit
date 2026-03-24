-- Booking System Overhaul Migration
-- Adds: BookingSettings, WaitlistEntry, FavoritePractitioner
-- Updates: BookingType, BookingStatus, PaymentStatus, NotificationType enums
-- Updates: Booking model with new fields

-- ============================================
-- 1. Enum Updates
-- ============================================

-- Add walk_in to BookingType
ALTER TYPE "booking_type" ADD VALUE IF NOT EXISTS 'walk_in';

-- Add checked_in, in_progress, expired to BookingStatus
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'checked_in';
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE "booking_status" ADD VALUE IF NOT EXISTS 'expired';

-- Add awaiting to PaymentStatus
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'awaiting';

-- Add new notification types
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_rescheduled';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_expired';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'cancellation_rejected';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'cancellation_requested';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'waitlist_slot_available';

-- Create WaitlistStatus enum
CREATE TYPE "waitlist_status" AS ENUM ('waiting', 'notified', 'booked', 'expired', 'cancelled');

-- ============================================
-- 2. Booking model — new columns
-- ============================================

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "no_show_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "in_progress_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "completion_notes" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "is_walk_in" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "recurring_group_id" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "reschedule_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "suggested_refund_type" TEXT;

-- Index for recurring group queries
CREATE INDEX IF NOT EXISTS "bookings_recurring_group_id_idx" ON "bookings"("recurring_group_id");

-- ============================================
-- 3. BookingSettings table
-- ============================================

CREATE TABLE "booking_settings" (
    "id" TEXT NOT NULL,

    -- Payment timeout
    "payment_timeout_minutes" INTEGER NOT NULL DEFAULT 60,

    -- Cancellation policy
    "free_cancel_before_hours" INTEGER NOT NULL DEFAULT 24,
    "free_cancel_refund_type" TEXT NOT NULL DEFAULT 'full',
    "late_cancel_refund_type" TEXT NOT NULL DEFAULT 'none',
    "late_cancel_refund_percent" INTEGER NOT NULL DEFAULT 0,
    "admin_can_direct_cancel" BOOLEAN NOT NULL DEFAULT true,
    "patient_can_cancel_pending" BOOLEAN NOT NULL DEFAULT true,

    -- Rescheduling policy
    "patient_can_reschedule" BOOLEAN NOT NULL DEFAULT true,
    "reschedule_before_hours" INTEGER NOT NULL DEFAULT 12,
    "max_reschedules_per_booking" INTEGER NOT NULL DEFAULT 2,

    -- Walk-in
    "allow_walk_in" BOOLEAN NOT NULL DEFAULT true,
    "walk_in_payment_required" BOOLEAN NOT NULL DEFAULT false,

    -- Recurring
    "allow_recurring" BOOLEAN NOT NULL DEFAULT false,
    "max_recurring_weeks" INTEGER NOT NULL DEFAULT 12,

    -- Waitlist
    "waitlist_enabled" BOOLEAN NOT NULL DEFAULT false,
    "waitlist_max_per_slot" INTEGER NOT NULL DEFAULT 5,
    "waitlist_auto_notify" BOOLEAN NOT NULL DEFAULT true,

    -- Buffer
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,

    -- Auto-complete / no-show
    "auto_complete_after_hours" INTEGER NOT NULL DEFAULT 2,
    "auto_no_show_after_minutes" INTEGER NOT NULL DEFAULT 30,

    -- Reminders
    "reminder_24h_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_1h_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminder_interactive" BOOLEAN NOT NULL DEFAULT false,

    -- Suggestions
    "suggest_alternatives_on_conflict" BOOLEAN NOT NULL DEFAULT true,
    "suggest_alternatives_count" INTEGER NOT NULL DEFAULT 3,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_settings_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 4. WaitlistEntry table
-- ============================================

CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "service_id" TEXT,
    "preferred_date" TIMESTAMP(3),
    "preferred_time" TEXT,
    "status" "waitlist_status" NOT NULL DEFAULT 'waiting',
    "notified_at" TIMESTAMP(3),
    "booked_booking_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- WaitlistEntry indexes
CREATE INDEX "waitlist_entries_practitioner_id_status_idx" ON "waitlist_entries"("practitioner_id", "status");
CREATE INDEX "waitlist_entries_patient_id_idx" ON "waitlist_entries"("patient_id");

-- WaitlistEntry foreign keys
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 5. FavoritePractitioner table
-- ============================================

CREATE TABLE "favorite_practitioners" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_practitioners_pkey" PRIMARY KEY ("id")
);

-- Unique constraint + foreign keys
CREATE UNIQUE INDEX "favorite_practitioners_patient_id_practitioner_id_key" ON "favorite_practitioners"("patient_id", "practitioner_id");
ALTER TABLE "favorite_practitioners" ADD CONSTRAINT "favorite_practitioners_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "favorite_practitioners" ADD CONSTRAINT "favorite_practitioners_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 6. Seed default BookingSettings
-- ============================================

INSERT INTO "booking_settings" ("id", "updated_at")
VALUES (gen_random_uuid(), CURRENT_TIMESTAMP);
