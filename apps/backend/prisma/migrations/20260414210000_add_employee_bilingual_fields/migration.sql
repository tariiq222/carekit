-- Add bilingual & profile fields to Employee for onboarding flow.
-- These fields support the dashboard's bilingual employee form (EN/AR)
-- and extended profile (title, specialty, experience, education).

ALTER TABLE "Employee"
  ADD COLUMN "nameEn"      TEXT,
  ADD COLUMN "nameAr"      TEXT,
  ADD COLUMN "title"       TEXT,
  ADD COLUMN "specialty"   TEXT,
  ADD COLUMN "specialtyAr" TEXT,
  ADD COLUMN "bioAr"       TEXT,
  ADD COLUMN "education"   TEXT,
  ADD COLUMN "educationAr" TEXT,
  ADD COLUMN "experience"  INTEGER;
