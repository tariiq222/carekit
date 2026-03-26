-- Restore activity_logs_archive after it was accidentally dropped by a later migration.
-- This keeps CleanupService.archiveOldActivityLogs() operational in production.

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

CREATE INDEX IF NOT EXISTS "activity_logs_archive_created_at_idx"
  ON "activity_logs_archive" ("created_at");

CREATE INDEX IF NOT EXISTS "activity_logs_archive_user_id_idx"
  ON "activity_logs_archive" ("user_id");
