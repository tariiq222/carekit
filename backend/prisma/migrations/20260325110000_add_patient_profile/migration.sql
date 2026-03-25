-- CreateEnum
CREATE TYPE "blood_type" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateTable
CREATE TABLE "patient_profiles" (
  "id"                   TEXT NOT NULL,
  "user_id"              TEXT NOT NULL,
  "national_id"          TEXT,
  "nationality"          TEXT,
  "date_of_birth"        TIMESTAMP(3),
  "emergency_name"       TEXT,
  "emergency_phone"      TEXT,
  "blood_type"           "blood_type",
  "allergies"            TEXT,
  "chronic_conditions"   TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           TIMESTAMP(3) NOT NULL,

  CONSTRAINT "patient_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patient_profiles_user_id_key" ON "patient_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "patient_profiles"
  ADD CONSTRAINT "patient_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
