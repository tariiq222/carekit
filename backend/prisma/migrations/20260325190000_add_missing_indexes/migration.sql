-- H9: Composite index on OtpCode for atomic OTP verification queries
-- Covers: userId + type + usedAt filter (used in updateMany atomic claim)
CREATE INDEX IF NOT EXISTS "otp_codes_user_id_type_used_at_idx" ON "otp_codes"("user_id", "type", "used_at");

-- H10: Add isActive to PractitionerAvailability composite index
-- Covers: practitionerId + dayOfWeek + isActive filter in availability lookups
DROP INDEX IF EXISTS "practitioner_availabilities_practitioner_id_day_of_week_idx";
CREATE INDEX IF NOT EXISTS "practitioner_availabilities_practitioner_id_day_of_week_is_active_idx" ON "practitioner_availabilities"("practitioner_id", "day_of_week", "is_active");

-- RefreshToken: index on expiresAt for scheduled cleanup jobs
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");
