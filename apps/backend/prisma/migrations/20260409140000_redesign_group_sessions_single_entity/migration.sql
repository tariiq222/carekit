-- Redesign group sessions from two-table model (GroupOffering + GroupSession)
-- to single-entity model (GroupSession only) — v2 schema

-- CreateEnum
CREATE TYPE "group_session_scheduling_mode" AS ENUM ('fixed_date', 'on_capacity');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'group_capacity_reached';

-- DropForeignKey
ALTER TABLE "group_offerings" DROP CONSTRAINT "group_offerings_practitioner_id_fkey";

-- DropForeignKey
ALTER TABLE "group_sessions" DROP CONSTRAINT "group_sessions_group_offering_id_fkey";

-- DropIndex
DROP INDEX "group_sessions_group_offering_id_status_idx";

-- DropIndex
DROP INDEX "group_sessions_status_registration_deadline_idx";

-- AlterTable
ALTER TABLE "group_sessions" DROP COLUMN "group_offering_id",
DROP COLUMN "registration_deadline",
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "description_ar" TEXT,
ADD COLUMN     "description_en" TEXT,
ADD COLUMN     "duration_minutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_participants" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "min_participants" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "name_ar" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name_en" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "payment_deadline_hours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "practitioner_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "price_per_person_halalat" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scheduling_mode" "group_session_scheduling_mode" NOT NULL DEFAULT 'fixed_date',
ALTER COLUMN "start_time" DROP NOT NULL,
ALTER COLUMN "end_time" DROP NOT NULL;

-- Remove defaults that were only needed for migration
ALTER TABLE "group_sessions"
  ALTER COLUMN "duration_minutes" DROP DEFAULT,
  ALTER COLUMN "max_participants" DROP DEFAULT,
  ALTER COLUMN "min_participants" DROP DEFAULT,
  ALTER COLUMN "name_ar" DROP DEFAULT,
  ALTER COLUMN "name_en" DROP DEFAULT,
  ALTER COLUMN "practitioner_id" DROP DEFAULT,
  ALTER COLUMN "price_per_person_halalat" DROP DEFAULT,
  ALTER COLUMN "scheduling_mode" DROP DEFAULT;

-- DropTable
DROP TABLE "group_offerings";

-- CreateIndex
CREATE INDEX "group_sessions_practitioner_id_status_idx" ON "group_sessions"("practitioner_id", "status");

-- CreateIndex
CREATE INDEX "group_sessions_status_expires_at_idx" ON "group_sessions"("status", "expires_at");

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
