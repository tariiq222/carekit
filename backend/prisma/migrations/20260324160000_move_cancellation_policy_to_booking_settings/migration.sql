-- Move cancellation policy text from WhiteLabelConfig (key-value) to BookingSettings (structured)
-- Also removes dead keys: allow_patient_cancellation, cancel_before_hours, auto_refund_on_cancel

-- Step 1: Add new columns to booking_settings
ALTER TABLE "booking_settings"
ADD COLUMN "cancellation_policy_en" TEXT NOT NULL DEFAULT '',
ADD COLUMN "cancellation_policy_ar" TEXT NOT NULL DEFAULT '';

-- Step 2: Migrate existing data from white_label_config to booking_settings
UPDATE "booking_settings" SET
  "cancellation_policy_en" = COALESCE(
    (SELECT "value" FROM "white_label_config" WHERE "key" = 'cancellation_policy' LIMIT 1),
    ''
  ),
  "cancellation_policy_ar" = COALESCE(
    (SELECT "value" FROM "white_label_config" WHERE "key" = 'cancellation_policy_ar' LIMIT 1),
    ''
  );

-- Step 3: Remove dead/migrated keys from white_label_config
DELETE FROM "white_label_config" WHERE "key" IN (
  'allow_patient_cancellation',
  'cancel_before_hours',
  'auto_refund_on_cancel',
  'cancellation_policy',
  'cancellation_policy_ar',
  'cancellation_policy_en'
);
