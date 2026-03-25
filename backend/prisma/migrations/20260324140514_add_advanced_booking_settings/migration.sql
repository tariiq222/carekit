-- AlterTable
ALTER TABLE "booking_settings" ADD COLUMN     "admin_can_book_outside_hours" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "min_booking_lead_minutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "allow_recurring" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "calendar_color" TEXT,
ADD COLUMN     "deposit_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deposit_percent" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "hide_duration_on_booking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hide_price_on_booking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_advance_days" INTEGER,
ADD COLUMN     "max_participants" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "min_lead_minutes" INTEGER;

-- CreateTable
CREATE TABLE "practitioner_breaks" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practitioner_breaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_duration_options" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_ar" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_duration_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_forms" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "title_ar" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intake_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_fields" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "label_ar" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "intake_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_responses" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_working_hours" (
    "id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_working_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinic_holidays" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description_ar" TEXT,
    "description_en" TEXT,
    "discount_type" TEXT NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "min_amount" INTEGER NOT NULL DEFAULT 0,
    "max_uses" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "max_uses_per_user" INTEGER,
    "service_ids" TEXT[],
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_cards" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initial_amount" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "purchased_by" TEXT,
    "redeemed_by" TEXT,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gift_card_transactions" (
    "id" TEXT NOT NULL,
    "gift_card_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "booking_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practitioner_breaks_practitioner_id_day_of_week_idx" ON "practitioner_breaks"("practitioner_id", "day_of_week");

-- CreateIndex
CREATE INDEX "service_duration_options_service_id_idx" ON "service_duration_options"("service_id");

-- CreateIndex
CREATE INDEX "intake_forms_service_id_idx" ON "intake_forms"("service_id");

-- CreateIndex
CREATE INDEX "intake_fields_form_id_idx" ON "intake_fields"("form_id");

-- CreateIndex
CREATE INDEX "intake_responses_form_id_idx" ON "intake_responses"("form_id");

-- CreateIndex
CREATE INDEX "intake_responses_booking_id_idx" ON "intake_responses"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_working_hours_day_of_week_key" ON "clinic_working_hours"("day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "clinic_holidays_date_key" ON "clinic_holidays"("date");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_idx" ON "coupon_redemptions"("coupon_id");

-- CreateIndex
CREATE INDEX "coupon_redemptions_user_id_idx" ON "coupon_redemptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gift_cards_code_key" ON "gift_cards"("code");

-- CreateIndex
CREATE INDEX "gift_card_transactions_gift_card_id_idx" ON "gift_card_transactions"("gift_card_id");

-- AddForeignKey
ALTER TABLE "practitioner_breaks" ADD CONSTRAINT "practitioner_breaks_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_duration_options" ADD CONSTRAINT "service_duration_options_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_forms" ADD CONSTRAINT "intake_forms_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_fields" ADD CONSTRAINT "intake_fields_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "intake_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "intake_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
