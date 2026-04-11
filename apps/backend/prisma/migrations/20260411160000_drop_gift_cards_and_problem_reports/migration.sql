-- Drop gift-cards and problem-reports features
-- Removes tables, enums, and the license.has_gift_cards column.
-- Features will be re-implemented in the future.

-- ─── Problem Reports ─────────────────────────────────────────
DROP TABLE IF EXISTS "problem_reports" CASCADE;
DROP TYPE IF EXISTS "problem_report_type";
DROP TYPE IF EXISTS "problem_report_status";

-- ─── Gift Cards ──────────────────────────────────────────────
DROP TABLE IF EXISTS "gift_card_transactions" CASCADE;
DROP TABLE IF EXISTS "gift_cards" CASCADE;

-- ─── License flag ────────────────────────────────────────────
ALTER TABLE "license_config" DROP COLUMN IF EXISTS "has_gift_cards";

-- ─── Notification type enum ──────────────────────────────────
-- Postgres does not support removing enum values directly; the
-- safe path is to rebuild the enum. We skip dropping the
-- 'problem_report' value to avoid breaking historical rows in
-- the notifications table. Old rows remain valid; new code no
-- longer emits this value.
