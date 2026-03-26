-- Phase 2: Performance — Missing Indexes
-- Target tables: bookings, services, invoices, practitioner_vacations
-- Note: CONCURRENTLY removed — not supported inside Prisma shadow DB transactions.
-- In production, apply these manually with CONCURRENTLY if table is large.

-- ──────────────────────────────────────────────
-- bookings: (status, date) — dashboard "اليوم بحالة معينة"
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_status_date_idx"
  ON "bookings" ("status", "date");

-- ──────────────────────────────────────────────
-- bookings: (practitioner_id, status) — "حجوزات طبيب بحالة"
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_practitioner_id_status_idx"
  ON "bookings" ("practitioner_id", "status");

-- ──────────────────────────────────────────────
-- bookings: (created_at) — reports على نطاق زمني
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "bookings_created_at_idx"
  ON "bookings" ("created_at");

-- ──────────────────────────────────────────────
-- services: (is_active, deleted_at) — listing الخدمات النشطة
-- كل query تفلتر WHERE is_active=true AND deleted_at IS NULL
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "services_is_active_deleted_at_idx"
  ON "services" ("is_active", "deleted_at");

-- ──────────────────────────────────────────────
-- invoices: (zatca_status) — ZATCA sync job
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "invoices_zatca_status_idx"
  ON "invoices" ("zatca_status");

-- ──────────────────────────────────────────────
-- practitioner_vacations: (start_date, end_date)
-- availability check يقرأ نطاق تواريخ
-- ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "practitioner_vacations_start_date_end_date_idx"
  ON "practitioner_vacations" ("start_date", "end_date");
