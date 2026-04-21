# CareKit Multi-Tenancy — Engineering Guide

This backend is transitioning from single-tenant to multi-tenant SaaS. The transition is **in progress** — not every cluster is scoped yet. Use this document to understand what's enforced today, what isn't, and how to contribute new tenant-aware code correctly.

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
| `off` (default) | No tenant resolution. The Prisma scoping extension is a no-op. RLS policies are installed but unused. System behaves as single-tenant. |
| `permissive` | Middleware resolves an org from JWT → X-Org-Id (super-admin only) → `DEFAULT_ORGANIZATION_ID`. Handlers can assume a tenant is always set. |
| `strict` | As permissive, but missing resolution throws `TenantResolutionError`. |

Production target after Plan 10 is `strict`. Every phase after Plan 01 runs in `permissive` until the last cluster is migrated.

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
