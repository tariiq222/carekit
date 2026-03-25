-- M9: Add 'rejected' status to PaymentStatus enum
-- Rejected bank transfer receipts are now marked instead of deleted, preserving audit trail.
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'rejected';
