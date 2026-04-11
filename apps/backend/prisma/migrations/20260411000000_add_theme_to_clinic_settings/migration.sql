-- AlterTable
ALTER TABLE "clinic_settings" ADD COLUMN IF NOT EXISTS "theme" JSONB DEFAULT NULL;

COMMENT ON COLUMN "clinic_settings"."theme" IS 'ClinicTheme JSON — null = use DEFAULT_THEME';
