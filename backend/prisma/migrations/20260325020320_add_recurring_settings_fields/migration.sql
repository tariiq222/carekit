-- AlterTable
ALTER TABLE "booking_settings" ADD COLUMN     "allowed_recurring_patterns" "recurring_pattern"[] DEFAULT ARRAY['weekly', 'biweekly']::"recurring_pattern"[],
ADD COLUMN     "max_recurrences" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "max_recurring_weeks" INTEGER NOT NULL DEFAULT 12;
