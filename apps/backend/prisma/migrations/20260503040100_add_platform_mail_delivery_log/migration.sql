-- Migration: add_platform_mail_delivery_log
-- Adds PlatformMailDeliveryLog table for audit + retry tracking of platform-level emails
-- (welcome, trial reminders, payment success/failure, suspension, plan changes).
-- Intentionally NOT tenant-scoped (no organizationId column) — these are Deqah-side mails,
-- not tenant data. See SCOPED_MODELS in apps/backend/src/infrastructure/database/prisma.service.ts.
-- Note: duplicate of 20260503030000 (timestamp collision). Using IF NOT EXISTS guards for idempotency.

CREATE TABLE IF NOT EXISTS "PlatformMailDeliveryLog" (
    "id"           TEXT NOT NULL,
    "recipient"    TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "attempt"      INTEGER NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL,
    "errorMessage" TEXT,
    "jobId"        TEXT,
    "sentAt"       TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMailDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: (status, createdAt) — sweep failed/queued rows
CREATE INDEX IF NOT EXISTS "PlatformMailDeliveryLog_status_createdAt_idx"
    ON "PlatformMailDeliveryLog"("status", "createdAt");

-- CreateIndex: recipient — debug per-mailbox dispatch history
CREATE INDEX IF NOT EXISTS "PlatformMailDeliveryLog_recipient_idx"
    ON "PlatformMailDeliveryLog"("recipient");
