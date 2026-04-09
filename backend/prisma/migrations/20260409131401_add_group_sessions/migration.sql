-- CreateEnum
CREATE TYPE "group_session_status" AS ENUM ('open', 'confirmed', 'full', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "group_enrollment_status" AS ENUM ('registered', 'confirmed', 'attended', 'expired', 'cancelled');

-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'group_enrollment_created';
ALTER TYPE "notification_type" ADD VALUE 'group_session_confirmed';
ALTER TYPE "notification_type" ADD VALUE 'group_payment_confirmed';
ALTER TYPE "notification_type" ADD VALUE 'group_enrollment_expired';
ALTER TYPE "notification_type" ADD VALUE 'group_session_cancelled';
ALTER TYPE "notification_type" ADD VALUE 'group_session_cancelled_admin';
ALTER TYPE "notification_type" ADD VALUE 'group_session_reminder';

-- CreateTable
CREATE TABLE "group_offerings" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "min_participants" INTEGER NOT NULL,
    "max_participants" INTEGER NOT NULL,
    "price_per_person_halalat" INTEGER NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "payment_deadline_hours" INTEGER NOT NULL DEFAULT 48,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "group_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_sessions" (
    "id" TEXT NOT NULL,
    "group_offering_id" TEXT NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "status" "group_session_status" NOT NULL DEFAULT 'open',
    "current_enrollment" INTEGER NOT NULL DEFAULT 0,
    "registration_deadline" TIMESTAMP(3) NOT NULL,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_enrollments" (
    "id" TEXT NOT NULL,
    "group_session_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "status" "group_enrollment_status" NOT NULL DEFAULT 'registered',
    "payment_deadline_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_offerings_practitioner_id_idx" ON "group_offerings"("practitioner_id");

-- CreateIndex
CREATE INDEX "group_sessions_group_offering_id_status_idx" ON "group_sessions"("group_offering_id", "status");

-- CreateIndex
CREATE INDEX "group_sessions_status_registration_deadline_idx" ON "group_sessions"("status", "registration_deadline");

-- CreateIndex
CREATE UNIQUE INDEX "group_enrollments_payment_id_key" ON "group_enrollments"("payment_id");

-- CreateIndex
CREATE INDEX "group_enrollments_status_payment_deadline_at_idx" ON "group_enrollments"("status", "payment_deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "group_enrollments_group_session_id_patient_id_key" ON "group_enrollments"("group_session_id", "patient_id");

-- AddForeignKey
ALTER TABLE "group_offerings" ADD CONSTRAINT "group_offerings_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_group_offering_id_fkey" FOREIGN KEY ("group_offering_id") REFERENCES "group_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_enrollments" ADD CONSTRAINT "group_enrollments_group_session_id_fkey" FOREIGN KEY ("group_session_id") REFERENCES "group_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_enrollments" ADD CONSTRAINT "group_enrollments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_enrollments" ADD CONSTRAINT "group_enrollments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
