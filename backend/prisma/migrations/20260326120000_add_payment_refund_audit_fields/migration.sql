-- Add refund audit fields to payments table
-- Captures when a refund was issued, by whom, and the reason for the refund.
-- These fields are populated in all refund paths: manual admin refund, no-show policy,
-- auto-cancellation timeout, and bank transfer rejection.

ALTER TABLE "payments"
  ADD COLUMN "refunded_at" TIMESTAMP(3),
  ADD COLUMN "refunded_by" TEXT,
  ADD COLUMN "refund_reason" TEXT;
