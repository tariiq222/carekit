-- AlterTable
ALTER TABLE "license_config" ADD COLUMN "has_group_sessions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "license_config" ADD COLUMN "has_courses" BOOLEAN NOT NULL DEFAULT false;
