-- Migration: fix_clinic_working_hours_fk
-- Fix: branch_id FK on clinic_working_hours was CASCADE — should be SET NULL.
-- Deleting a branch must preserve its working hours as global fallback (branch_id = NULL),
-- not wipe the clinic schedule.

ALTER TABLE "clinic_working_hours"
  DROP CONSTRAINT IF EXISTS "clinic_working_hours_branch_id_fkey";

ALTER TABLE "clinic_working_hours"
  ADD CONSTRAINT "clinic_working_hours_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
