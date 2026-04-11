-- Migration: add_group_session_payment_flow
-- Description:
--   1. Adds `awaiting_payment` to group_session_status enum
--      (session reached minParticipants, waiting for payments before scheduling)
--   2. Adds `payment_requested` to group_enrollment_status enum
--      (admin triggered payment request, deadline clock running)
--   3. Adds deposit_percent column to group_sessions
--      (100 = full payment required, <100 = deposit/earnest money)

-- 1. Enum: group_session_status
ALTER TYPE "group_session_status" ADD VALUE 'awaiting_payment';

-- 2. Enum: group_enrollment_status
ALTER TYPE "group_enrollment_status" ADD VALUE 'payment_requested';

-- 3. Column: group_sessions.deposit_percent
ALTER TABLE "group_sessions" ADD COLUMN "deposit_percent" INT NOT NULL DEFAULT 100;
