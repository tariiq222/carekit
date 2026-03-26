-- CreateEnum
CREATE TYPE "preferred_time" AS ENUM ('morning', 'afternoon', 'evening', 'any');

-- AlterEnum
BEGIN;
CREATE TYPE "account_type_new" AS ENUM ('FULL', 'WALK_IN');
ALTER TABLE "public"."users" ALTER COLUMN "account_type" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "account_type" TYPE "account_type_new" USING ("account_type"::text::"account_type_new");
ALTER TYPE "account_type" RENAME TO "account_type_old";
ALTER TYPE "account_type_new" RENAME TO "account_type";
DROP TYPE "public"."account_type_old";
ALTER TABLE "users" ALTER COLUMN "account_type" SET DEFAULT 'FULL';
COMMIT;

-- AlterEnum
ALTER TYPE "payment_method" ADD VALUE 'cash';

-- DropForeignKey
ALTER TABLE "booking_settings" DROP CONSTRAINT "booking_settings_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "practitioner_availabilities" DROP CONSTRAINT "practitioner_availabilities_branch_id_fkey";

-- DropIndex
DROP INDEX "booking_settings_branch_id_idx";

-- DropIndex
DROP INDEX "bookings_service_id_idx";

-- DropIndex
DROP INDEX "practitioner_availabilities_practitioner_id_day_of_week_is__idx";

-- AlterTable
ALTER TABLE "coupon_services" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "service_ids";

-- AlterTable
ALTER TABLE "practitioners" ADD COLUMN     "specialty_id" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "account_type" SET DEFAULT 'FULL';

-- AlterTable
ALTER TABLE "waitlist_entries" DROP COLUMN "preferred_time",
ADD COLUMN     "preferred_time" "preferred_time";

-- DropTable
DROP TABLE "activity_logs_archive";

-- CreateTable
CREATE TABLE "specialties" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "description_en" TEXT,
    "description_ar" TEXT,
    "icon_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "specialties_name_en_key" ON "specialties"("name_en");

-- CreateIndex
CREATE INDEX "specialties_is_active_sort_order_idx" ON "specialties"("is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "booking_settings" ADD CONSTRAINT "booking_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioners" ADD CONSTRAINT "practitioners_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_availabilities" ADD CONSTRAINT "practitioner_availabilities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "practitioner_availabilities_pract_day_active_branch_idx" RENAME TO "practitioner_availabilities_practitioner_id_day_of_week_is__idx";
