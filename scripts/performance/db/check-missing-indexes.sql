-- ============================================================
-- Deqah — Missing Index & Performance Health Check
-- Run against staging or prod replica (read-only safe).
-- Requires pg_stat_statements extension to be enabled.
-- Usage: psql $DATABASE_URL -f check-missing-indexes.sql
-- ============================================================

-- ============================================================
-- 1. FOREIGN KEY COLUMNS WITHOUT INDEXES
--    Prisma auto-creates indexes via @@index() but some FKs
--    may be missing explicit coverage — especially junction tables.
-- ============================================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name  AS references_table,
  ccu.column_name AS references_column,
  'MISSING INDEX on FK' AS issue
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage  AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema   = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema   = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema     = 'public'
  -- Exclude columns that already have an index
  AND NOT EXISTS (
    SELECT 1
    FROM pg_index     ix
    JOIN pg_class     cls ON cls.oid  = ix.indrelid
    JOIN pg_attribute att ON att.attrelid = cls.oid
      AND att.attnum = ANY(ix.indkey)
    JOIN pg_namespace ns  ON ns.oid  = cls.relnamespace
    WHERE cls.relname  = tc.table_name
      AND att.attname  = kcu.column_name
      AND ns.nspname   = 'public'
  )
ORDER BY tc.table_name, kcu.column_name;


-- ============================================================
-- 2. SEQUENTIAL SCANS ON LARGE TABLES (> 1000 rows)
--    High seq_scan on a large table = missing index or full table dump.
--    Reset stats first: SELECT pg_stat_reset();
-- ============================================================
SELECT
  relname                        AS table_name,
  seq_scan,
  idx_scan,
  n_live_tup                    AS estimated_rows,
  ROUND(
    seq_scan::numeric /
    NULLIF(seq_scan + idx_scan, 0) * 100, 1
  )                              AS seq_scan_pct,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE n_live_tup  > 1000
  AND seq_scan    > 0
ORDER BY seq_scan DESC
LIMIT 20;


-- ============================================================
-- 3. SLOW QUERIES FROM pg_stat_statements
--    Requires: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
--    in postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
-- ============================================================
SELECT
  LEFT(query, 120)              AS query_preview,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(max_exec_time::numeric,  2) AS max_ms,
  ROUND(total_exec_time::numeric / 1000, 1) AS total_sec,
  rows,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_ms
FROM pg_stat_statements
WHERE -- Filter to Deqah tables only
  query ~* '(bookings|patients|practitioners|payments|users)'
  AND mean_exec_time > 50  -- > 50ms average is a concern
ORDER BY mean_exec_time DESC
LIMIT 25;


-- ============================================================
-- 4. INDEX USAGE STATISTICS
--    Unused indexes waste write overhead — review before adding more.
-- ============================================================
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan                       AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE
    WHEN idx_scan = 0 THEN 'UNUSED — consider dropping'
    WHEN idx_scan < 10 THEN 'RARELY USED'
    ELSE 'ACTIVE'
  END AS status
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 30;


-- ============================================================
-- 5. BLOATED INDEXES (dead tuple ratio > 20%)
--    High bloat = VACUUM needed, or index rebuild with REINDEX CONCURRENTLY.
-- ============================================================
SELECT
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  -- Bloat estimate from pg_stat_user_indexes + pg_class
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  CASE
    WHEN idx_tup_read > 0
    THEN ROUND(
      (1 - idx_tup_fetch::numeric / NULLIF(idx_tup_read, 0)) * 100, 1
    )
    ELSE NULL
  END AS dead_pct_estimate
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND idx_tup_read > 1000  -- only indexes with meaningful traffic
ORDER BY dead_pct_estimate DESC NULLS LAST
LIMIT 20;


-- ============================================================
-- 6. TABLE BLOAT SUMMARY (for VACUUM planning)
-- ============================================================
SELECT
  relname                        AS table_name,
  n_live_tup                    AS live_rows,
  n_dead_tup                    AS dead_rows,
  ROUND(
    n_dead_tup::numeric /
    NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1
  )                              AS dead_pct,
  last_vacuum,
  last_autovacuum,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE n_live_tup > 100
ORDER BY dead_pct DESC NULLS LAST
LIMIT 20;
