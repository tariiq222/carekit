-- CreateEnum
CREATE TYPE "recurring_pattern" AS ENUM ('daily', 'every_2_days', 'every_3_days', 'weekly', 'biweekly', 'monthly');

-- AlterTable
ALTER TABLE "booking_settings" ADD COLUMN     "allowed_recurring_patterns" "recurring_pattern"[] DEFAULT ARRAY['weekly', 'biweekly']::"recurring_pattern"[],
ADD COLUMN     "max_recurrences" INTEGER NOT NULL DEFAULT 12;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "recurring_pattern" "recurring_pattern";
