-- AddColumn payment_moyasar_enabled
ALTER TABLE "booking_settings" ADD COLUMN "payment_moyasar_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn payment_at_clinic_enabled
ALTER TABLE "booking_settings" ADD COLUMN "payment_at_clinic_enabled" BOOLEAN NOT NULL DEFAULT true;
