-- Add missing notification type enum values
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_no_show';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_reminder';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_reminder_urgent';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'booking_cancellation_rejected';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'no_show_review';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'patient_arrived';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'receipt_rejected';
