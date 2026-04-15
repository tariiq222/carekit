-- Phase 5: Add PAYMENT_REMINDER to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_REMINDER';
