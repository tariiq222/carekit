-- AlterTable
ALTER TABLE "services" ADD COLUMN     "allowed_recurring_patterns" "recurring_pattern"[] DEFAULT ARRAY[]::"recurring_pattern"[],
ADD COLUMN     "max_recurrences" INTEGER NOT NULL DEFAULT 12;
