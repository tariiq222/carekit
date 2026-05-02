# Index Audit — 2026-05

**Date:** 2026-05-02
**DB version:** PostgreSQL 16.13 (Debian 16.13-1.pgdg12+1 on aarch64)
**Environment:** Dev DB (`deqah_dev`) seeded with synthetic volume data.

**Row counts at time of audit:**

| Table | Rows |
|---|---|
| Notification | 10,067 |
| ActivityLog | 10,450 |
| Invoice | 8,033 |
| SmsDelivery | 5,000 |
| NotificationDeliveryLog | 5,000 |
| OtpCode | 5,000 |
| Booking | 0 (empty — no prod seed available) |

---

## DB-05: Composite Uniques

All eleven targets are low-write-rate entities. The composite unique adds one B-tree index
per table, approximately 32 bytes per row (two UUID columns × 16 bytes each). Write-overhead
is acceptable — these are reference/config tables and transactional parents that are never
bulk-inserted.

**Approved:** Branch, Service, Booking, Invoice, Department, ServiceCategory,
              Employee, Client, GroupSession, IntakeForm, CustomRole

No EXPLAIN evidence needed — this is structural, prerequisite for future composite FK enforcement.

---

## DB-06: Candidate Indexes

### Notification(recipientId, isRead, createdAt) — ListNotificationsHandler / GetUnreadCountHandler

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "Notification"
WHERE "organizationId" = '00000000-0000-0000-0000-000000000001'
  AND "recipientId" = 'recipient-42'
  AND "isRead" = false
ORDER BY "createdAt" DESC
LIMIT 20;
```

**Before:**
```
Limit  (cost=90.57..90.59 rows=10 width=184) (actual time=0.075..0.076 rows=20 loops=1)
  ->  Sort  (cost=90.57..90.59 rows=10 width=184) (actual time=0.074..0.075 rows=20 loops=1)
        Sort Key: "createdAt" DESC
        Sort Method: quicksort  Memory: 33kB
        ->  Bitmap Heap Scan on "Notification"  (cost=4.51..90.40 rows=10 width=184) (actual time=0.017..0.064 rows=33 loops=1)
              Recheck Cond: ("recipientId" = 'recipient-42'::text)
              Filter: ((NOT "isRead") AND ("organizationId" = '00000000-0000-0000-0000-000000000001'::text))
              Rows Removed by Filter: 17
              Heap Blocks: exact=50
              ->  Bitmap Index Scan on "Notification_recipientId_createdAt_idx"  (cost=0.00..4.51 rows=30 width=0) (actual time=0.009..0.009 rows=50 loops=1)
                    Index Cond: ("recipientId" = 'recipient-42'::text)
Planning Time: 0.174 ms
Execution Time: 0.103 ms
```

**Analysis:** Planner uses `(recipientId, createdAt)` but must filter on `isRead` post-scan, removing 17/50 rows (34% waste). Adding `isRead` as the second column eliminates the heap fetch for unread-count queries. This index replaces the existing `(recipientId, createdAt)` index — the leading `(recipientId)` standalone index is kept for exact-match lookups.

**Decision:** APPROVED — `@@index([recipientId, isRead, createdAt])` replaces `@@index([recipientId, createdAt])`

---

### Booking(organizationId, scheduledAt) and Booking(organizationId, status, scheduledAt)

**Evidence:** Booking table has 0 rows on dev DB. EXPLAIN ANALYZE on empty table defaults to seq scan and is not meaningful. Cannot establish before/after evidence.

**Decision:** REJECTED — insufficient evidence. Skip per plan rule: "If unsure, skip the candidate and document."

> Note: Re-evaluate once the Booking table has ≥ 5,000 rows in a future audit cycle.

---

### Invoice(organizationId, status, dueAt) — AR aging report

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "Invoice"
WHERE "organizationId" = '00000000-0000-0000-0000-000000000001'
  AND status IN ('ISSUED', 'PARTIALLY_PAID')
ORDER BY "dueAt" ASC
LIMIT 100;
```

**Before:**
```
Limit  (cost=499.46..499.71 rows=100 width=325) (actual time=30.228..30.235 rows=100 loops=1)
  ->  Sort  (cost=499.46..503.52 rows=1623 width=325) (actual time=30.227..30.230 rows=100 loops=1)
        Sort Key: "dueAt"
        Sort Method: top-N heapsort  Memory: 115kB
        ->  Bitmap Heap Scan on "Invoice"  (cost=54.94..437.43 rows=1623 width=325) (actual time=0.534..29.181 rows=1633 loops=1)
              Recheck Cond: ("organizationId" = '00000000-0000-0000-0000-000000000001'::text)
              Filter: (status = ANY ('{ISSUED,PARTIALLY_PAID}'::"InvoiceStatus"[]))
              Rows Removed by Filter: 2400
              Heap Blocks: exact=322
              ->  Bitmap Index Scan on "Invoice_organizationId_idx"  (cost=0.00..54.53 rows=4033 width=0) (actual time=0.435..0.436 rows=4033 loops=1)
                    Index Cond: ("organizationId" = '00000000-0000-0000-0000-000000000001'::text)
Planning Time: 11.138 ms
Execution Time: 30.441 ms
```

**Analysis:** 30ms with 2,400 heap rows filtered post-scan (status). The composite `(organizationId, status, dueAt)` would allow the planner to skip the status heap filter and use `dueAt` as a sort key — potentially reducing this to an index-only scan.

**Decision:** APPROVED — `@@index([organizationId, status, dueAt])`

---

### ActivityLog(organizationId, occurredAt) — ListActivityHandler

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "ActivityLog"
WHERE "organizationId" = '00000000-0000-0000-0000-000000000001'
  AND "occurredAt" >= '2026-04-01'
  AND "occurredAt" < '2026-05-01'
ORDER BY "occurredAt" DESC
LIMIT 50;
```

**Before:**
```
Limit  (cost=0.29..7.10 rows=50 width=415) (actual time=0.432..0.767 rows=50 loops=1)
  ->  Index Scan Backward using "ActivityLog_occurredAt_idx" on "ActivityLog"
        (cost=0.29..602.91 rows=4424 width=415) (actual time=0.431..0.761 rows=50 loops=1)
        Index Cond: (("occurredAt" >= ...) AND ("occurredAt" < ...))
        Filter: ("organizationId" = '00000000-0000-0000-0000-000000000001'::text)
        Rows Removed by Filter: 10
Planning Time: 6.593 ms
Execution Time: 1.211 ms
```

**Analysis:** Planner uses `(occurredAt)` index and filters `organizationId` post-scan. With the composite `(organizationId, occurredAt)`, the planner can constrain on both in one index pass and the two separate indexes `(organizationId)` and `(occurredAt)` can be dropped (replaced by one composite).

**Decision:** APPROVED — `@@index([organizationId, occurredAt])` replaces `@@index([organizationId])` + `@@index([occurredAt])`

---

### OtpCode(consumedAt, expiresAt) — sweep cron

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "OtpCode"
WHERE "consumedAt" IS NOT NULL
   OR "expiresAt" < NOW()
LIMIT 200;
```

**Before:**
```
Limit  (cost=0.00..24.49 rows=200 width=169) (actual time=0.018..0.214 rows=200 loops=1)
  ->  Seq Scan on "OtpCode"  (cost=0.00..204.00 rows=1666 width=169) (actual time=0.017..0.206 rows=200 loops=1)
        Filter: (("consumedAt" IS NOT NULL) OR ("expiresAt" < now()))
        Rows Removed by Filter: 400
Planning Time: 0.511 ms
Execution Time: 0.241 ms
```

**Analysis:** Seq Scan but execution time is 0.241ms (negligible). The OR condition prevents a single index from covering both branches — a partial index on `WHERE consumedAt IS NOT NULL` would cover half; `WHERE expiresAt < NOW()` is a moving target unsuitable for a static partial index. A composite `(consumedAt, expiresAt)` would be unused for the OR query. The sweep cron runs infrequently and at 5k rows the table is tiny.

**Decision:** REJECTED — query is fast enough (< 1ms), OR condition prevents clean index coverage, no measurable benefit.

---

### SmsDelivery(status, createdAt) — retry sweep

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "SmsDelivery"
WHERE status IN ('QUEUED', 'FAILED')
ORDER BY "createdAt" ASC
LIMIT 100;
```

**Before:**
```
Limit  (cost=0.28..16.46 rows=100 width=270) (actual time=0.385..0.456 rows=100 loops=1)
  ->  Index Scan using "SmsDelivery_createdAt_idx" on "SmsDelivery"
        (cost=0.28..323.78 rows=2000 width=270) (actual time=0.384..0.452 rows=100 loops=1)
        Filter: (status = ANY ('{QUEUED,FAILED}'::"SmsDeliveryStatus"[]))
        Rows Removed by Filter: 148
Planning Time: 0.927 ms
Execution Time: 0.499 ms
```

**Analysis:** Planner uses `(createdAt)` index, filtering status post-scan. A composite `(status, createdAt)` allows the planner to restrict on status first (20% of rows are QUEUED/FAILED), then scan `createdAt` in order — eliminating the 148-row filter overhead. Also consolidates two single-col indexes into one.

**Decision:** APPROVED — `@@index([status, createdAt])` replaces `@@index([status])` + `@@index([createdAt])`

---

### NotificationDeliveryLog(status, createdAt) — retry sweep

**Query (before index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM "NotificationDeliveryLog"
WHERE status IN ('PENDING', 'FAILED')
ORDER BY "createdAt" ASC
LIMIT 100;
```

**Before:**
```
Limit  (cost=0.28..12.34 rows=100 width=266) (actual time=0.040..0.133 rows=100 loops=1)
  ->  Index Scan using "NotificationDeliveryLog_createdAt_idx" on "NotificationDeliveryLog"
        (cost=0.28..301.78 rows=2500 width=266) (actual time=0.039..0.128 rows=100 loops=1)
        Filter: (status = ANY ('{PENDING,FAILED}'::"DeliveryStatus"[]))
        Rows Removed by Filter: 99
Planning Time: 1.088 ms
Execution Time: 0.180 ms
```

**Analysis:** Same pattern as SmsDelivery — `(createdAt)` index used, status filtered post-scan. Composite `(status, createdAt)` reduces filter waste and consolidates indexes.

**Decision:** APPROVED — `@@index([status, createdAt])` (new, additive — existing `(organizationId, status)` and `(organizationId, type)` are kept, `(createdAt)` is replaced)

---

## DB-07: Redundant Index — Booking(employeeId)

**pg_stat_user_indexes check:**
```sql
SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE relname = 'Booking'
ORDER BY indexrelname;
```

**Result:**
```
            indexrelname            | idx_scan | idx_tup_read | idx_tup_fetch
------------------------------------+----------+--------------+---------------
 Booking_clientId_idx               |        0 |            0 |             0
 Booking_employeeId_endsAt_idx      |        0 |            0 |             0
 Booking_employeeId_idx             |        0 |            0 |             0
 Booking_employeeId_scheduledAt_idx |        0 |            0 |             0
 Booking_organizationId_idx         |      497 |            0 |             0
 Booking_pkey                       |       67 |            0 |             0
 Booking_recurringGroupId_idx       |        0 |            0 |             0
 Booking_scheduledAt_idx            |       24 |            0 |             0
 Booking_status_idx                 |      742 |            0 |             0
 booking_employee_no_overlap        |        0 |            0 |             0
```

**Analysis:** All `employeeId` indexes show `idx_scan = 0` — fresh dev DB with empty Booking table. Evidence from scan counts alone is inconclusive. However, the **leading-prefix argument** is definitive:

- `Booking_employeeId_scheduledAt_idx` — leading column is `employeeId`; Postgres can use this to satisfy `WHERE employeeId = $1` without reading `scheduledAt` at all (prefix scan).
- `Booking_employeeId_endsAt_idx` — same: covers `WHERE employeeId = $1` as a prefix.
- `Booking_employeeId_idx` — single-column; every query it could answer is a strict subset of what the two composite indexes above can handle with the same I/O cost.

The standalone `[employeeId]` index is therefore **logically redundant** regardless of scan counts. It adds ~16 bytes per row and slows INSERT/UPDATE on the Booking table for zero benefit.

**Decision:** DROP `Booking_employeeId_idx` — confirmed redundant via leading-prefix analysis.

---

## Side-issue: ActivityLog scoping bug (FIXED in this PR)

`ListActivityHandler` was missing `organizationId` in its `where` clause — the DTO lacked the field and the controller did not inject it from JWT tenant context. This is a **security fix** addressed in Commit 1 of this PR (ahead of the index work), per owner notes.

---

## Final Decision — approved index changes

| Change | Approved? | Reason |
|---|---|---|
| DB-05: all 11 composite uniques | YES | Structural prerequisite for future composite FK |
| Notification(recipientId, isRead, createdAt) | YES | Eliminates isRead filter waste (34% heap rows removed) |
| Booking(organizationId, scheduledAt) | NO | Zero-row table, no evidence |
| Booking(organizationId, status, scheduledAt) | NO | Zero-row table, no evidence |
| Invoice(organizationId, status, dueAt) | YES | 30ms query, 2400 heap rows filtered |
| ActivityLog(organizationId, occurredAt) | YES | Replaces two single-col indexes, removes post-scan filter |
| OtpCode(consumedAt, expiresAt) | NO | 0.241ms, OR condition prevents clean coverage |
| SmsDelivery(status, createdAt) | YES | Replaces two single-col indexes, reduces filter waste |
| NotificationDeliveryLog(status, createdAt) | YES | Same pattern as SmsDelivery |
| DROP Booking(employeeId) | YES | Leading-prefix makes it logically redundant |

---

## Phase 3: Post-migration verification

**Dev DB note:** The migration SQL uses `CREATE INDEX CONCURRENTLY` throughout. On this dev DB,
the migration was registered with `prisma migrate resolve --applied` (the dev DB has drift from
other in-flight branches). The DDL will execute on the next clean deploy via `prisma migrate deploy`.

**booking_id_org** (DB-05 on Booking) was created manually on dev before the permission block,
confirming the CONCURRENTLY syntax is valid on this PostgreSQL 16.13 instance.

**Expected plan changes after full deploy:**

| Query | Before | Expected After |
|---|---|---|
| Notification recipientId + isRead + createdAt | Bitmap Heap Scan, 34% filter waste | Index Scan on (recipientId, isRead, createdAt) |
| Invoice organizationId + status IN + dueAt ORDER | Sort + Bitmap Heap Scan, 30ms | Index Scan on (organizationId, status, dueAt) |
| ActivityLog organizationId + occurredAt range | Index Scan on (occurredAt) + filter | Index Scan on (organizationId, occurredAt) |
| SmsDelivery status IN + ORDER BY createdAt | Index Scan on (createdAt) + filter | Index Scan on (status, createdAt) |
| NotificationDeliveryLog status IN + ORDER BY createdAt | Index Scan on (createdAt) + filter | Index Scan on (status, createdAt) |

**DB-07 verification:** Once the migration runs on a clean DB, confirm via:
```sql
SELECT indexrelname FROM pg_indexes WHERE tablename = 'Booking' ORDER BY indexrelname;
```
`Booking_employeeId_idx` must be absent; `Booking_employeeId_scheduledAt_idx` and
`Booking_employeeId_endsAt_idx` must be present.
