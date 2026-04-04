-- Widget Settings — 4 new columns on booking_settings
-- widgetShowPrice, widgetAnyPractitioner, widgetCalendarStartMonth, widgetRedirectUrl

ALTER TABLE "booking_settings"
  ADD COLUMN IF NOT EXISTS "widget_show_price"            BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "widget_any_practitioner"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "widget_redirect_url"          TEXT;
