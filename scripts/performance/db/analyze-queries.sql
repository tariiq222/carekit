-- ============================================================
-- CareKit — Critical Query Analysis
-- Run against a populated DB (staging or prod replica).
-- Usage: psql $DATABASE_URL -f analyze-queries.sql
-- ============================================================

-- ============================================================
-- QUERY: Booking list (admin dashboard — filtered + paginated)
-- EXPECTED: p95 < 50ms on 100k rows
-- INDEXES USED: bookings_branch_id_date_idx, bookings_status_date_idx,
--               bookings_practitioner_id_date_idx
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.id,
  b.status,
  b.type,
  b.date,
  b.start_time,
  b.end_time,
  b.booked_price,
  b.is_walk_in,
  b.created_at,
  -- patient name from join
  u.first_name AS patient_first_name,
  u.last_name  AS patient_last_name,
  -- practitioner name from join
  pu.first_name AS prac_first_name,
  pu.last_name  AS prac_last_name
FROM bookings b
LEFT JOIN users u  ON u.id = b.patient_id
JOIN practitioners p ON p.id = b.practitioner_id
JOIN users pu       ON pu.id = p.user_id
WHERE b.deleted_at IS NULL
  AND b.branch_id  = 'BRANCH_UUID_PLACEHOLDER'   -- replace with real UUID
  AND b.date       >= '2026-03-01 00:00:00'
  AND b.date       <  '2026-04-01 00:00:00'
  AND b.status     = 'confirmed'
ORDER BY b.created_at DESC
LIMIT 20 OFFSET 0;


-- ============================================================
-- QUERY: Patient search (name + phone, paginated)
-- EXPECTED: p95 < 80ms (ILIKE triggers seq scan — see index note)
-- INDEXES USED: users_email_key, users_phone_key (for exact match)
-- NOTE: Full-text or pg_trgm index needed for substring search
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  u.id,
  u.first_name,
  u.last_name,
  u.phone,
  u.email,
  u.created_at,
  pp.date_of_birth,
  pp.blood_type
FROM users u
LEFT JOIN patient_profiles pp ON pp.user_id = u.id
WHERE u.deleted_at IS NULL
  AND u.is_active   = true
  AND (
    u.phone ILIKE '%0501234567%'   -- replace with real search term
    OR u.first_name ILIKE '%أحمد%'
    OR u.last_name  ILIKE '%محمد%'
  )
ORDER BY u.created_at DESC
LIMIT 20 OFFSET 0;


-- ============================================================
-- QUERY: Practitioner availability slots (8-day window)
-- EXPECTED: p95 < 30ms (small table, indexed on practitioner_id + day_of_week)
-- INDEXES USED: practitioner_availabilities_practitioner_id_day_of_week_is_active_branch_id_idx
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  pa.id,
  pa.day_of_week,
  pa.start_time,
  pa.end_time,
  pa.branch_id
FROM practitioner_availabilities pa
WHERE pa.practitioner_id = 'PRACTITIONER_UUID_PLACEHOLDER'  -- replace with real UUID
  AND pa.day_of_week IN (0, 1, 2, 3, 4, 5, 6)
  AND pa.is_active = true
  AND (pa.branch_id = 'BRANCH_UUID_PLACEHOLDER' OR pa.branch_id IS NULL);


-- ============================================================
-- QUERY: Today's bookings for a practitioner (schedule view)
-- EXPECTED: p95 < 20ms (composite index on practitioner_id + date)
-- INDEXES USED: bookings_practitioner_id_date_idx
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.id,
  b.status,
  b.type,
  b.start_time,
  b.end_time,
  b.booked_duration,
  b.booked_price,
  b.is_walk_in,
  b.checked_in_at,
  b.in_progress_at,
  u.first_name AS patient_first_name,
  u.last_name  AS patient_last_name,
  u.phone      AS patient_phone,
  s.name_en    AS service_name
FROM bookings b
LEFT JOIN users u    ON u.id = b.patient_id
JOIN services s      ON s.id = b.service_id
WHERE b.practitioner_id = 'PRACTITIONER_UUID_PLACEHOLDER'  -- replace with real UUID
  AND b.date   >= CURRENT_DATE
  AND b.date   <  CURRENT_DATE + INTERVAL '1 day'
  AND b.deleted_at IS NULL
ORDER BY b.start_time ASC;


-- ============================================================
-- QUERY: Booking stats aggregation (dashboard counters)
-- EXPECTED: p95 < 100ms (GROUP BY on indexed status column)
-- INDEXES USED: bookings_status_idx
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  status,
  COUNT(*) AS count
FROM bookings
WHERE deleted_at IS NULL
GROUP BY status;


-- ============================================================
-- QUERY: Patient stats — total bookings + total paid
-- EXPECTED: p95 < 40ms (patientId indexed; payments joined 1:1)
-- INDEXES USED: bookings_patient_id_status_idx, payments.booking_id (unique)
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  b.patient_id,
  COUNT(b.id)                           AS total_bookings,
  COUNT(b.id) FILTER (
    WHERE b.status = 'completed'
  )                                     AS completed_bookings,
  COALESCE(SUM(p.total_amount), 0)      AS total_paid_halalat,
  -- Convert halalat → SAR for display (1 SAR = 100 halalat)
  ROUND(COALESCE(SUM(p.total_amount), 0) / 100.0, 2) AS total_paid_sar,
  MAX(b.date)                           AS last_booking_date
FROM bookings b
LEFT JOIN payments p
  ON p.booking_id = b.id
  AND p.status    = 'paid'
  AND p.deleted_at IS NULL
WHERE b.patient_id  = 'PATIENT_UUID_PLACEHOLDER'  -- replace with real UUID
  AND b.deleted_at  IS NULL
GROUP BY b.patient_id;
