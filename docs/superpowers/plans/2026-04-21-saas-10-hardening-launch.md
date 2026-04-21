# SaaS-10 — Hardening & Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Owner-review required:** rate-limiting bucket sizes, data-export format, Sentry DSN rotation, and the go/no-go launch gate all require explicit owner approval before merge/launch.

**Goal:** Take CareKit from "feature-complete" to "production-launchable." This plan:

1. Extends the cross-tenant penetration test suite from Plan 02h with race conditions, fuzzing, and full authorization-matrix coverage.
2. Adds per-tenant API rate limiting (`@nestjs/throttler` + Redis), driven by the tenant's current `Plan.limits.apiRateLimit`.
3. Instruments observability: Sentry tenant tags, Prometheus `{organization_id, plan, vertical}` labels, and per-tenant Grafana dashboards.
4. Runs a performance audit (EXPLAIN ANALYZE on top 20 queries per cluster) and adds any missing indexes.
5. Authors and runs a k6 load-test simulating 100 orgs × 10k bookings each; captures baseline in `docs/performance-baseline-v1.md`.
6. Ships per-tenant data export (`POST /api/v1/dashboard/export-my-org-data` → BullMQ job → ZIP in MinIO).
7. Writes `docs/runbook.md` covering suspend/restore/failed-migration/incident/on-call.
8. Codifies the launch go/no-go checklist.

**Architecture:** Hardening overlays existing code; no new clusters. Observability wraps every HTTP request and BullMQ job with tenant metadata. Rate limiter sits in front of every tenant-scoped controller. Data export is a long-running BullMQ job that streams rows (`cursor`-paginated Prisma) + MinIO files into a ZIP uploaded back to MinIO, then emails the tenant owner a signed download URL.

**Tech Stack:** `@nestjs/throttler` v6, `ioredis`, `@sentry/nestjs` v9, `prom-client` v15, `@grafana/grafana-exporter` (dashboards-as-JSON), k6 v0.52, `archiver` (ZIP), BullMQ, Prisma 7, Jest, Supertest.

---

## Critical lessons carried forward

1. **Rate-limit key must be `${organizationId}:${userId}`**, not IP. A single clinic with 50 receptionists shares a bucket; IP-based limits punish NAT'd networks.
2. **Prometheus cardinality discipline**: `{organization_id, plan, vertical}` is fine at ≤1000 orgs × 20 metrics × 4 plans × 4 verticals = 320k series max. Resist adding `endpoint` or `user_id` labels to counters.
3. **Data export must stream**, not buffer. A large tenant has 100k+ bookings, 100MB+ of invoices. Use Prisma cursor pagination + Node stream piping.
4. **Pen tests are additive**: extend Plan 02h's `cross-tenant-isolation.e2e-spec.ts` rather than creating a parallel suite. One test file per adversarial technique.
5. **Load-test is NOT run in CI.** It's manual, run once per release candidate against a staging environment that mirrors prod spec. Keep the script in `test/load/` but don't wire it to `npm run test`.
6. **Runbook must be exercised.** Every scenario in `runbook.md` must have been run at least once against staging before launch — otherwise it's fiction.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `apps/backend/src/common/throttling/tenant-throttler.guard.ts` | Extends `ThrottlerGuard`; resolves key from tenant context |
| `apps/backend/src/common/throttling/tenant-throttler.module.ts` | Module + Redis storage config |
| `apps/backend/src/common/observability/sentry.interceptor.ts` | Wraps requests; sets tenant scope |
| `apps/backend/src/common/observability/prometheus.interceptor.ts` | Emits `http_request_duration_seconds` with tenant labels |
| `apps/backend/src/common/observability/metrics.controller.ts` | `GET /metrics` (internal; IP-allowlisted) |
| `apps/backend/src/modules/platform/data-export/` | Full cluster |
| `apps/backend/src/modules/platform/data-export/data-export.handler.ts` | Kicks off BullMQ job |
| `apps/backend/src/modules/platform/data-export/data-export.processor.ts` | Streams rows + files → ZIP → MinIO |
| `apps/backend/src/modules/platform/data-export/data-export.controller.ts` | `POST /api/v1/dashboard/export-my-org-data` |
| `apps/backend/src/modules/platform/data-export/__tests__/*.spec.ts` | Unit tests |
| `apps/backend/test/e2e/security/race-subscription-limit.e2e-spec.ts` | Race condition coverage |
| `apps/backend/test/e2e/security/api-fuzz.e2e-spec.ts` | Property-based fuzzing |
| `apps/backend/test/e2e/security/authorization-matrix.e2e-spec.ts` | Every role × every endpoint |
| `apps/backend/test/e2e/security/injection-sweep.e2e-spec.ts` | SQL-i + XSS sweep on public endpoints |
| `apps/backend/test/e2e/data-export/data-export.e2e-spec.ts` | Export happy path + size bound |
| `apps/backend/test/load/k6-booking-load.js` | k6 load script |
| `apps/backend/test/load/k6-helpers.js` | Auth + seed helpers |
| `apps/backend/test/load/README.md` | How to run (not CI) |
| `docs/performance-baseline-v1.md` | Baseline from first load-test run |
| `docs/runbook.md` | Operational runbook |
| `docs/launch-checklist.md` | Go/no-go gates |
| `docker/grafana/dashboards/carekit-tenant-overview.json` | Per-tenant dashboard |
| `docker/grafana/dashboards/carekit-platform-health.json` | Platform-wide dashboard |

### Modified files

- `apps/backend/src/app.module.ts` — register `TenantThrottlerModule`, Sentry + Prometheus interceptors
- `apps/backend/src/infrastructure/database/prisma.service.ts` — query logger hook emits Prometheus `prisma_query_duration_seconds{model, operation}`
- `apps/backend/src/common/tenant/tenant-context.service.ts` — expose `getOrganizationMetadata()` returning `{id, plan, vertical}` for observability
- `apps/backend/prisma/schema/platform.prisma` — add `DataExportJob` model (status tracking)
- `docker/docker-compose.yml` — add `prometheus` + `grafana` services
- Root `CLAUDE.md` — reference `docs/runbook.md` + `docs/launch-checklist.md`

---

## Task 1 — Per-tenant rate limiting

- [ ] **Step 1.1: Write test first**

Create `apps/backend/src/common/throttling/__tests__/tenant-throttler.guard.spec.ts`:

```ts
describe('TenantThrottlerGuard', () => {
  it('uses organizationId+userId as key when tenant context present', () => {
    expect(guard.getTracker({ /* mock req with tenant */ })).toBe('org-1:user-5');
  });
  it('falls back to IP when no tenant', () => {
    expect(guard.getTracker({ /* req without tenant */ })).toBe('ip:203.0.113.1');
  });
  it('reads limit from subscription.plan.limits.apiRateLimit', async () => {
    const limit = await guard.getLimit({ organizationId: 'org-1' });
    expect(limit).toBe(120); // Pro plan 120/min
  });
  it('falls back to GUEST_RATE_LIMIT when no tenant', async () => {
    const limit = await guard.getLimit({});
    expect(limit).toBe(20);
  });
});
```

- [ ] **Step 1.2: Implement**

Create `apps/backend/src/common/throttling/tenant-throttler.guard.ts`:

```ts
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly tenant: TenantContextService,
    private readonly prisma: PrismaService,
  ) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const orgId = this.tenant.getOrganizationId();
    const userId = req.user?.id;
    if (orgId && userId) return `${orgId}:${userId}`;
    if (orgId) return `${orgId}:anon`;
    return `ip:${req.ip}`;
  }

  protected async getLimit(ctx: ExecutionContext): Promise<number> {
    const orgId = this.tenant.getOrganizationId();
    if (!orgId) return 20; // GUEST
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: true },
    });
    return sub?.plan?.limits?.apiRateLimit ?? 60;
  }
}
```

- [ ] **Step 1.3: Redis storage**

Create `tenant-throttler.module.ts` wiring `@nestjs/throttler`'s Redis storage via `ioredis`. Use the existing Redis connection (already in `docker-compose.yml`).

- [ ] **Step 1.4: Register globally**

In `apps/backend/src/app.module.ts`:

```ts
providers: [
  { provide: APP_GUARD, useClass: TenantThrottlerGuard },
  // …
]
```

Public endpoints (signup, site-settings, ask) already use `@UseGuards(PublicThrottlerGuard)` with stricter limits. Tenant endpoints inherit the global guard.

- [ ] **Step 1.5: Run**

```bash
cd apps/backend && npx jest common/throttling --no-coverage
```

- [ ] **Step 1.6: Commit**

```bash
git add apps/backend/src/common/throttling apps/backend/src/app.module.ts
git commit -m "feat(saas-10): per-tenant rate limiting with Redis storage"
```

---

## Task 2 — Sentry tenant tags

- [ ] **Step 2.1: Install + init**

Add `@sentry/nestjs` to `apps/backend/package.json` (if not already). Init in `main.ts`:

```ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

- [ ] **Step 2.2: Interceptor**

Create `apps/backend/src/common/observability/sentry.interceptor.ts`:

```ts
@Injectable()
export class TenantSentryInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantContextService, private readonly prisma: PrismaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler) {
    const scope = Sentry.getCurrentScope();
    const orgId = this.tenant.getOrganizationId();
    if (orgId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        include: { vertical: true, subscription: { include: { plan: true } } },
      });
      scope.setTag('organizationId', orgId);
      scope.setTag('vertical', org?.vertical?.slug ?? 'unknown');
      scope.setTag('plan', org?.subscription?.plan?.tier ?? 'unknown');
    }
    return next.handle();
  }
}
```

Register globally in `app.module.ts`.

- [ ] **Step 2.3: Verify in staging**

Deploy to staging, trigger an error in a tenant-scoped handler, confirm the Sentry event carries `organizationId`, `vertical`, `plan` tags.

- [ ] **Step 2.4: Commit**

```bash
git add apps/backend/src/common/observability/sentry.interceptor.ts apps/backend/src/main.ts apps/backend/src/app.module.ts
git commit -m "feat(saas-10): Sentry tenant tags (organizationId/vertical/plan)"
```

---

## Task 3 — Prometheus metrics

- [ ] **Step 3.1: Interceptor**

Create `apps/backend/src/common/observability/prometheus.interceptor.ts` emitting:

```ts
const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status', 'organization_id', 'plan', 'vertical'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
```

Important: keep label cardinality bounded. `route` uses the matched route template (`/bookings/:id`), not the raw URL — otherwise path cardinality explodes.

- [ ] **Step 3.2: Prisma query metric**

Hook Prisma's `$on('query', ...)`:

```ts
const prismaDuration = new Histogram({
  name: 'prisma_query_duration_seconds',
  labelNames: ['model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});
```

- [ ] **Step 3.3: `/metrics` controller**

`apps/backend/src/common/observability/metrics.controller.ts` — exposes `register.metrics()` on `GET /metrics`. IP-allowlist it to the Prometheus scraper only (via an Nginx/Caddy rule or a simple guard checking `req.ip`).

- [ ] **Step 3.4: Cardinality sanity check**

Add a test that asserts total active series stays under a budget:

```ts
it('does not exceed cardinality budget after synthetic traffic', async () => {
  for (let i = 0; i < 1000; i++) {
    // simulate requests from 100 orgs × 10 endpoints
  }
  const metrics = await register.getMetricsAsJSON();
  const httpSeries = metrics.find((m) => m.name === 'http_request_duration_seconds')?.values?.length ?? 0;
  expect(httpSeries).toBeLessThan(50_000);
});
```

- [ ] **Step 3.5: docker-compose + Grafana dashboards**

Add `prometheus` + `grafana` to `docker/docker-compose.yml`. Create dashboards as JSON in `docker/grafana/dashboards/`:

- `carekit-tenant-overview.json` — throughput, error rate, P95 latency, subscription status (per-tenant via variable).
- `carekit-platform-health.json` — platform-wide: total orgs, active subscriptions, errors/sec, P95, DB connection pool.

- [ ] **Step 3.6: Commit**

```bash
git add apps/backend/src/common/observability docker/grafana docker/docker-compose.yml
git commit -m "feat(saas-10): Prometheus metrics + Grafana dashboards"
```

---

## Task 4 — Penetration test extension

- [ ] **Step 4.1: Race condition — subscription limit enforcement**

Create `apps/backend/test/e2e/security/race-subscription-limit.e2e-spec.ts`:

```ts
it('cannot exceed plan.limits.maxBookings via concurrent requests', async () => {
  // Starter plan: maxBookings=500/month. Insert 499, then fire 10 parallel requests.
  await seedOrgWithBookings(ORG_ID, 499);
  const reqs = Array.from({ length: 10 }, () =>
    request(app.getHttpServer())
      .post('/api/v1/dashboard/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(validBookingBody),
  );
  const results = await Promise.all(reqs);
  const successes = results.filter((r) => r.status === 201).length;
  const rejects = results.filter((r) => r.status === 402).length; // 402 = limit exceeded
  expect(successes).toBe(1);
  expect(rejects).toBe(9);
});
```

- [ ] **Step 4.2: Authorization matrix**

Create `apps/backend/test/e2e/security/authorization-matrix.e2e-spec.ts`. Enumerates every `(role, endpoint)` pair and asserts the correct 200/403.

Roles: `OWNER`, `ADMIN`, `RECEPTIONIST`, `EMPLOYEE`, `CLIENT`, `ANON`.
Endpoints: loaded from a manifest file `test/e2e/security/endpoint-manifest.ts` that lists each route + the expected allowed roles.

```ts
for (const { method, path, allowedRoles } of ENDPOINT_MANIFEST) {
  for (const role of ALL_ROLES) {
    it(`${method} ${path} - role ${role}`, async () => {
      const token = tokens[role];
      const expected = allowedRoles.includes(role) ? [200, 201, 204] : [401, 403];
      const res = await request(app.getHttpServer())[method.toLowerCase()](path).set('Authorization', token ? `Bearer ${token}` : '').send(sampleBodyFor(path));
      expect(expected).toContain(res.status);
    });
  }
}
```

The manifest MUST be kept in sync — CI gate Task 4.5 enforces this.

- [ ] **Step 4.3: API fuzzing**

Create `apps/backend/test/e2e/security/api-fuzz.e2e-spec.ts`. Property-based tests using `fast-check`:

```ts
it.prop([fc.object()])('POST /bookings does not 500 on arbitrary objects', async (payload) => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/dashboard/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
  expect(res.status).toBeLessThan(500); // 400 OK, 500 not OK
});
```

Cover the top 15 write endpoints.

- [ ] **Step 4.4: Injection sweep**

Create `apps/backend/test/e2e/security/injection-sweep.e2e-spec.ts`. For each public endpoint, send SQL-injection payloads (`'; DROP TABLE x; --`, `' OR 1=1 --`) and XSS payloads (`<script>alert(1)</script>`, `javascript:alert(1)`) as query params and body fields; assert responses are sanitized and no server 500.

- [ ] **Step 4.5: CI gate**

Add to root `turbo.json` or CI workflow: authorization-matrix runs on every PR. Load-test + fuzz + injection run nightly only (tag them with `@nightly` and exclude from PR runs).

- [ ] **Step 4.6: Commit**

```bash
git add apps/backend/test/e2e/security
git commit -m "test(saas-10): pen-test suite — race conditions, fuzz, auth matrix, injection sweep"
```

---

## Task 5 — Performance audit + index additions

- [ ] **Step 5.1: Enumerate top 20 queries per cluster**

```bash
cd apps/backend && node scripts/log-top-queries.js
```

(Write this script if not already present — iterates the codebase for `prisma.*.find*` callsites, logs them, groups by model+operation.)

- [ ] **Step 5.2: Run EXPLAIN ANALYZE**

For each of the top 20, run against a staging DB with realistic data volume (100 orgs × 1000 bookings). Capture output to `docs/performance-audit-v1.md`.

- [ ] **Step 5.3: Add missing indexes**

Common gaps after tenancy rollout (02a-02g):
- `Booking(organizationId, scheduledAt)` composite — list-by-date queries.
- `Booking(organizationId, employeeId, status)` — employee schedule queries.
- `Invoice(organizationId, status, createdAt)` — billing list.
- `Client(organizationId, phone)` — lookup on public signup.
- `ActivityLog(organizationId, createdAt)` — audit tail.

Write as a single migration `<ts>_saas_10_perf_indexes/migration.sql`.

- [ ] **Step 5.4: Re-run EXPLAIN ANALYZE + confirm improvements**

Update `docs/performance-audit-v1.md` with post-index numbers.

- [ ] **Step 5.5: Commit**

```bash
git add apps/backend/prisma/migrations docs/performance-audit-v1.md
git commit -m "perf(saas-10): add composite indexes after tenancy rollout"
```

---

## Task 6 — Load test (k6)

- [ ] **Step 6.1: Create `apps/backend/test/load/k6-booking-load.js`**

```js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    bookings_create: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },   // 100 orgs
        { duration: '5m', target: 100 },   // sustained
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],       // 500ms P95
    http_req_failed:   ['rate<0.01'],       // <1% errors
  },
};

const ORG_TOKENS = new SharedArray('orgs', () => JSON.parse(open('./tokens.json')));

export default function () {
  const t = ORG_TOKENS[Math.floor(Math.random() * ORG_TOKENS.length)];
  const res = http.post('https://staging.carekit.app/api/v1/dashboard/bookings', JSON.stringify({
    branchId: t.branchId, clientId: t.clientId, employeeId: t.employeeId, serviceId: t.serviceId,
    scheduledAt: new Date(Date.now() + Math.random() * 30 * 86400 * 1000).toISOString(),
  }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.token}` } });
  check(res, { '201': (r) => r.status === 201 });
  sleep(1);
}
```

- [ ] **Step 6.2: Seed script**

`apps/backend/test/load/seed-100-orgs.ts` — creates 100 orgs × 100 clients × 10 employees × 20 services + emits `tokens.json`.

- [ ] **Step 6.3: First run → baseline**

```bash
k6 run apps/backend/test/load/k6-booking-load.js
```

Capture output into `docs/performance-baseline-v1.md`:
- P50/P95/P99 latency for booking creation + list + invoice list + login.
- Error rate.
- Throughput (req/sec).
- Infra metrics during run (CPU, memory, DB connections, Redis memory).

- [ ] **Step 6.4: README**

`apps/backend/test/load/README.md` — documents: "Do NOT run in CI. Run manually against staging before each release. Requires 100 seed orgs."

- [ ] **Step 6.5: Commit**

```bash
git add apps/backend/test/load docs/performance-baseline-v1.md
git commit -m "test(saas-10): k6 load test + baseline-v1 (100 orgs × 10k bookings)"
```

---

## Task 7 — Per-tenant data export

- [ ] **Step 7.1: Schema**

Add `DataExportJob` to `platform.prisma`:

```prisma
model DataExportJob {
  id             String   @id @default(uuid())
  organizationId String                                     // SaaS-10 (scoped)
  requestedBy    String                                     // userId
  status         DataExportStatus @default(QUEUED)
  progress       Int      @default(0)                       // 0-100
  objectKey      String?                                    // MinIO key when READY
  sizeBytes      BigInt?
  errorMessage   String?
  requestedAt    DateTime @default(now())
  completedAt    DateTime?
  expiresAt      DateTime?                                  // signed URL expiry (72h after completion)

  @@index([organizationId])
  @@index([status])
}

enum DataExportStatus { QUEUED RUNNING READY FAILED EXPIRED }
```

Add `DataExportJob` to `SCOPED_MODELS`. Migration + run.

- [ ] **Step 7.2: Write tests first**

Create `apps/backend/src/modules/platform/data-export/__tests__/data-export.handler.spec.ts`:

```ts
describe('DataExportHandler', () => {
  it('creates a QUEUED job and enqueues BullMQ work', async () => {
    await handler.execute({ organizationId: 'org-1', userId: 'user-1' });
    expect(queue.add).toHaveBeenCalledWith('export-org-data', { jobId: expect.any(String) });
    const row = await prisma.dataExportJob.findFirst({ where: { organizationId: 'org-1' } });
    expect(row?.status).toBe('QUEUED');
  });
  it('rejects when an existing job is still RUNNING', async () => {
    await prisma.dataExportJob.create({ data: { organizationId: 'org-1', requestedBy: 'user-1', status: 'RUNNING' } });
    await expect(handler.execute({ organizationId: 'org-1', userId: 'user-1' })).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 7.3: Handler + processor**

`data-export.handler.ts` creates the job row + enqueues. `data-export.processor.ts`:

1. Set status=RUNNING.
2. Stream each scoped model's rows using Prisma cursor pagination, JSON-encode per row into a `archiver` zip stream.
3. Stream MinIO file objects (from the org's folder) into the zip.
4. Upload zip to MinIO under `exports/{orgId}/{jobId}.zip`.
5. Update job row: status=READY, objectKey, sizeBytes, completedAt, expiresAt (+72h).
6. Emit an email via `EmailService` with a signed download URL.
7. On any error: status=FAILED, errorMessage.

Stream discipline:
- Never `await prisma.booking.findMany()` without pagination.
- Use `cursor` + `take: 500`.
- Pipe each row as it arrives: `archiver.append(JSON.stringify(row) + '\n', { name: 'bookings.ndjson' })`.

- [ ] **Step 7.4: Controller**

`POST /api/v1/dashboard/export-my-org-data` — OWNER-role-only. Returns `{ jobId, status: 'QUEUED' }`.

`GET /api/v1/dashboard/export-my-org-data/:jobId` — polls status.

- [ ] **Step 7.5: E2E test**

Create `apps/backend/test/e2e/data-export/data-export.e2e-spec.ts`:

```ts
it('runs end-to-end for a small tenant', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/dashboard/export-my-org-data').set('Authorization', `Bearer ${ownerToken}`).expect(201);
  const { jobId } = res.body;

  // Poll until READY (BullMQ processes synchronously in test config)
  let status = 'QUEUED';
  for (let i = 0; i < 30 && status !== 'READY'; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const poll = await request(app.getHttpServer()).get(`/api/v1/dashboard/export-my-org-data/${jobId}`).set('Authorization', `Bearer ${ownerToken}`);
    status = poll.body.status;
  }
  expect(status).toBe('READY');

  // Download + unzip + spot-check
  const row = await prisma.dataExportJob.findUnique({ where: { id: jobId } });
  const buf = await minioDownload(row!.objectKey!);
  const entries = await listZipEntries(buf);
  expect(entries).toContain('bookings.ndjson');
  expect(entries).toContain('clients.ndjson');
  expect(entries).toContain('manifest.json');
});
```

- [ ] **Step 7.6: Commit**

```bash
git add apps/backend/src/modules/platform/data-export apps/backend/test/e2e/data-export apps/backend/prisma
git commit -m "feat(saas-10): per-tenant data export (GDPR-ready ZIP via BullMQ)"
```

---

## Task 8 — Runbook

- [ ] **Step 8.1: Create `docs/runbook.md`**

```markdown
# CareKit Operational Runbook

## Suspend tenant
1. Super-admin dashboard (Plan 05b) → tenant row → "Suspend".
2. Behind the scenes: `UPDATE "Organization" SET status = 'SUSPENDED' WHERE id = $1`.
3. Effect: middleware serves the `suspended.tsx` placeholder; dashboard login still works (read-only) for owner to reactivate.

## Restore tenant
1. Super-admin dashboard → "Reactivate".
2. `UPDATE "Organization" SET status = 'ACTIVE' WHERE id = $1`.
3. Clear Next.js cache: `curl -X POST https://api.carekit.app/internal/cache/invalidate -d '{"tag":"site-settings"}'`.

## Recover from failed migration
1. Do NOT modify the failed migration file (immutability rule).
2. Roll forward: write a new migration that reverses or patches the failed one.
3. If migration crashed mid-way and `_prisma_migrations` is marked failed:
   ```sql
   UPDATE "_prisma_migrations" SET finished_at = now(), logs = 'manual-recovery', rolled_back_at = null WHERE migration_name = '<name>';
   ```
   Then apply the follow-up migration.
4. Run full test + isolation suite after recovery.

## Incident triage matrix
| Symptom | First check | Mitigation |
|---|---|---|
| 5xx spike | Sentry → filter by env | Roll back latest deploy; check DB connections |
| P95 latency >1s | Grafana → platform-health | Check Prisma slow-query log; scale backend |
| Cert issuance failing | Caddy logs | DNS plugin token validity; Let's Encrypt rate limit |
| Tenant cross-read detected | Isolation e2e | Hotfix scoping; audit trail review |

## On-call handoff template
- Active incidents (link): …
- Pending tenant domain verifications: `SELECT * FROM "CustomDomain" WHERE status IN ('PENDING','VERIFYING')`.
- Sentry top issues (last 24h): …
- Load test last run: …
- Known quirks / workarounds: …
```

- [ ] **Step 8.2: Exercise the runbook**

Every scenario must be dry-run in staging. Mark each one as "exercised YYYY-MM-DD" in the doc.

- [ ] **Step 8.3: Commit**

```bash
git add docs/runbook.md
git commit -m "docs(saas-10): operational runbook"
```

---

## Task 9 — Launch checklist

- [ ] **Step 9.1: Create `docs/launch-checklist.md`**

```markdown
# CareKit Launch Checklist (go/no-go)

Every box must be ticked before production launch.

## Code health
- [ ] `npm run test` green across all workspaces
- [ ] `npm run test:e2e` green in staging
- [ ] Penetration suite green (race, fuzz, auth-matrix, injection)
- [ ] Isolation suite green (01-02h)
- [ ] Typecheck green; zero `any` (CLAUDE.md golden rule)

## Performance
- [ ] k6 load-test hits thresholds (P95<500ms, error<1%) against staging
- [ ] `docs/performance-baseline-v1.md` updated with numbers
- [ ] EXPLAIN ANALYZE on top 20 queries — no seq-scan on tenant tables

## Infrastructure
- [ ] Caddy cutover complete, 7-day parallel-run observed
- [ ] Wildcard `*.carekit.app` cert issued and auto-renewing
- [ ] Nginx decommissioned OR scheduled (if within window)
- [ ] Backups verified: `pg_dump` restored to a staging DB and queried

## Observability
- [ ] Sentry DSN set, test error lands with tenant tags
- [ ] Prometheus `/metrics` scraped, dashboard shows live data
- [ ] Grafana dashboards imported (platform + tenant)
- [ ] Alertmanager rules firing on synthetic P95 spike

## Legal + commercial
- [ ] Terms of service, privacy, refund pages published and reviewed by counsel
- [ ] Moyasar production merchant account activated
- [ ] Subscription billing webhook tested end-to-end

## Operations
- [ ] `docs/runbook.md` exercised (every scenario dry-run)
- [ ] On-call rotation scheduled (primary + backup)
- [ ] Customer support channel live (email + in-app)
- [ ] Kiwi TCMS plans green for every MVP domain

## Sign-off
- [ ] Product owner: _______________ date: ______
- [ ] Engineering lead: ___________ date: ______
```

- [ ] **Step 9.2: Commit**

```bash
git add docs/launch-checklist.md
git commit -m "docs(saas-10): go/no-go launch checklist"
```

---

## Task 10 — Docs + memory + PR

- [ ] **Step 10.1: Update root `CLAUDE.md`**

Reference runbook + launch checklist. Add observability section.

- [ ] **Step 10.2: Update `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`**

Flip Plan 10 status. Log progress. At this point the transformation is complete — update the header count.

- [ ] **Step 10.3: Create `memory/saas10_status.md`**

Status + baseline numbers + runbook-exercise dates + launch checklist sign-off state.

- [ ] **Step 10.4: Open PR**

```bash
gh pr create --title "feat(saas-10): hardening + launch" \
  --body "$(cat <<'EOF'
## Summary (OWNER-REVIEW REQUIRED)
- Per-tenant rate limiting (Redis-backed, plan-driven).
- Sentry tenant tags + Prometheus labels + Grafana dashboards.
- Penetration suite: race, fuzz, auth-matrix, injection sweep.
- Performance audit + composite indexes.
- k6 load test (100 orgs × 10k bookings) + baseline doc.
- Per-tenant data export (BullMQ + ZIP + MinIO + signed URL).
- Operational runbook + launch checklist.

## Owner-review items
- Rate-limit bucket sizes (per plan).
- Data export format + retention (72h signed URL).
- Sentry DSN (prod vs staging separation).
- Launch go/no-go sign-off.

## Tests
- TenantThrottlerGuard (4 cases).
- Penetration suite (race, auth-matrix, fuzz, injection).
- Data export handler + e2e.
- k6 load test (manual, documented in test/load/README.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.5: Pre-launch dry-run**

Execute the full launch checklist against staging. Only after all boxes tick → open owner sign-off ticket.

---

## Critical Lessons (to propagate)

1. **Rate-limit key choice changes the fairness model.** org+user is right for dashboard/mobile; IP is right for public endpoints. Never mix.
2. **Prometheus cardinality is load-bearing.** Adding one high-cardinality label (like `userId`) will silently OOM Prometheus. Review every new label against the cardinality budget.
3. **Data export must stream.** Buffering 100k bookings into memory will OOM the backend process. Cursor-paginate + pipe.
4. **Load-test in CI = flaky CI.** Keep it manual, against staging.
5. **Runbook rot is real.** If a scenario hasn't been exercised in 90 days, it's probably wrong. Re-exercise quarterly.
6. **Cross-tenant read = ship-stopper bug.** Pen test suite must be green on every release candidate, no exceptions.

---

## Amendments applied during execution

> _Empty until execution._
