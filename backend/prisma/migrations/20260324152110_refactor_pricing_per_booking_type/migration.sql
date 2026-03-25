-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booked_duration" INTEGER,
ADD COLUMN     "booked_price" INTEGER,
ADD COLUMN     "duration_option_id" TEXT;

-- AlterTable
ALTER TABLE "service_duration_options" ADD COLUMN     "service_booking_type_id" TEXT;

-- CreateTable
CREATE TABLE "service_booking_types" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "booking_type" "booking_type" NOT NULL,
    "price" INTEGER NOT NULL,
    "duration" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_booking_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_service_types" (
    "id" TEXT NOT NULL,
    "practitioner_service_id" TEXT NOT NULL,
    "booking_type" "booking_type" NOT NULL,
    "price" INTEGER,
    "duration" INTEGER,
    "use_custom_options" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practitioner_duration_options" (
    "id" TEXT NOT NULL,
    "practitioner_service_type_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_ar" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "practitioner_duration_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_booking_types_service_id_idx" ON "service_booking_types"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_booking_types_service_id_booking_type_key" ON "service_booking_types"("service_id", "booking_type");

-- CreateIndex
CREATE INDEX "practitioner_service_types_practitioner_service_id_idx" ON "practitioner_service_types"("practitioner_service_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_service_types_practitioner_service_id_booking__key" ON "practitioner_service_types"("practitioner_service_id", "booking_type");

-- CreateIndex
CREATE INDEX "practitioner_duration_options_practitioner_service_type_id_idx" ON "practitioner_duration_options"("practitioner_service_type_id");

-- CreateIndex
CREATE INDEX "service_duration_options_service_booking_type_id_idx" ON "service_duration_options"("service_booking_type_id");

-- AddForeignKey
ALTER TABLE "service_duration_options" ADD CONSTRAINT "service_duration_options_service_booking_type_id_fkey" FOREIGN KEY ("service_booking_type_id") REFERENCES "service_booking_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_booking_types" ADD CONSTRAINT "service_booking_types_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_service_types" ADD CONSTRAINT "practitioner_service_types_practitioner_service_id_fkey" FOREIGN KEY ("practitioner_service_id") REFERENCES "practitioner_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_duration_options" ADD CONSTRAINT "practitioner_duration_options_practitioner_service_type_id_fkey" FOREIGN KEY ("practitioner_service_type_id") REFERENCES "practitioner_service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DATA MIGRATION: Populate new models from old data
-- ============================================

-- 1. For each Service, create ServiceBookingType for all 3 types using current price/duration
INSERT INTO "service_booking_types" ("id", "service_id", "booking_type", "price", "duration", "is_active", "updated_at")
SELECT gen_random_uuid(), s.id, 'clinic_visit', s.price, s.duration, true, NOW()
FROM "services" s WHERE s.deleted_at IS NULL;

INSERT INTO "service_booking_types" ("id", "service_id", "booking_type", "price", "duration", "is_active", "updated_at")
SELECT gen_random_uuid(), s.id, 'phone_consultation', s.price, s.duration, true, NOW()
FROM "services" s WHERE s.deleted_at IS NULL;

INSERT INTO "service_booking_types" ("id", "service_id", "booking_type", "price", "duration", "is_active", "updated_at")
SELECT gen_random_uuid(), s.id, 'video_consultation', s.price, s.duration, true, NOW()
FROM "services" s WHERE s.deleted_at IS NULL;

-- 2. Link existing ServiceDurationOptions to the clinic_visit ServiceBookingType
UPDATE "service_duration_options" sdo
SET "service_booking_type_id" = sbt.id
FROM "service_booking_types" sbt
WHERE sbt.service_id = sdo.service_id
  AND sbt.booking_type = 'clinic_visit';

-- 3. For each PractitionerService, create PractitionerServiceType for each available type
-- We need to unnest the available_types array
INSERT INTO "practitioner_service_types" ("id", "practitioner_service_id", "booking_type", "price", "duration", "use_custom_options", "is_active", "updated_at")
SELECT
  gen_random_uuid(),
  ps.id,
  bt::booking_type,
  CASE bt::text
    WHEN 'clinic_visit' THEN ps.price_clinic
    WHEN 'phone_consultation' THEN ps.price_phone
    WHEN 'video_consultation' THEN ps.price_video
    ELSE NULL
  END,
  ps.custom_duration,
  false,
  ps.is_active,
  NOW()
FROM "practitioner_services" ps, unnest(ps.available_types) AS bt;

-- 4. Backfill booked_price and booked_duration on existing bookings
UPDATE "bookings" b
SET
  "booked_duration" = COALESCE(ps.custom_duration, s.duration),
  "booked_price" = CASE b.type
    WHEN 'clinic_visit' THEN COALESCE(ps.price_clinic, s.price)
    WHEN 'walk_in' THEN COALESCE(ps.price_clinic, s.price)
    WHEN 'phone_consultation' THEN COALESCE(ps.price_phone, s.price)
    WHEN 'video_consultation' THEN COALESCE(ps.price_video, s.price)
    ELSE s.price
  END
FROM "practitioner_services" ps, "services" s
WHERE b.practitioner_service_id = ps.id
  AND b.service_id = s.id
  AND b.booked_price IS NULL;
