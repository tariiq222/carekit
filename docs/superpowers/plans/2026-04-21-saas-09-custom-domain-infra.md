# SaaS-09 — Custom Domain + Infra (Caddy On-Demand TLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
>
> **Owner-review required:** this plan replaces the edge reverse proxy (Nginx → Caddy), changes TLS termination, and adds a new external exposure (`/public/domain-verified` ask endpoint). Every infra task below must be approved by the owner before merge. The cutover itself (DNS flip) happens in a maintenance window and is reversible within a 7-day parallel-run window.

**Goal:** Enable each tenant to bind a custom domain (e.g., `dr-ahmed-clinic.com`) to their `apps/website` with automatic per-domain TLS. Uses Caddy's on-demand TLS mechanism gated by a backend ask endpoint. Wildcard certificate handles `*.deqah.app` via Let's Encrypt DNS-01 challenge. Per-tenant TXT verification proves domain ownership before Caddy is allowed to issue certificates.

**Architecture:**

```
DNS → Caddy (edge, TLS)
        ├── deqah.app, www.deqah.app        → apps/landing :5105
        ├── *.deqah.app (wildcard)            → apps/website :5104
        ├── admin.deqah.app                   → apps/admin :5106 (future, Plan 05b)
        ├── api.deqah.app                     → apps/backend :5100
        └── <custom-domain> (on-demand TLS)     → apps/website :5104
            ↑ only if GET /api/v1/public/domain-verified?host=<h> returns 200
```

The Nginx→Caddy swap keeps Nginx running in a parallel docker-compose service for 7 days. DNS points at Caddy; if Caddy falls over, DNS can flip back to Nginx without a redeploy. After 7 days of green metrics, Nginx is decommissioned in a follow-up PR.

**Tech Stack:** Caddy v2.8+ (with Cloudflare or Route53 DNS plugin for wildcard ACME), NestJS 11, Prisma 7, BullMQ, `dns.promises` (node core) for TXT resolution, Jest + Supertest, Docker Compose.

---

## Critical lessons carried forward

1. **On-demand TLS without an ask endpoint is a DoS vector.** Caddy will try to issue a cert for any Host header it sees. The ask endpoint (`GET /api/v1/public/domain-verified?host=X`) MUST return 200 only for hostnames our DB has marked ACTIVE. Rate-limit the endpoint (30 req/min/IP); it's unauthenticated.
2. **TXT records take time to propagate.** The verify worker polls every 5 minutes, retries for 24 hours, then marks FAILED. UI must communicate this clearly.
3. **DNS plugin auth lives in secrets.** Caddy's Cloudflare DNS plugin needs an API token. Store in docker secrets / env file never committed. Use `CLOUDFLARE_API_TOKEN` env var pattern.
4. **Wildcard cert renewal needs DNS-01**, not HTTP-01. Cloudflare token scoped to `Zone: DNS: Edit` on `deqah.app` only.
5. **Never put the API origin behind the custom-domain cert.** `api.deqah.app` only. Tenants never see `yourdomain.com/api/*` — CORS + cross-origin is the pattern.
6. **Rollback plan is not optional.** Document the DNS flip-back steps.
7. **Caddy must NOT emit CORS headers** (BLOCKER). An earlier draft had `header Access-Control-Allow-Origin "https://{http.request.header.Origin}"` on `api.deqah.app` — that reflects any origin and, combined with credentialed requests, lets any site call the API as the logged-in user. CORS lives in the NestJS app (`app.enableCors`) and validates origins against a per-tenant allowlist before echoing. Caddy proxies only.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `apps/backend/prisma/schema/platform.prisma` (modify) | Add `CustomDomain` model |
| `apps/backend/prisma/migrations/<ts>_saas_09_custom_domains/migration.sql` | Create table |
| `apps/backend/src/modules/platform/domains/` | Full cluster (add/verify/remove handlers + controller + service + types) |
| `apps/backend/src/modules/platform/domains/add-domain.handler.ts` | Tenant adds a domain |
| `apps/backend/src/modules/platform/domains/verify-domain.handler.ts` | On-demand retry |
| `apps/backend/src/modules/platform/domains/remove-domain.handler.ts` | Tenant removes |
| `apps/backend/src/modules/platform/domains/get-domain.handler.ts` | Status read |
| `apps/backend/src/modules/platform/domains/dns-resolver.service.ts` | Wraps `dns.promises.resolveTxt` — mockable |
| `apps/backend/src/modules/platform/domains/generate-challenge.ts` | Pure fn: `deqah-verify=<random>` |
| `apps/backend/src/modules/platform/domains/domains.controller.ts` | Dashboard CRUD |
| `apps/backend/src/api/public/domain-ask.controller.ts` | `GET /api/v1/public/domain-verified?host=X` — Caddy ask endpoint |
| `apps/backend/src/modules/platform/domains/verify-domain.cron.ts` | BullMQ repeat job every 5min |
| `apps/backend/src/modules/platform/domains/__tests__/*.spec.ts` | Unit tests per handler |
| `apps/backend/test/e2e/domains/custom-domain.e2e-spec.ts` | E2E add→verify→ACTIVE |
| `apps/dashboard/app/(dashboard)/settings/domain/page.tsx` | `/settings/domain` UI |
| `apps/dashboard/app/(dashboard)/settings/domain/components/*.tsx` | Add-domain form + status card + DNS instructions |
| `apps/dashboard/hooks/use-custom-domain.ts` | TanStack Query hook |
| `docker/caddy/Caddyfile` | Edge config |
| `docker/caddy/Dockerfile` | Caddy image with DNS plugin |
| `docker/docker-compose.yml` (modify) | Add `caddy` service; keep `nginx` service running in parallel |
| `docker/CADDY_MIGRATION.md` | Cutover runbook + rollback steps |

### Modified files

- `apps/backend/src/api/public/public.module.ts` — register `DomainAskController`
- `apps/backend/src/modules/platform/platform.module.ts` — register domains module
- `apps/backend/src/infrastructure/database/prisma.service.ts` — add `CustomDomain` to SCOPED_MODELS
- `packages/api-client/src/endpoints/dashboard/domains.ts` — typed client
- Root `CLAUDE.md` — note Caddy is edge proxy

---

## Task 1 — Schema: `CustomDomain` model

- [ ] **Step 1.1: Add model to `apps/backend/prisma/schema/platform.prisma`**

```prisma
model CustomDomain {
  id              String   @id @default(uuid())
  organizationId  String   @unique                       // one-to-one with Organization
  hostname        String   @unique                       // normalized lowercase, e.g. "clinic.com"
  status          CustomDomainStatus @default(PENDING)
  dnsTxtChallenge String                                 // "deqah-verify=<random>"
  verifiedAt      DateTime?
  lastCheckedAt   DateTime?
  failureReason   String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([hostname])
  @@index([status])
}

enum CustomDomainStatus {
  PENDING
  VERIFYING
  ACTIVE
  FAILED
}
```

Add `customDomain CustomDomain?` relation to the `Organization` model.

- [ ] **Step 1.2: Migration**

```bash
cd apps/backend && npx prisma migrate dev --name saas_09_custom_domains
```

- [ ] **Step 1.3: Add to SCOPED_MODELS**

Edit `apps/backend/src/infrastructure/database/prisma.service.ts`:

```ts
// 09 — custom domains
'CustomDomain',
```

Note: `CustomDomain` is `@unique` on organizationId (one-per-org). Scoping ensures a tenant can only read their own domain row.

- [ ] **Step 1.4: Commit**

```bash
git add apps/backend/prisma apps/backend/src/infrastructure/database
git commit -m "feat(saas-09): CustomDomain model + migration + SCOPED_MODELS"
```

---

## Task 2 — Backend: add/get/remove domain handlers

- [ ] **Step 2.1: Write tests first**

Create `apps/backend/src/modules/platform/domains/__tests__/add-domain.handler.spec.ts`:

```ts
describe('AddDomainHandler', () => {
  it('creates CustomDomain with generated TXT challenge', async () => {
    const result = await handler.execute({ hostname: 'My-Clinic.COM ' });
    expect(result.hostname).toBe('my-clinic.com');         // normalized
    expect(result.dnsTxtChallenge).toMatch(/^deqah-verify=[a-f0-9]{32}$/);
    expect(result.status).toBe('PENDING');
  });
  it('rejects invalid hostnames', async () => {
    await expect(handler.execute({ hostname: 'not a domain' })).rejects.toThrow(BadRequestException);
  });
  it('rejects duplicate hostnames across orgs', async () => {
    await handler.execute({ hostname: 'taken.com' });
    await expect(handler.execute({ hostname: 'taken.com' })).rejects.toThrow(ConflictException);
  });
  it('rejects reserved hostnames (*.deqah.app)', async () => {
    await expect(handler.execute({ hostname: 'anything.deqah.app' })).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2.2: Implement `generate-challenge.ts`**

```ts
import { randomBytes } from 'node:crypto';
export function generateChallenge(): string {
  return `deqah-verify=${randomBytes(16).toString('hex')}`;
}
```

Pure fn — write a 2-case unit test (format + uniqueness across 1000 calls).

- [ ] **Step 2.3: Implement `add-domain.handler.ts`**

```ts
@Injectable()
export class AddDomainHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: { hostname: string }) {
    const organizationId = this.tenant.requireOrganizationId();
    const hostname = cmd.hostname.trim().toLowerCase();

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname)) {
      throw new BadRequestException('invalid_hostname');
    }
    if (hostname.endsWith('.deqah.app') || hostname === 'deqah.app') {
      throw new BadRequestException('reserved_hostname');
    }

    const existing = await this.prisma.customDomain.findUnique({ where: { hostname } });
    if (existing) throw new ConflictException('hostname_taken');

    return this.prisma.customDomain.create({
      data: {
        organizationId,
        hostname,
        dnsTxtChallenge: generateChallenge(),
        status: 'PENDING',
      },
    });
  }
}
```

- [ ] **Step 2.4: Implement `get-domain.handler.ts` + `remove-domain.handler.ts`**

Get → returns the single CustomDomain row for the tenant (or null).
Remove → deletes the row. No extra state cleanup (Caddy will stop responding for that host as soon as the ask endpoint returns 404).

- [ ] **Step 2.5: Implement controller**

`apps/backend/src/modules/platform/domains/domains.controller.ts` — dashboard-authenticated (JwtAuthGuard). Routes:
- `GET /api/v1/dashboard/domain`
- `POST /api/v1/dashboard/domain`  `{ hostname }`
- `POST /api/v1/dashboard/domain/verify` — triggers immediate verification attempt
- `DELETE /api/v1/dashboard/domain`

- [ ] **Step 2.6: Run**

```bash
cd apps/backend && npx jest modules/platform/domains --no-coverage
```

- [ ] **Step 2.7: Commit**

```bash
git add apps/backend/src/modules/platform/domains
git commit -m "feat(saas-09): add/get/remove CustomDomain handlers + controller"
```

---

## Task 3 — Verification worker

- [ ] **Step 3.1: Write test for `verify-domain.handler.ts`**

```ts
describe('VerifyDomainHandler', () => {
  it('marks ACTIVE when DNS returns the expected TXT', async () => {
    dns.resolveTxt.mockResolvedValue([['deqah-verify=abc123']]);
    await handler.execute({ id: 'dom-1' });
    const row = await prisma.customDomain.findUnique({ where: { id: 'dom-1' } });
    expect(row.status).toBe('ACTIVE');
    expect(row.verifiedAt).toBeInstanceOf(Date);
  });
  it('stays VERIFYING when TXT is missing', async () => {
    dns.resolveTxt.mockRejectedValue(new Error('ENODATA'));
    await handler.execute({ id: 'dom-1' });
    const row = await prisma.customDomain.findUnique({ where: { id: 'dom-1' } });
    expect(row.status).toBe('VERIFYING');
    expect(row.lastCheckedAt).toBeInstanceOf(Date);
  });
  it('marks FAILED after 24h of unsuccessful checks', async () => {
    await prisma.customDomain.update({
      where: { id: 'dom-1' },
      data: { status: 'VERIFYING', createdAt: new Date(Date.now() - 25 * 3600 * 1000) },
    });
    dns.resolveTxt.mockRejectedValue(new Error('ENODATA'));
    await handler.execute({ id: 'dom-1' });
    const row = await prisma.customDomain.findUnique({ where: { id: 'dom-1' } });
    expect(row.status).toBe('FAILED');
  });
});
```

- [ ] **Step 3.2: Implement `dns-resolver.service.ts`**

```ts
import { promises as dns } from 'node:dns';

@Injectable()
export class DnsResolverService {
  async resolveTxt(hostname: string): Promise<string[][]> {
    return dns.resolveTxt(hostname);
  }
}
```

Thin wrapper — makes mocking trivial.

- [ ] **Step 3.3: Implement `verify-domain.handler.ts`**

```ts
@Injectable()
export class VerifyDomainHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dns: DnsResolverService,
  ) {}

  async execute(cmd: { id: string }) {
    const row = await this.prisma.customDomain.findUnique({ where: { id: cmd.id } });
    if (!row) return;
    if (row.status === 'ACTIVE') return;

    const now = new Date();
    let records: string[][] = [];
    try {
      records = await this.dns.resolveTxt(row.hostname);
    } catch (e) {
      return this.markFailedIfExpired(row, (e as Error).message);
    }

    const flat = records.flat();
    if (flat.includes(row.dnsTxtChallenge)) {
      await this.prisma.customDomain.update({
        where: { id: row.id },
        data: { status: 'ACTIVE', verifiedAt: now, lastCheckedAt: now, failureReason: null },
      });
      return;
    }
    return this.markFailedIfExpired(row, 'txt_not_found');
  }

  private async markFailedIfExpired(row: CustomDomain, reason: string) {
    const ageMs = Date.now() - row.createdAt.getTime();
    const twentyFourHours = 24 * 3600 * 1000;
    const status = ageMs > twentyFourHours ? 'FAILED' : 'VERIFYING';
    await this.prisma.customDomain.update({
      where: { id: row.id },
      data: { status, lastCheckedAt: new Date(), failureReason: reason },
    });
  }
}
```

- [ ] **Step 3.4: BullMQ cron**

Create `apps/backend/src/modules/platform/domains/verify-domain.cron.ts` — registers a repeatable job every 5 minutes that enumerates all `status IN (PENDING, VERIFYING)` rows and enqueues a job per row. The job processor calls `VerifyDomainHandler.execute`.

- [ ] **Step 3.5: Run**

```bash
cd apps/backend && npx jest modules/platform/domains/__tests__/verify-domain --no-coverage
```

- [ ] **Step 3.6: Commit**

```bash
git add apps/backend/src/modules/platform/domains
git commit -m "feat(saas-09): DNS TXT verification worker + BullMQ cron"
```

---

## Task 4 — Caddy ask endpoint

- [ ] **Step 4.1: Write e2e test**

Create `apps/backend/test/e2e/domains/domain-ask.e2e-spec.ts`:

```ts
describe('GET /api/v1/public/domain-verified', () => {
  it('returns 200 for an ACTIVE custom domain', async () => {
    await prisma.customDomain.create({ data: { organizationId: ORG_ID, hostname: 'ok.example.com', status: 'ACTIVE', dnsTxtChallenge: 'x' } });
    await request(app.getHttpServer()).get('/api/v1/public/domain-verified?host=ok.example.com').expect(200);
  });
  it('returns 404 for PENDING/VERIFYING/FAILED', async () => {
    await prisma.customDomain.create({ data: { organizationId: ORG_ID, hostname: 'pending.example.com', status: 'PENDING', dnsTxtChallenge: 'x' } });
    await request(app.getHttpServer()).get('/api/v1/public/domain-verified?host=pending.example.com').expect(404);
  });
  it('returns 200 for *.deqah.app (wildcard fast-path)', async () => {
    await request(app.getHttpServer()).get('/api/v1/public/domain-verified?host=any.deqah.app').expect(200);
  });
  it('returns 404 for unknown host', async () => {
    await request(app.getHttpServer()).get('/api/v1/public/domain-verified?host=never-seen.com').expect(404);
  });
  it('is rate-limited after 30 requests/min/IP', async () => {
    // hammer then expect 429
  });
});
```

- [ ] **Step 4.2: Implement controller**

Create `apps/backend/src/api/public/domain-ask.controller.ts`:

```ts
@Controller('public/domain-verified')
@UseGuards(PublicThrottlerGuard) // 30 req/min/IP
export class DomainAskController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Query('host') host: string, @Res() res: Response) {
    if (!host) return res.status(400).send();
    const h = host.trim().toLowerCase();
    if (h === 'deqah.app' || h.endsWith('.deqah.app')) {
      return res.status(200).send('ok');
    }
    const row = await this.prisma.customDomain.findUnique({ where: { hostname: h } });
    if (row && row.status === 'ACTIVE') return res.status(200).send('ok');
    return res.status(404).send('not-verified');
  }
}
```

Note: `CustomDomain` is SCOPED but this endpoint runs without a tenant. Public endpoints use `tenant.requireOrganizationIdOrDefault()` pattern or must bypass the Proxy — in this case, the ask endpoint reads ACROSS tenants (it's a hostname lookup). Options:
- **Preferred:** exclude this specific query path from the Proxy, OR add a platform-level `findByHostname` method on a repository that uses `$queryRaw` to skip the extension.
- **Alternative:** `this.prisma.$extends({}).customDomain.findUnique(...)` — document in code.

Use the `$queryRaw` approach with an explicit SQL statement and cast:

```ts
const rows = await this.prisma.$queryRaw<Array<{ status: string }>>`
  SELECT status FROM "CustomDomain" WHERE lower(hostname) = ${h} LIMIT 1
`;
const ok = rows[0]?.status === 'ACTIVE';
```

Per root CLAUDE.md invariant 4, `$queryRaw` usually needs an `organization_id` predicate. Exception documented here: this endpoint is a platform-level lookup-by-unique-hostname and cannot filter by `organizationId` because we don't have a tenant context — hostname uniqueness provides the guarantee. Add a code comment citing this invariant exception.

- [ ] **Step 4.3: Run**

```bash
cd apps/backend && npm run test:e2e -- domains/domain-ask
```

- [ ] **Step 4.4: Commit**

```bash
git add apps/backend/src/api/public/domain-ask.controller.ts apps/backend/test/e2e/domains
git commit -m "feat(saas-09): Caddy ask endpoint /api/v1/public/domain-verified"
```

---

## Task 5 — Dashboard `/settings/domain` page

- [ ] **Step 5.1: TanStack Query hook**

Create `apps/dashboard/hooks/use-custom-domain.ts`:

```ts
export function useCustomDomain() {
  return useQuery({ queryKey: ['custom-domain'], queryFn: api.domains.get });
}
export function useAddDomain() {
  return useMutation({ mutationFn: api.domains.add, onSuccess: () => qc.invalidateQueries({ queryKey: ['custom-domain'] }) });
}
export function useVerifyDomain() { /* … */ }
export function useRemoveDomain() { /* … */ }
```

- [ ] **Step 5.2: Build page**

Create `apps/dashboard/app/(dashboard)/settings/domain/page.tsx`:

Follows the Page Anatomy Law (but this is a settings page with no list → simplified layout):

- Breadcrumbs → Settings → Domain
- PageHeader: title + description
- If no custom domain: card with AddDomainForm
- If domain exists:
  - Status badge (PENDING / VERIFYING / ACTIVE / FAILED) with colored indicator
  - DNS instructions card: "Add this TXT record to your DNS: `_deqah-verify.{hostname}` → `{dnsTxtChallenge}`" + copy-to-clipboard button
  - CNAME instructions: "Point `{hostname}` to `{slug}.deqah.app` via CNAME"
  - "Re-check now" button (triggers `POST /api/v1/dashboard/domain/verify`)
  - "Remove domain" button with confirm dialog

- [ ] **Step 5.3: i18n**

Add all strings to dashboard `messages/ar.json` + `en.json`.

- [ ] **Step 5.4: Typecheck + build**

```bash
npm run typecheck --workspace=dashboard && npm run build --workspace=dashboard
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/dashboard/app/(dashboard)/settings/domain apps/dashboard/hooks/use-custom-domain.ts
git commit -m "feat(saas-09): /settings/domain dashboard UI"
```

---

## Task 6 — Caddyfile + Docker

- [ ] **Step 6.1: Create `docker/caddy/Caddyfile`**

```caddyfile
{
    email ops@deqah.app
    on_demand_tls {
        ask http://backend:5100/api/v1/public/domain-verified
        interval 2m
        burst    5
    }
    storage file_system /data/caddy
}

# Marketing + auth (apps/landing)
deqah.app, www.deqah.app {
    reverse_proxy landing:5105
    encode gzip zstd
    header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
}

# Tenant dashboards and websites share *.deqah.app via Host routing;
# for MVP, dashboards live at {slug}.deqah.app/dashboard and the website claims
# the rest. We proxy everything to the website, which handles /dashboard via its own
# middleware or a redirect to the dashboard origin. If separated in future:
*.deqah.app {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }
    @dashboard path /dashboard /dashboard/*
    handle @dashboard {
        reverse_proxy dashboard:5103
    }
    handle {
        reverse_proxy website:5104
    }
}

api.deqah.app {
    reverse_proxy backend:5100
    # CORS is handled by the NestJS app (see apps/backend/src/main.ts — `app.enableCors({ origin: <dynamic-allowlist> })`).
    # Do NOT reflect the Origin header here. Reflecting `{http.request.header.Origin}` unconditionally
    # (especially with credentials) is a well-known CORS vulnerability — any site can make authenticated
    # requests on behalf of the user. The backend validates the origin against a per-tenant allowlist
    # (the tenant's registered custom domain + `{slug}.deqah.app` + `admin.deqah.app` + `deqah.app`)
    # before echoing `Access-Control-Allow-Origin`. Caddy only proxies; it never writes CORS headers.
}

admin.deqah.app {
    reverse_proxy admin:5106   # Plan 05b
}

# On-demand TLS — anything else (custom tenant domains)
:443 {
    tls {
        on_demand
    }
    reverse_proxy website:5104
}
```

- [ ] **Step 6.2: Create `docker/caddy/Dockerfile`**

```dockerfile
FROM caddy:2.8-builder AS builder
RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

FROM caddy:2.8
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
VOLUME /data
```

- [ ] **Step 6.3: Update `docker/docker-compose.yml`**

Add service (keep `nginx` service intact for parallel-run):

```yaml
caddy:
  build: ./caddy
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - caddy_data:/data
    - caddy_config:/config
  environment:
    - CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
  depends_on:
    - landing
    - website
    - dashboard
    - backend
  restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

Leave `nginx` service running on alternate ports (e.g., 8080/8443) during the parallel-run window so DNS can flip back.

- [ ] **Step 6.4: Cutover runbook — `docker/CADDY_MIGRATION.md`**

```markdown
# Caddy Cutover Runbook (SaaS-09)

## Pre-flight
- [ ] Cloudflare API token with `Zone:DNS:Edit` scope on `deqah.app` stored in secret `CLOUDFLARE_API_TOKEN`.
- [ ] Wildcard cert issuance tested in staging (boot Caddy, confirm `*.deqah.app` cert via `curl -v https://staging.deqah.app`).
- [ ] Ask endpoint returns 200 for known ACTIVE domains in staging DB.
- [ ] Nginx running on ports 8080/8443 (shadow).

## Cutover (maintenance window, ~15 min)
1. `npm run docker:up caddy` — boot Caddy on 80/443.
2. Verify: `curl -sI https://deqah.app | head -1` → 200.
3. Verify: `curl -sI https://<test-tenant>.deqah.app | head -1` → 200.
4. Verify: `curl -sI https://api.deqah.app/api/v1/health | head -1` → 200.
5. Add a known test custom domain (`test.example.com` pointing at our IP + TXT verified) and verify: `curl -sI https://test.example.com | head -1` → 200 after ~30 sec (first-hit cert issuance).
6. Monitor Caddy logs for errors: `docker logs -f caddy`.
7. Monitor Sentry: zero new error spike.

## Parallel-run (7 days)
- Nginx stays up on 8080/8443.
- DNS `A` record for `deqah.app` points at the host IP → Caddy claims 80/443.
- If anything breaks: flip `docker-compose` port mapping of `nginx` back to 80/443 and stop `caddy` — takes <30 sec.
- After 7 days of clean metrics: remove `nginx` service in a follow-up PR.

## Rollback (if Caddy fails in first 7 days)
1. `docker compose stop caddy`.
2. `docker compose up -d nginx` with port mapping restored to 80/443.
3. DNS unchanged (still points at the host IP).
4. Total downtime ~1-2 minutes.

## Decommission (after 7 days green)
1. Delete `nginx` service from `docker/docker-compose.yml`.
2. Delete `docker/nginx/` directory.
3. Open follow-up PR titled "chore(saas-09): decommission Nginx after Caddy stable".
```

- [ ] **Step 6.5: Commit**

```bash
git add docker/caddy docker/docker-compose.yml docker/CADDY_MIGRATION.md
git commit -m "feat(saas-09): Caddy edge proxy with on-demand TLS + parallel Nginx"
```

---

## Task 7 — E2E: full add-domain flow

- [ ] **Step 7.1: Create e2e test**

Create `apps/backend/test/e2e/domains/custom-domain.e2e-spec.ts`:

```ts
describe('Custom domain full flow', () => {
  it('add → poll (no TXT) → stays VERIFYING → DNS returns TXT → ACTIVE → ask returns 200', async () => {
    // 1. add
    const addRes = await request(app.getHttpServer())
      .post('/api/v1/dashboard/domain')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ hostname: 'my-test-clinic.example' })
      .expect(201);
    const challenge = addRes.body.dnsTxtChallenge;
    expect(challenge).toMatch(/^deqah-verify=[a-f0-9]{32}$/);

    // 2. verify with no DNS — stays VERIFYING
    dnsMock.resolveTxt.mockRejectedValue(new Error('ENODATA'));
    await request(app.getHttpServer())
      .post('/api/v1/dashboard/domain/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    let status = (await request(app.getHttpServer())
      .get('/api/v1/dashboard/domain')
      .set('Authorization', `Bearer ${ownerToken}`)).body.status;
    expect(status).toBe('VERIFYING');

    // 3. DNS now returns TXT → ACTIVE
    dnsMock.resolveTxt.mockResolvedValue([[challenge]]);
    await request(app.getHttpServer())
      .post('/api/v1/dashboard/domain/verify')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    status = (await request(app.getHttpServer())
      .get('/api/v1/dashboard/domain')
      .set('Authorization', `Bearer ${ownerToken}`)).body.status;
    expect(status).toBe('ACTIVE');

    // 4. Ask endpoint returns 200
    await request(app.getHttpServer())
      .get('/api/v1/public/domain-verified?host=my-test-clinic.example')
      .expect(200);

    // 5. Remove
    await request(app.getHttpServer())
      .delete('/api/v1/dashboard/domain')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/public/domain-verified?host=my-test-clinic.example')
      .expect(404);
  });
});
```

- [ ] **Step 7.2: Run**

```bash
cd apps/backend && npm run test:e2e -- domains/custom-domain
```

- [ ] **Step 7.3: Commit**

```bash
git add apps/backend/test/e2e/domains/custom-domain.e2e-spec.ts
git commit -m "test(saas-09): full add→verify→ACTIVE→remove e2e"
```

---

## Task 8 — Infra validation

- [ ] **Step 8.1: Caddy config test**

Add to `docker/caddy/test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Lint Caddyfile
docker run --rm -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile" caddy:2.8 caddy validate --config /etc/caddy/Caddyfile
```

Run locally and confirm no lint errors.

- [ ] **Step 8.2: Cert staging**

Spin up Caddy against Let's Encrypt **staging** (modify Caddyfile `acme_ca` for smoke test), issue a wildcard cert, confirm no rate-limit hits. Then switch back to production ACME.

- [ ] **Step 8.3: Ask-endpoint integration**

From a shell on the caddy container: `curl -v http://backend:5100/api/v1/public/domain-verified?host=example.com` — confirm 404 for unknown + 200 for ACTIVE.

---

## Task 9 — Docs + memory + PR

- [ ] **Step 9.1: Update root `CLAUDE.md`**

Note that Caddy is now the edge proxy and reference `docker/CADDY_MIGRATION.md` for cutover/rollback.

- [ ] **Step 9.2: Update `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`**

Flip Plan 09 status. Log progress.

- [ ] **Step 9.3: Create `memory/saas09_status.md`**

Status + Caddy cutover date + rollback window end date + any divergences.

- [ ] **Step 9.4: Open PR**

```bash
gh pr create --title "feat(saas-09): custom domains + Caddy on-demand TLS" \
  --body "$(cat <<'EOF'
## Summary (OWNER-REVIEW REQUIRED)
- New CustomDomain model + /settings/domain dashboard UI.
- DNS TXT verification worker (BullMQ 5-min cron, 24h FAILED timeout).
- Caddy replaces Nginx as edge proxy with on-demand TLS gated by /api/v1/public/domain-verified ask endpoint.
- Wildcard *.deqah.app via Cloudflare DNS plugin.
- 7-day parallel-run window: Nginx stays on 8080/8443 as rollback target.

## Owner-review items
- Edge proxy swap Nginx→Caddy (infra, owner-only per root CLAUDE.md).
- New public unauthenticated endpoint /api/v1/public/domain-verified (security-sensitive, rate-limited).
- CLOUDFLARE_API_TOKEN secret added.

## Tests
- add-domain handler (4 cases), verify-domain handler (3 cases), generate-challenge (2 cases), full flow e2e.
- Caddy config lint.

## Rollback
See docker/CADDY_MIGRATION.md — 1-2 min rollback via docker-compose port flip.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Critical Lessons (to propagate)

1. **Caddy on-demand TLS + no ask endpoint = DoS amplification.** The ask endpoint is non-negotiable.
2. **Wildcard cert uses DNS-01, not HTTP-01.** Make sure the DNS plugin + token scope are right before cutover.
3. **`$queryRaw` invariant has platform exceptions** — when genuinely querying by a globally-unique field without a tenant context, document the exception inline.
4. **Parallel-run is cheap insurance.** Leave the old proxy up for a week. DNS flips are fast; container rebuilds are not.
5. **`CustomDomain` is @unique on organizationId** — one domain per org for MVP. Multi-domain support is a follow-up (not in scope).

---

## Amendments applied during execution

> _Empty until execution._
