-- Add new values to problem_report_type enum
ALTER TYPE "problem_report_type" ADD VALUE IF NOT EXISTS 'wait_time';
ALTER TYPE "problem_report_type" ADD VALUE IF NOT EXISTS 'staff_behavior';
ALTER TYPE "problem_report_type" ADD VALUE IF NOT EXISTS 'cleanliness';
ALTER TYPE "problem_report_type" ADD VALUE IF NOT EXISTS 'billing';

-- Replace problem_report_status enum: open, in_review, resolved, dismissed
-- (was: open, reviewing, resolved)
ALTER TYPE "problem_report_status" ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE "problem_report_status" ADD VALUE IF NOT EXISTS 'dismissed';

-- Add admin_notes column to problem_reports
ALTER TABLE "problem_reports" ADD COLUMN IF NOT EXISTS "admin_notes" TEXT;

-- Make description NOT NULL (set existing nulls to empty string first)
UPDATE "problem_reports" SET "description" = '' WHERE "description" IS NULL;
ALTER TABLE "problem_reports" ALTER COLUMN "description" SET NOT NULL;

-- Add patient_id index (was missing)
CREATE INDEX IF NOT EXISTS "problem_reports_patient_id_idx" ON "problem_reports"("patient_id");
