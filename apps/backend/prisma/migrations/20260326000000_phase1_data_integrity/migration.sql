-- Phase 1: Data Integrity Fixes
-- Adds missing Foreign Keys, fixes cascade behavior, adds check constraints

-- ──────────────────────────────────────────────
-- 1. IntakeResponse.bookingId — Add FK
-- ──────────────────────────────────────────────
ALTER TABLE "intake_responses"
  ADD CONSTRAINT "intake_responses_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 2. WaitlistEntry.bookedBookingId — Add FK
-- ──────────────────────────────────────────────
ALTER TABLE "waitlist_entries"
  ADD CONSTRAINT "waitlist_entries_booked_booking_id_fkey"
  FOREIGN KEY ("booked_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 3. GiftCard.purchasedBy — Add FK
-- ──────────────────────────────────────────────
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_purchased_by_fkey"
  FOREIGN KEY ("purchased_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 4. GiftCard.redeemedBy — Add FK
-- ──────────────────────────────────────────────
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_redeemed_by_fkey"
  FOREIGN KEY ("redeemed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 5. CouponRedemption.userId — Add FK
-- ──────────────────────────────────────────────
ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 6. PractitionerService.serviceId — Change Cascade → Restrict
-- ──────────────────────────────────────────────
ALTER TABLE "practitioner_services"
  DROP CONSTRAINT IF EXISTS "practitioner_services_service_id_fkey";

ALTER TABLE "practitioner_services"
  ADD CONSTRAINT "practitioner_services_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────
-- 7. Check Constraints — Data Safety
-- ──────────────────────────────────────────────

-- Rating stars must be 1-5
ALTER TABLE "ratings"
  ADD CONSTRAINT "ratings_stars_range"
  CHECK ("stars" >= 1 AND "stars" <= 5);

-- Refund percent 0-100
ALTER TABLE "booking_settings"
  ADD CONSTRAINT "booking_settings_late_cancel_refund_percent_range"
  CHECK ("late_cancel_refund_percent" >= 0 AND "late_cancel_refund_percent" <= 100);

ALTER TABLE "booking_settings"
  ADD CONSTRAINT "booking_settings_no_show_refund_percent_range"
  CHECK ("no_show_refund_percent" >= 0 AND "no_show_refund_percent" <= 100);

-- Deposit percent 1-100
ALTER TABLE "services"
  ADD CONSTRAINT "services_deposit_percent_range"
  CHECK ("deposit_percent" >= 1 AND "deposit_percent" <= 100);

-- Practitioner experience non-negative
ALTER TABLE "practitioners"
  ADD CONSTRAINT "practitioners_experience_non_negative"
  CHECK ("experience" >= 0);
