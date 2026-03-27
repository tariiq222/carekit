# CareKit — DB Query Performance Toolkit

## Files

| File | Purpose |
|------|---------|
| `analyze-queries.sql` | EXPLAIN ANALYZE for the 6 most critical queries |
| `check-missing-indexes.sql` | Health checks: missing FKs, seq scans, slow queries, bloat |
| `prisma-query-logger.ts` | NestJS middleware to log slow Prisma queries at runtime |

---

## Running analyze-queries.sql

```bash
# Against local dev DB
psql $DATABASE_URL -f performance/db/analyze-queries.sql

# Against staging (read-only replica — safe)
psql "postgres://user:pass@staging-host/carekit" -f performance/db/analyze-queries.sql

# Pipe output to a file for review
psql $DATABASE_URL -f performance/db/analyze-queries.sql > /tmp/explain-output.txt 2>&1
```

Before running, replace the UUID placeholders:
- `BRANCH_UUID_PLACEHOLDER` — any valid `branches.id`
- `PRACTITIONER_UUID_PLACEHOLDER` — any valid `practitioners.id`
- `PATIENT_UUID_PLACEHOLDER` — any valid `users.id` with bookings

---

## Reading EXPLAIN ANALYZE Output

Key terms to look for:

| Term | What it means |
|------|--------------|
| `Seq Scan` | Full table scan — needs an index if table is large |
| `Index Scan` | Good — uses a B-tree index |
| `Index Only Scan` | Best — all data served from index without heap access |
| `Bitmap Heap Scan` | Mixed — index used then heap fetched in batches |
| `Hash Join / Nested Loop` | Join strategy — Nested Loop is fast for small sets |
| `actual time=X..Y` | X = first row time, Y = total time (ms) |
| `rows=N` | Actual rows returned |
| `Buffers: shared hit=N` | N pages from cache (good); `read=N` means disk IO |

**Red flags:**
- `Seq Scan` on a table with > 10k rows
- `actual rows` much larger than `rows` estimate (bad statistics → run ANALYZE)
- `Buffers: shared read=` high values (poor cache hit rate)

---

## Adding the Slow Query Logger to PrismaService

In `backend/src/database/prisma.service.ts`:

```ts
import { slowQueryMiddleware } from '../../performance/db/prisma-query-logger.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    this.$use(slowQueryMiddleware);
    await this.$connect();
  }
}
```

Custom thresholds (e.g., tighter in CI):

```ts
import { createSlowQueryMiddleware } from '../../performance/db/prisma-query-logger.js';

this.$use(createSlowQueryMiddleware({ warnMs: 50, errorMs: 200 }));
```

Log output example:
```
[SlowQuery] WARN  Slow query [143ms] Booking.findMany
[SlowQuery] ERROR VERY SLOW QUERY [620ms] Booking.findMany | args: {"where":{"deletedAt":null},...}
```

---

## Key Indexes to Watch in CareKit

| Table | Index | Covers |
|-------|-------|--------|
| `bookings` | `(practitioner_id, date)` | Today's schedule, availability check |
| `bookings` | `(status, date)` | Dashboard filters |
| `bookings` | `(patient_id, status)` | Patient booking history |
| `bookings` | `(branch_id, date)` | Branch-scoped booking list |
| `bookings` | `(recurring_group_id)` | Recurring group queries |
| `practitioner_availabilities` | `(practitioner_id, day_of_week, is_active, branch_id)` | Slot computation |
| `practitioner_vacations` | `(start_date, end_date)` | Vacation overlap check |
| `payments` | `(status)` | Payment dashboard |
| `users` | `email`, `phone` (unique) | Auth lookups |
| `otp_codes` | `(user_id, type, used_at)` | OTP verification |

**Missing — add if search becomes slow:**
```sql
-- pg_trgm index for Arabic/English name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX users_name_trgm_idx ON users
  USING gin ((first_name || ' ' || last_name) gin_trgm_ops);
```

---

## Recommended Thresholds

| Query type | p95 target | Action if exceeded |
|-----------|------------|-------------------|
| PK / unique lookup | < 5ms | Investigate — should always hit index |
| Simple filtered list (indexed) | < 50ms | Check EXPLAIN, add index if seq scan |
| Paginated list with joins | < 100ms | Optimize includes, add composite index |
| Aggregation / stats | < 200ms | Consider materialized view or cache |
| Availability slot computation | < 50ms | Already batched; check availability table size |
| Patient search (ILIKE) | < 200ms | Add pg_trgm index (see above) |

The slow query logger thresholds are set slightly tighter than p95 targets (WARN at 100ms, ERROR at 500ms) so issues are caught in staging before reaching production.
