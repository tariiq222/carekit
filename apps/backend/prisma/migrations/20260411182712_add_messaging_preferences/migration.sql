-- Migration: add_messaging_preferences
-- Created: Sat Apr 11 18:27:12 +03 2026

CREATE TABLE "messaging_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "categories" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "messaging_preferences_user_id_key" ON "messaging_preferences"("user_id");

CREATE INDEX "messaging_preferences_user_id_idx" ON "messaging_preferences"("user_id");

ALTER TABLE "messaging_preferences" ADD CONSTRAINT "messaging_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

