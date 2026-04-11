-- Phase 7: Data Integrity Fixes (Audit-Driven)
-- Applies all fixes identified in the schema integrity audit.
-- Grouped by priority: P0 (critical) → P1 → P2 → P3.

-- ─────────────────────────────────────────────────────────────
-- P0-1: Anti-double-booking partial unique index
-- Prevents two active bookings for the same practitioner at the
-- same date + start_time. Excludes terminal statuses.
-- Application-layer SERIALIZABLE transaction remains as defence-in-depth.
-- ─────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_no_double_booking_idx"
  ON "bookings" ("practitioner_id", "date", "start_time")
  WHERE "status" NOT IN ('cancelled', 'expired', 'no_show');

-- ─────────────────────────────────────────────────────────────
-- P0-2: ZATCA Invoice — drop Cascade, add Restrict on payment FK
-- Invoices are legally immutable (Saudi e-invoicing law).
-- Deleting a payment must NOT cascade to the invoice.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "invoices"
  DROP CONSTRAINT IF EXISTS "invoices_payment_id_fkey";

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- P1-1: CouponRedemption.booking_id — add FK
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- P1-2: GiftCardTransaction.booking_id — add FK
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "gift_card_transactions"
  ADD CONSTRAINT "gift_card_transactions_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- P1-3: IntakeResponse.patient_id — add FK
-- Made nullable to match schema (patientId String? after fix).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "intake_responses"
  ALTER COLUMN "patient_id" DROP NOT NULL;

ALTER TABLE "intake_responses"
  ADD CONSTRAINT "intake_responses_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- P1-4: GiftCard.balance — non-negative CHECK
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_balance_non_negative"
  CHECK ("balance" >= 0);

-- ─────────────────────────────────────────────────────────────
-- P2-1: BookingStatusLog — convert from_status / to_status TEXT → booking_status enum
-- Existing rows: any value not in the enum is coerced to NULL for from_status,
-- and raises on to_status (but all existing values should be valid enum members).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "booking_status_logs"
  ALTER COLUMN "from_status" TYPE "booking_status"
  USING CASE
    WHEN "from_status" IN (
      'pending','confirmed','checked_in','in_progress',
      'completed','cancelled','pending_cancellation','no_show','expired'
    ) THEN "from_status"::"booking_status"
    ELSE NULL
  END;

ALTER TABLE "booking_status_logs"
  ALTER COLUMN "to_status" TYPE "booking_status"
  USING "to_status"::"booking_status";

-- ─────────────────────────────────────────────────────────────
-- P2-2: ClinicWorkingHours — add branch_id column + FK
-- Drop old @@unique([day_of_week]) and replace with ([day_of_week, branch_id]).
-- NULL branch_id = global (all branches). Non-null = branch-specific.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "clinic_working_hours"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "clinic_working_hours"
  ADD CONSTRAINT "clinic_working_hours_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old single-column unique index
DROP INDEX IF EXISTS "clinic_working_hours_day_of_week_key";

-- New composite unique: one row per (day, branch) — NULL branch = global
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_working_hours_day_branch_idx"
  ON "clinic_working_hours" ("day_of_week", "branch_id");

CREATE INDEX IF NOT EXISTS "clinic_working_hours_branch_id_idx"
  ON "clinic_working_hours" ("branch_id");

-- ─────────────────────────────────────────────────────────────
-- P2-3: ClinicHoliday — add branch_id column + FK
-- Drop old @@unique([date]) and replace with ([date, branch_id]).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "clinic_holidays"
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "clinic_holidays"
  ADD CONSTRAINT "clinic_holidays_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old single-column unique index
DROP INDEX IF EXISTS "clinic_holidays_date_key";

-- New composite unique
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_holidays_date_branch_idx"
  ON "clinic_holidays" ("date", "branch_id");

CREATE INDEX IF NOT EXISTS "clinic_holidays_branch_id_idx"
  ON "clinic_holidays" ("branch_id");

-- ─────────────────────────────────────────────────────────────
-- P2-4: Restore bookings_service_id_idx
-- Was created in migration 20260326070000 then accidentally dropped in 20260326080000.
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_service_id_idx"
  ON "bookings" ("service_id");

-- ─────────────────────────────────────────────────────────────
-- P3-1: KnowledgeBase.file_id — add FK to knowledge_base_files
-- Allows SET NULL on file delete so orphan chunks are surfaced,
-- not silently left with a dangling UUID.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "knowledge_base"
  ADD CONSTRAINT "knowledge_base_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "knowledge_base_files"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- P3-2: Notifications — add created_at index for cleanup queries
-- ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx"
  ON "notifications" ("created_at");
