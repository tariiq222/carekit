DO $$ BEGIN
  CREATE TYPE "NotificationSenderActor" AS ENUM ('PLATFORM', 'TENANT', 'PLATFORM_FALLBACK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN IF NOT EXISTS "senderActor" "NotificationSenderActor" NOT NULL DEFAULT 'TENANT';
