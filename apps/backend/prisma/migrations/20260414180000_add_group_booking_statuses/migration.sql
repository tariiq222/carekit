-- Phase 3: Add group booking statuses to BookingStatus enum
-- PENDING_GROUP_FILL: booking reserved, waiting for min participants to be reached
-- AWAITING_PAYMENT:   min participants reached, client has 24h window to pay

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_GROUP_FILL';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'AWAITING_PAYMENT';
