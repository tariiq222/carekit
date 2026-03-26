# Bookings & Activity Logs — PostgreSQL Partitioning Plan

## When to Partition

| Table | Trigger | Estimated Timeline |
|---|---|---|
| `bookings` | > 10M rows | ~18–24 months at projected load |
| `activity_logs` | > 5M rows | ~12 months (archive table added in Phase 5 extends this) |

Do NOT partition prematurely. Current indexes (see Phase 2 migration) are sufficient until these thresholds.

---

## Bookings — RANGE Partitioning on `date`

### Strategy
- Partition key: `date` column (booking date, not `created_at`)
- Partition type: `RANGE`, monthly child partitions
- Tool: [`pg_partman`](https://github.com/pgpartman/pg_partman) for automatic partition creation

### Migration Path (Zero Downtime)

```sql
-- Step 1: Create partitioned table (same schema, different DDL)
CREATE TABLE bookings_partitioned (
  LIKE bookings INCLUDING ALL
) PARTITION BY RANGE (date);

-- Step 2: Create initial monthly partitions
CREATE TABLE bookings_2026_01 PARTITION OF bookings_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... (pg_partman automates this)

-- Step 3: Batch-copy existing rows (off-peak, 10K rows per transaction)
INSERT INTO bookings_partitioned SELECT * FROM bookings
  WHERE date >= '2026-01-01' AND date < '2026-02-01';
-- Repeat per month, with progress tracking

-- Step 4: Atomic rename (sub-millisecond, no data loss)
BEGIN;
  ALTER TABLE bookings RENAME TO bookings_old;
  ALTER TABLE bookings_partitioned RENAME TO bookings;
COMMIT;

-- Step 5: Drop old table after 30-day verification window
DROP TABLE bookings_old;
```

### Prisma Compatibility
Prisma schema stays as-is (`model Booking`). Partition DDL lives in raw migration SQL only.
Prisma does not manage PostgreSQL partitioned tables — do not attempt `prisma migrate` for this.

### Index Notes
- All existing indexes must be recreated on the partitioned table (PostgreSQL automatically creates partition-local indexes when you define them on the parent)
- Unique constraints require the partition key (`date`) to be included — adjust if needed

---

## Activity Logs — Same Strategy

The `activity_logs_archive` table (created in Phase 5) already handles the hot-path:
- Active logs stay in `activity_logs` (last 90 days)
- Older logs move to `activity_logs_archive` weekly via `CleanupService.archiveOldActivityLogs()`

Partitioning `activity_logs_archive` makes sense when the archive table itself exceeds 5M rows.
Apply the same RANGE-on-`created_at` strategy when that threshold is reached.

---

## pg_partman Setup

```sql
-- Install extension
CREATE EXTENSION IF NOT EXISTS pg_partman;

-- Configure auto-management (runs via pg_cron or external scheduler)
SELECT partman.create_parent(
  p_parent_table := 'public.bookings',
  p_control := 'date',
  p_type := 'range',
  p_interval := 'monthly',
  p_premake := 3    -- pre-create 3 future partitions
);
```

---

## Monitoring

- Track `pg_stat_user_tables` row estimates for `bookings` and `activity_logs`
- Alert threshold: 7M rows (70% of partition trigger) gives 2–3 months to plan
- `CleanupService.logTableGrowthSnapshot()` already pushes row counts to Prometheus — add alert rule on `db_table_rows_total{table="bookings"} > 7000000`
