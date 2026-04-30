# Deqah Multi-Tenancy — Engineering Guide

This backend is multi-tenant SaaS. As of SaaS-02h (2026-04-22), `TENANT_ENFORCEMENT=strict` is the platform default and every cluster is scoped (52 tenant-scoped models). Use this document to understand the contract and how to contribute new tenant-aware code correctly.

## Model at a glance

```
Organization (tenant)
  ↑
  └─ Membership (userId, organizationId, role, isActive)
       ↑
       └─ User
```

A `User` may belong to multiple `Organization`s via `Membership`. The JWT carries `organizationId` + `membershipId` for the membership active in that session. Staff users (every `UserRole` except `CLIENT`) received a backfilled membership under the default org; website `CLIENT` users are intentionally excluded — they live in a separate token namespace and must not appear on any clinic's staff list.

## The `TENANT_ENFORCEMENT` flag

Three modes:

| Mode | Meaning |
|---|---|
| `off` | Migration-bootstrap only. No tenant resolution; the Prisma scoping extension is a no-op. Do not use outside of bootstrap scripts. |
| `permissive` | Middleware resolves an org from JWT → X-Org-Id (super-admin only) → `DEFAULT_ORGANIZATION_ID`. Handlers can assume a tenant is always set. Reserved for local dev. |
| `strict` (**default**) | As permissive, but any scoped-model query without CLS tenant context throws `UnauthorizedTenantAccessError`. The platform default since SaaS-02h. |

## The `id` naming convention (important)

`JwtStrategy.validate()` attaches the user to `req.user` with field name `id`, not `userId`. Every guard and handler in the codebase reads `req.user.id`. The `TenantContext` and all tenant plumbing follow the same convention — renaming would force a cascade rewrite of every guard.

When reading from `TenantContextService`:

```ts
const ctx = tenant.get();
ctx?.id              // the user id (formerly would be userId elsewhere)
ctx?.organizationId  // the tenant id
ctx?.membershipId    // the active membership in that org
```

## Writing a tenant-scoped query (once Plan 02 enables your cluster)

```ts
import { TenantContextService } from 'src/common/tenant';

@Injectable()
export class MyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: MyCommand) {
    const orgId = this.tenant.requireOrganizationId();
    return this.prisma.booking.findMany({
      where: { organizationId: orgId, status: 'CONFIRMED' },
    });
  }
}
```

Notes:

- Always pass `organizationId` explicitly in `where`. The Prisma extension injects it as a safety net, but relying on the extension alone hides the intent.
- The extension skips `$queryRaw` — for raw SQL, you must either join on `organization_id` yourself or use `RlsHelper.applyInTransaction` and rely on Plan 02 policies.

## Writing raw SQL (`$queryRaw`, `$executeRawUnsafe`)

Two options, both safe:

### Option A — explicit predicate

```ts
await this.prisma.$queryRaw`
  SELECT * FROM "Booking" WHERE "organizationId" = ${orgId}
`;
```

### Option B — RLS

```ts
await this.prisma.$transaction(async (tx) => {
  await this.rls.applyInTransaction(tx);
  return tx.$queryRaw`SELECT * FROM "Booking"`; // policy filters automatically
});
```

## Adding a new cluster to the scoping registry (Plan 02 only)

1. Add `organizationId String` column to every tenant-scoped model in that cluster's `.prisma` file.
2. Generate + apply migration + backfill.
3. Add each model name to the `SCOPED_MODELS` set in `infrastructure/database/prisma.service.ts`.
4. Enable RLS policy for each table in a new migration.
5. Add cross-tenant tests under `test/tenant-isolation/<cluster>.e2e-spec.ts`.

## `PrismaService` wiring (Prisma 7 specific)

`PrismaService` wraps the `$extends` output with a Proxy rather than `Object.assign(this, extended)`. Prisma 7's extended client uses internal proxy traps that `Object.assign` silently drops — the Proxy pattern preserves them while keeping `PrismaService` a `PrismaClient` subclass for DI and types.

If you need to add a new Prisma extension in the future (caching, logging, etc), compose it inside `buildTenantScopingExtension` or `$extend` it on top of `this.extended` in the constructor — do **not** revert to `Object.assign`.

## Isolation test pattern

Every new cluster must have isolation tests following this shape:

```ts
it('reading org A booking from org B context is forbidden', async () => {
  const a = await h.createOrg('a', 'أ');
  const b = await h.createOrg('b', 'ب');
  const bookingA = await h.runAs({ organizationId: a.id }, () =>
    h.prisma.booking.create({ data: { /* ... */ } }),
  );
  const foundFromB = await h.runAs({ organizationId: b.id }, () =>
    h.prisma.booking.findUnique({ where: { id: bookingA.id } }),
  );
  expect(foundFromB).toBeNull(); // scoped out
});
```

## Red flags during code review

- `prisma.X.findMany({ where: { /* no organizationId */ } })` in a tenant-scoped cluster — the extension saves you, but write it explicitly.
- `$queryRaw` without an `organizationId` predicate and without an RLS transaction wrapper.
- Cross-cluster event payloads missing `organizationId`.
- Super-admin-only endpoints that forget to set `isSuperAdmin: true` in JWT claims.
- Background jobs that don't bootstrap the tenant context before running handlers.

## Cluster rollout playbook

Use this checklist when extending tenant enforcement to a new cluster (SaaS-02b through 02g follow this pattern, derived from the SaaS-02a identity cluster rollout).

### Phase 1 — Schema (additive)
1. Add `organizationId String?` to every tenant-scoped model in the cluster's `.prisma` file.
2. Add `@@index([organizationId])`.
3. Update any `@unique` that should be per-org → composite `@@unique([organizationId, ...])`.
4. Denormalize `organizationId` on child tables where the parent has it — the Prisma scoping extension can't traverse joins, so children need their own column.
5. Generate the migration SQL manually (Prisma `migrate dev` conflicts with the pgvector hooks on this repo; write the ALTER TABLE / FK statements by hand). Mirror the structure of the SaaS-02a `saas02a_identity_add_org_nullable` migration.

### Phase 2 — Backfill
6. Write a second migration that sets `organizationId = '00000000-0000-0000-0000-000000000001'` (the default org seeded in SaaS-01) for every existing row. Idempotent via `WHERE "organizationId" IS NULL`.
7. Verify counts: `SELECT COUNT(*) FROM "<table>" WHERE "organizationId" IS NULL` must return 0 post-backfill.

### Phase 3 — Code updates
8. Every handler that reads/writes these models injects `TenantContextService` and calls `requireOrganizationIdOrDefault()`. The `-OrDefault` variant falls back to `DEFAULT_ORGANIZATION_ID` when no CLS context is set, which keeps `TENANT_ENFORCEMENT=off` mode working.
9. Cross-model queries filter explicitly (don't rely on the Prisma extension alone — write `where: { organizationId }` in handler code so intent is visible in the diff).
10. `updateMany` and `deleteMany` must include `organizationId` in `where` even though the extension handles it — defensive depth.
11. `$queryRaw` calls must either include an explicit `organizationId` predicate or run inside an RLS-wrapped transaction (`SET LOCAL app.current_org_id = ...`).

### Phase 4 — Activate
12. Add the model names to `SCOPED_MODELS` in `src/infrastructure/database/prisma.service.ts`.
13. Replace any `findUnique` that used the old single-field unique with the composite key's Prisma-generated name (e.g., `organizationId_name`). Verify the generated name via `npx prisma generate` output if uncertain.
14. Write a third migration: `ALTER COLUMN "organizationId" SET NOT NULL`, gated by a guard DO-block that aborts if any NULL rows remain.

### Phase 5 — RLS
15. Fourth migration: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` for each table.
16. `CREATE POLICY tenant_isolation_<table> ON "..." USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);` — the `OR ... IS NULL` clause keeps background jobs and migrations working when the GUC isn't set. Plan 02h tightens this.

### Phase 6 — Isolation tests
17. Add a `<cluster>.e2e-spec.ts` under `test/tenant-isolation/` proving:
    - Cross-org read returns null / empty.
    - Cross-org update/delete is blocked (NotFound path in handlers).
    - RLS hides rows at the SQL level when the GUC differs.
    - Super-admin context bypasses scoping.

### Phase 7 — Commits
Each of the above phases is a separate commit prefixed `feat(saas-02X):` / `test(saas-02X):` / `docs(saas-02X):`, matching the granularity used in SaaS-02a.

## Identity cluster example (SaaS-02a)

The first cluster to roll out. Reference commits on branch `feat/saas-02a-identity-cluster`:

- `feat(saas-02a): extend identity schema with organizationId (nullable) on 3 models`
- `feat(saas-02a): migration — add nullable organizationId to identity models + FK + indexes`
- `feat(saas-02a): migration — backfill organizationId=default on identity models`
- `feat(saas-02a): TokenService requires tenantClaims + persists organizationId on RefreshToken`
- `feat(saas-02a): RefreshTokenHandler round-trips organizationId through refresh flow`
- `feat(saas-02a): LogoutHandler scopes revocation by current org`
- `feat(saas-02a): scope all role + permission handlers by current org`
- `feat(saas-02a): migration — NOT NULL organizationId on identity models (after backfill)`
- `feat(saas-02a): activate Prisma scoping extension for identity models`
- `feat(saas-02a): enable RLS + tenant_isolation policies on 3 identity tables`
- `test(saas-02a): identity cluster cross-tenant isolation e2e`
- `chore(saas-02a): default TENANT_ENFORCEMENT=permissive in dev+test`
- `docs(saas-02a): cluster rollout playbook + identity cluster example`

## Client auth tenancy (added in SaaS-02b)

Client JWT carries `organizationId` just like staff JWT. Differences:

- Client tenant resolution happens at registration / login time — which organization is the website currently serving? Until Plan 09 ships subdomain routing, client requests in dev/test fall back to `DEFAULT_ORGANIZATION_ID`. Override in tests via `runAs({ organizationId })` helper.
- Clients with the same phone or email may exist in multiple orgs — uniques are `(organizationId, phone)` / `(organizationId, email)`, not the bare column.
- `ClientRefreshToken.organizationId` mirrors `Client.organizationId`. Inconsistency = bug.
- `ClientJwtStrategy.validate()` propagates `organizationId` into `req.user`, falling back to the stored `Client.organizationId` for tokens issued pre-02b.

### Adding a new client-auth handler

1. Inject `TenantContextService`.
2. Call `tenant.requireOrganizationIdOrDefault()` — uses default org when context is unset (client-facing endpoints predate JwtGuard in the request lifecycle for login/register).
3. When creating a `Client`, pass `organizationId` in `data`.
4. When creating a `ClientRefreshToken`, pass `organizationId` from the parent `Client`.
5. For reads/updates by `id`, use `findFirst({ where: { id, organizationId } })` — not `findUnique` — so the handler-level scoping composes cleanly with the Prisma extension.

## People cluster example (SaaS-02b)

Second cluster to roll out. 7 models scoped: `Client`, `Employee`, `EmployeeBranch`, `EmployeeService`, `EmployeeAvailability`, `EmployeeAvailabilityException`, `ClientRefreshToken`. Key new patterns relative to 02a:

- **Per-org uniques** replacing previously-global unique columns: `Client.phone`, `Employee.email`, `Employee.slug`. Composite unique names (`client_org_phone`, `employee_org_email`, `employee_org_slug`) are passed explicitly via `name:` so `findUnique({ where: { client_org_phone: { organizationId, phone } } })` is stable.
- **Denormalized `organizationId` on child tables** (`EmployeeBranch/Service/Availability/AvailabilityException`). The Prisma scoping extension cannot traverse joins, so children carry their own column. Child-row creates inherit from the parent Employee at write time — no direct `TenantContextService` call needed in those handlers.
- **Client auth** (`register`, `client-login`, `client-refresh`, `client-logout`, `get-me`, `reset-password`) becomes tenant-aware. Uses `requireOrganizationIdOrDefault()` because no JWT guard runs before login/register.

Reference commits on branch `feat/saas-02b-people-cluster`:

- `feat(saas-02b): add organizationId to 7 people-cluster models (nullable) + per-org uniques`
- `feat(saas-02b): migration — add nullable organizationId + FK + per-org uniques on 7 tables`
- `feat(saas-02b): migration — backfill organizationId on 7 people-cluster tables`
- `feat(saas-02b): ClientTokenService requires tenantClaims + persists organizationId`
- `feat(saas-02b): ClientJwtStrategy propagates organizationId to req.user`
- `feat(saas-02b): client register + login scope + set organizationId on Client`
- `feat(saas-02b): client refresh/logout/get-me/reset-password all scope by current org`
- `feat(saas-02b): scope all people-cluster handlers by current org`
- `feat(saas-02b): migration — NOT NULL organizationId on people cluster (after backfill)`
- `feat(saas-02b): activate Prisma scoping extension for 7 people-cluster models`
- `feat(saas-02b): enable RLS + tenant_isolation policies on 7 people-cluster tables`
- `test(saas-02b): people cluster cross-tenant isolation e2e`

## Singleton-conversion pattern (introduced in SaaS-02c)

Some tables that were designed as application-level singletons (`id = 'default'`, one row total) become **per-org singletons** in multi-tenant mode: one row per organization, unique on `organizationId`.

Affected models in Plan 02c: `BrandingConfig`, `OrganizationSettings`.

### Before vs after

| Aspect | Before (global singleton) | After (per-org singleton) |
|---|---|---|
| `id` | `@default("default")` | `@default(uuid())` |
| `organizationId` | absent | `String @unique` |
| Row count | 1 | 1 per org |
| Unique constraint | on `id` (implicit) | on `organizationId` |
| Prisma `upsert` key | `where: { id: 'default' }` | `where: { organizationId }` |

### Schema change

```prisma
model BrandingConfig {
  id             String   @id @default(uuid())   // was @default("default")
  organizationId String   @unique                 // new, NOT NULL, FK → Organization
  organization   Organization @relation(...)
  // ... other fields unchanged
}
```

### Handler upsert pattern

Read-with-fallback — single upsert in the handler that creates on first access, returns existing on subsequent calls:

```typescript
async execute() {
  const organizationId = this.tenant.requireOrganizationId();
  return this.prisma.brandingConfig.upsert({
    where:  { organizationId },
    update: {},                                        // no-op if exists
    create: { organizationId, /* defaults */ },
  });
}
```

For update handlers:

```typescript
async execute(dto: UpdateBrandingConfigCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  return this.prisma.brandingConfig.upsert({
    where:  { organizationId },
    update: { ...dto },
    create: { organizationId, ...dto },
  });
}
```

### Migration steps

1. Add `organizationId String?` (nullable) + FK + unique index.
2. Backfill: `UPDATE "BrandingConfig" SET "organizationId" = '<default-org-id>' WHERE "organizationId" IS NULL`.
3. NOT NULL guard migration (same pattern as non-singleton clusters).
4. RLS migration (identical policy pattern — `organizationId::uuid = app_current_org_id()`).

### Callsite cleanup

Any code referencing `where: { id: 'default' }` must migrate to `where: { organizationId }`. Search for `id: 'default'` + `id: "default"` before closing the PR.

## Org-config + org-experience cluster (SaaS-02c)

Third cluster to roll out. 14 models scoped:

**Org-config** (direct org ownership): `Branch`, `Department`, `ServiceCategory`, `BusinessHour`, `Holiday`  
**Org-experience** (direct org ownership): `Service`, `ServiceBookingConfig`, `ServiceDurationOption`, `EmployeeServiceOption`, `IntakeForm`, `IntakeField`, `Rating`  
**Singletons converted**: `BrandingConfig`, `OrganizationSettings`

Key patterns relative to 02b:

- **Denormalized `organizationId` on child tables**: `BusinessHour`/`Holiday` inherit from `Branch`; `ServiceBookingConfig`/`ServiceDurationOption`/`EmployeeServiceOption` inherit from `Service`; `IntakeField` inherits from `IntakeForm`. Parent handlers pass `organizationId` at create time.
- **Singleton conversion** for `BrandingConfig` and `OrganizationSettings` — see section above.
- 14 SCOPED_MODELS entries added; 14 RLS policies created in a single migration.

Reference commits on branch `feat/saas-02c-org-config-singletons`:

- `feat(saas-02c): extend org-config + org-experience schema — 14 models nullable organizationId`
- `feat(saas-02c): migration — add nullable organizationId to 14 org-config/experience tables`
- `feat(saas-02c): migration — backfill organizationId on 14 tables`
- `feat(saas-02c): scope all org-config + org-experience handlers by current org`
- `feat(saas-02c): migration — NOT NULL organizationId on 14 tables (after backfill)`
- `feat(saas-02c): activate Prisma scoping extension for 14 org-config/experience models`
- `feat(saas-02c): enable RLS + tenant_isolation policies on 14 tables`
- `test(saas-02c): org-config, org-experience, and singleton isolation e2e specs`
- `docs(saas-02c): singleton-conversion pattern + 02c cluster example`
