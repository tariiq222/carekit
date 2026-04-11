-- Phase 5: Operational Stability — activity_logs_archive table
-- Mirror of activity_logs for rows older than 90 days.
-- CleanupService.archiveOldActivityLogs() uses INSERT ... SELECT + DELETE in one transaction.
-- ON CONFLICT (id) DO NOTHING ensures idempotency across retries.

CREATE TABLE IF NOT EXISTS "activity_logs_archive" (
  "id"          TEXT        NOT NULL,
  "user_id"     TEXT,
  "action"      TEXT        NOT NULL,
  "module"      TEXT        NOT NULL,
  "resource_id" TEXT,
  "description" TEXT,
  "old_values"  JSONB,
  "new_values"  JSONB,
  "ip_address"  TEXT,
  "user_agent"  TEXT,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "activity_logs_archive_pkey" PRIMARY KEY ("id")
);

-- Index for time-range queries in admin audit views
CREATE INDEX IF NOT EXISTS "activity_logs_archive_created_at_idx"
  ON "activity_logs_archive" ("created_at");

-- Index for filtering by user (audit trail lookups)
CREATE INDEX IF NOT EXISTS "activity_logs_archive_user_id_idx"
  ON "activity_logs_archive" ("user_id");
