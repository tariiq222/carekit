-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('draft', 'published', 'in_progress', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "course_session_status" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "course_enrollment_status" AS ENUM ('enrolled', 'active', 'completed', 'dropped', 'refunded');

-- CreateEnum
CREATE TYPE "course_frequency" AS ENUM ('weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "delivery_mode" AS ENUM ('in_person', 'online', 'hybrid');

-- AlterEnum: add course notification types
ALTER TYPE "notification_type" ADD VALUE 'course_enrolled';
ALTER TYPE "notification_type" ADD VALUE 'course_session_reminder';
ALTER TYPE "notification_type" ADD VALUE 'course_cancelled';
ALTER TYPE "notification_type" ADD VALUE 'course_completed';
ALTER TYPE "notification_type" ADD VALUE 'course_attendance_marked';

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "practitioner_id" TEXT NOT NULL,
    "department_id" TEXT,
    "total_sessions" INTEGER NOT NULL,
    "duration_per_session_min" INTEGER NOT NULL,
    "frequency" "course_frequency" NOT NULL,
    "price_halalat" INTEGER NOT NULL DEFAULT 0,
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "max_participants" INTEGER,
    "delivery_mode" "delivery_mode" NOT NULL DEFAULT 'in_person',
    "location" TEXT,
    "status" "course_status" NOT NULL DEFAULT 'draft',
    "start_date" TIMESTAMP(3) NOT NULL,
    "current_enrollment" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sessions" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "session_number" INTEGER NOT NULL,
    "title_ar" TEXT,
    "title_en" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "course_session_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_enrollments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "status" "course_enrollment_status" NOT NULL DEFAULT 'enrolled',
    "sessions_attended" INTEGER NOT NULL DEFAULT 0,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_payments" (
    "id" TEXT NOT NULL,
    "enrollment_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "moyasar_payment_id" TEXT,
    "transaction_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "refund_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "courses_practitioner_id_status_idx" ON "courses"("practitioner_id", "status");

-- CreateIndex
CREATE INDEX "courses_status_start_date_idx" ON "courses"("status", "start_date");

-- CreateIndex
CREATE INDEX "courses_deleted_at_idx" ON "courses"("deleted_at");

-- CreateIndex
CREATE INDEX "course_sessions_course_id_status_idx" ON "course_sessions"("course_id", "status");

-- CreateIndex
CREATE INDEX "course_sessions_scheduled_at_idx" ON "course_sessions"("scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_sessions_course_id_session_number_key" ON "course_sessions"("course_id", "session_number");

-- CreateIndex
CREATE INDEX "course_enrollments_course_id_status_idx" ON "course_enrollments"("course_id", "status");

-- CreateIndex
CREATE INDEX "course_enrollments_patient_id_idx" ON "course_enrollments"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_enrollments_course_id_patient_id_key" ON "course_enrollments"("course_id", "patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_payments_enrollment_id_key" ON "course_payments"("enrollment_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_payments_moyasar_payment_id_key" ON "course_payments"("moyasar_payment_id");

-- CreateIndex
CREATE INDEX "course_payments_status_idx" ON "course_payments"("status");

-- CreateIndex
CREATE INDEX "course_payments_course_id_idx" ON "course_payments"("course_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sessions" ADD CONSTRAINT "course_sessions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_payments" ADD CONSTRAINT "course_payments_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "course_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_payments" ADD CONSTRAINT "course_payments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
