-- Missing DB Constraints — 4 fixes
-- 1. Payment: totalAmount = amount + vatAmount
-- 2. WaitlistEntry.preferredTime enum via CHECK
-- 3. Booking: bookedPrice/bookedDuration NOT NULL after confirmation (partial CHECK)
-- 4. OtpCode: usedAt must be <= expiresAt when set
-- 5. Bonus: index on bookings(service_id) for admin dashboard queries

-- ─────────────────────────────────────────────
-- 1. Payment totals integrity
-- ─────────────────────────────────────────────
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_total_amount_check"
  CHECK ("total_amount" = "amount" + "vat_amount");

-- ─────────────────────────────────────────────
-- 2. WaitlistEntry.preferredTime valid values
-- ─────────────────────────────────────────────
ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_preferred_time_check"
  CHECK (
    "preferred_time" IS NULL
    OR "preferred_time" IN ('morning', 'afternoon', 'evening', 'any')
  );

-- ─────────────────────────────────────────────
-- 3. Booking: bookedPrice and bookedDuration
--    must be set once booking is confirmed
--    (partial constraint — only enforces on non-pending, non-expired, non-cancelled)
-- ─────────────────────────────────────────────
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_snapshot_required_check"
  CHECK (
    "status" IN ('pending', 'expired', 'cancelled')
    OR (
      "booked_price" IS NOT NULL
      AND "booked_duration" IS NOT NULL
    )
  );

-- ─────────────────────────────────────────────
-- 4. OtpCode: usedAt must not exceed expiresAt
-- ─────────────────────────────────────────────
ALTER TABLE "otp_codes"
  ADD CONSTRAINT "otp_codes_used_at_check"
  CHECK (
    "used_at" IS NULL
    OR "used_at" <= "expires_at"
  );

-- ─────────────────────────────────────────────
-- 5. Bonus: index on bookings(service_id)
--    for admin dashboard service-based queries
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_service_id_idx"
  ON "bookings" ("service_id");
