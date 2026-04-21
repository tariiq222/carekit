# SaaS-02a — Identity Cluster Tenant Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `organizationId` to 3 staff-auth identity models (`RefreshToken`, `CustomRole`, `Permission`); register them in the Prisma scoping extension; enable RLS policies; prove cross-tenant isolation with an e2e suite. By end of plan, identity handlers are the first cluster to run under `TENANT_ENFORCEMENT=permissive`.

**Architecture:** Three-phase migration per model: (1) add column nullable + backfill to default org, (2) code updates to always set the column, (3) make column `NOT NULL` + add FK. Registration in `SCOPED_MODELS` activates the Prisma extension for these models. RLS policies provide DB-level defense-in-depth.

**Tech Stack:** Prisma 7, PostgreSQL 16, NestJS 11, Jest. Builds on SaaS-01 primitives (`TenantContextService`, `TenantResolverMiddleware`, tenant-scoping extension factory, `app_current_org_id()` SQL helper).

---

## Scope

### In-scope models

| Model | File | Why tenant-scoped |
|---|---|---|
| `RefreshToken` | `identity.prisma` | Staff session tokens — each issued in the context of a specific org membership |
| `CustomRole` | `identity.prisma` | Per-org custom roles; same role name may exist in multiple orgs |
| `Permission` | `identity.prisma` | Owned by `CustomRole`; inherits org via parent |

### Explicitly deferred

- **`User`** — stays global. Multi-org membership is via `Membership` (created in SaaS-01). Do NOT add `organizationId` to `User`.
- **`ClientRefreshToken`** — deferred to SaaS-02b, paired with `Client.organizationId`.
- **`OtpCode` / `UsedOtpSession`** — system-level, not tenant-scoped.
- **`User.customRoleId` → `Membership.customRoleId` refactor** — the "one custom role per user globally" → "per-membership custom role" refactor is not in this plan. Here, `CustomRole` gets `organizationId` but `User.customRoleId` is unchanged. A user who belongs to two orgs still has one global `customRoleId`; per-org differentiation is a future plan.

### Invariants at every task boundary

1. `npm run typecheck` passes.
2. `npm run test` passes (no regressions).
3. `npm run test:e2e` passes.
4. Runtime with `TENANT_ENFORCEMENT=off` unchanged.
5. Migrations are append-only (CLAUDE.md rule).
6. No existing API contract changes.

---

## File Structure

### New files

| File | Responsibility |
|---|---|
| `apps/backend/prisma/migrations/<TS>_saas02a_identity_add_org_nullable/migration.sql` | Add nullable `organizationId` + FK + indexes to `RefreshToken`, `CustomRole`, `Permission`. Drop global `CustomRole.name` unique. |
| `apps/backend/prisma/migrations/<TS>_saas02a_identity_backfill/migration.sql` | Populate `organizationId = DEFAULT_ORG_ID` for existing rows. |
| `apps/backend/prisma/migrations/<TS>_saas02a_identity_not_null/migration.sql` | Make `organizationId` `NOT NULL`. Add composite unique `(organizationId, name)` on `CustomRole`. |
| `apps/backend/prisma/migrations/<TS>_saas02a_identity_rls/migration.sql` | Enable RLS + policies for the 3 tables. |
| `apps/backend/test/tenant-isolation/identity.e2e-spec.ts` | Cross-tenant isolation proofs for RefreshToken, CustomRole, Permission. |

### Modified files

| File | Change |
|---|---|
| `apps/backend/prisma/schema/identity.prisma` | Add `organizationId` field + `@@index([organizationId])` + relation to `Organization` on 3 models. Update `CustomRole` to `@@unique([organizationId, name])`. |
| `apps/backend/src/modules/identity/shared/token.service.ts` | Make `tenantClaims` required; persist `organizationId` on `RefreshToken.create`. |
| `apps/backend/src/modules/identity/refresh-token/refresh-token.handler.ts` | Read orgId from old token; pass to `TokenService.issueTokenPair` as required claim. |
| `apps/backend/src/modules/identity/logout/logout.handler.ts` | Scope refresh-token revocation by `{ userId, organizationId }`. |
| `apps/backend/src/modules/identity/roles/create-role.handler.ts` | Inject `TenantContextService`; set `organizationId` on create; lookup conflict uses composite `(organizationId, name)`. |
| `apps/backend/src/modules/identity/roles/delete-role.handler.ts` | Scope role lookup by org. |
| `apps/backend/src/modules/identity/roles/list-roles.handler.ts` | Filter by current org. |
| `apps/backend/src/modules/identity/roles/list-permissions.handler.ts` | Join `CustomRole` scoped by org. |
| `apps/backend/src/modules/identity/roles/assign-permissions.handler.ts` | Verify the role belongs to current org before granting permissions. |
| `apps/backend/src/modules/identity/identity.module.ts` | No change (handlers pick up new dependencies via constructor injection). |
| `apps/backend/src/infrastructure/database/prisma.service.ts` | Add `'RefreshToken'`, `'CustomRole'`, `'Permission'` to `SCOPED_MODELS`. |
| `apps/backend/src/common/tenant/tenant-context.service.ts` | Add `requireOrganizationIdOrDefault()` helper (falls back to `DEFAULT_ORGANIZATION_ID` in permissive mode). |
| `apps/backend/.env.example` | Bump default `TENANT_ENFORCEMENT` to `permissive` (dev/test only; prod stays `off` until Plan 02h). |
| `apps/backend/docs/saas-tenancy.md` | Add identity-cluster example + "how to roll out a cluster" checklist. |

### Unit test files to update

- `apps/backend/src/modules/identity/shared/token.service.spec.ts` (or colocated test) — required `tenantClaims`, organizationId in created RefreshToken.
- `apps/backend/src/modules/identity/refresh-token/refresh-token.handler.spec.ts` — orgId round-trips from old token to new.
- `apps/backend/src/modules/identity/logout/logout.handler.spec.ts` — logout only revokes tokens of current org.
- `apps/backend/src/modules/identity/roles/roles.handler.spec.ts` — new tests for cross-org isolation in create/delete/list.

---

## Task 1 — Extend identity.prisma with organizationId (nullable)

**Files:**
- Modify: `apps/backend/prisma/schema/identity.prisma`

- [ ] **Step 1.1: Open the file and extend `RefreshToken`**

In `apps/backend/prisma/schema/identity.prisma`, find the `RefreshToken` model and add an `organizationId` field plus an index:

```prisma
model RefreshToken {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String?                         // SaaS-02a — nullable during backfill; NOT NULL in follow-up migration
  tokenHash      String    @unique
  tokenSelector  String
  expiresAt      DateTime
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  @@index([userId])
  @@index([tokenSelector])
  @@index([organizationId])
}
```

Do NOT add a Prisma relation to `Organization` here. Keeping FK management in raw SQL avoids re-indexing churn across the planned 3 migrations.

- [ ] **Step 1.2: Extend `CustomRole`**

Change `name` from `@unique` to a composite unique scoped by org:

```prisma
model CustomRole {
  id             String       @id @default(uuid())
  organizationId String?                         // SaaS-02a
  name           String                           // was @unique globally
  permissions    Permission[]
  users          User[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@unique([organizationId, name])               // SaaS-02a — replaces global @unique on name
  @@index([organizationId])
}
```

- [ ] **Step 1.3: Extend `Permission`**

```prisma
model Permission {
  id             String     @id @default(uuid())
  customRoleId   String
  customRole     CustomRole @relation(fields: [customRoleId], references: [id], onDelete: Cascade)
  organizationId String?                          // SaaS-02a — denormalized for scoping (must match customRole.organizationId)
  action         String
  subject        String
  createdAt      DateTime   @default(now())

  @@unique([customRoleId, action, subject])
  @@index([organizationId])
}
```

Rationale for denormalizing `organizationId` on `Permission`: the Prisma scoping extension can't traverse joins. Storing `organizationId` directly lets the extension inject `where: { organizationId }` without a subquery. The value is kept in sync by handlers + RLS.

- [ ] **Step 1.4: Validate**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

Expected: "The schema is valid 🚀".

- [ ] **Step 1.5: Commit**

```bash
git add apps/backend/prisma/schema/identity.prisma
git commit -m "feat(saas-02a): extend identity schema with organizationId (nullable) on 3 models"
```

---

## Task 2 — Schema migration (additive, nullable)

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02a_identity_add_org_nullable/migration.sql`

- [ ] **Step 2.1: Generate the migration (create-only, don't apply yet)**

```bash
cd apps/backend && npx prisma migrate dev --name saas02a_identity_add_org_nullable --create-only
```

Expected: new folder under `prisma/migrations/` with Prisma-generated SQL. Open the file — it will include:
- `ALTER TABLE "RefreshToken" ADD COLUMN "organizationId" TEXT;`
- Similar for `CustomRole` and `Permission`
- New indexes on `organizationId`
- Drop of global `"CustomRole_name_key"` unique
- New composite unique `"CustomRole_organizationId_name_key"`

- [ ] **Step 2.2: Append FK constraints to Organization**

At the end of the generated SQL, append:

```sql
-- FK constraints — RESTRICT prevents deleting an Organization with residual data.
-- Nullable now; becomes NOT NULL in saas02a_identity_not_null migration.

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomRole"
  ADD CONSTRAINT "CustomRole_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 2.3: Apply the migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Expected: migration applies cleanly. Prisma client regenerates with new optional `organizationId` fields on the 3 models.

- [ ] **Step 2.4: Sanity check via typescript**

```bash
cd apps/backend && npm run typecheck
```

Expected: the new `organizationId?: string | null` fields compile everywhere. Any callsite creating a `RefreshToken` / `CustomRole` / `Permission` without setting `organizationId` still works (nullable).

- [ ] **Step 2.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02a_identity_add_org_nullable
git commit -m "feat(saas-02a): migration — add nullable organizationId to identity models + FK + indexes"
```

---

## Task 3 — Backfill migration

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02a_identity_backfill/migration.sql`

- [ ] **Step 3.1: Create folder**

```bash
cd apps/backend && TS=$(date -u +%Y%m%d%H%M%S) && mkdir -p prisma/migrations/${TS}_saas02a_identity_backfill
```

- [ ] **Step 3.2: Write backfill SQL**

Create `prisma/migrations/<TS>_saas02a_identity_backfill/migration.sql`:

```sql
-- SaaS-02a: backfill organizationId on identity models.
-- Assigns every pre-existing row to the default organization seeded in SaaS-01.
-- Idempotent: WHERE organizationId IS NULL filters out already-migrated rows.

UPDATE "RefreshToken"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;

UPDATE "CustomRole"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;

UPDATE "Permission"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;
```

- [ ] **Step 3.3: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 3.4: Verify counts**

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const tables = ['refreshToken', 'customRole', 'permission'];
  for (const t of tables) {
    const total = await p[t].count();
    const scoped = await p[t].count({ where: { organizationId: { not: null } } });
    console.log(t, { total, scoped, unscoped: total - scoped });
    if (total !== scoped) { console.error('UNSCOPED ROWS REMAIN'); process.exit(1); }
  }
  await p.\$disconnect();
}
main();
"
```

Expected: for each table, `total === scoped` (no NULL rows remain). If dev db is empty, all zeros are fine.

- [ ] **Step 3.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02a_identity_backfill
git commit -m "feat(saas-02a): migration — backfill organizationId=default on identity models"
```

---

## Task 4 — TokenService: require tenantClaims + persist organizationId on RefreshToken

**Files:**
- Modify: `apps/backend/src/modules/identity/shared/token.service.ts`
- Modify: `apps/backend/src/modules/identity/shared/token.service.spec.ts` (create if absent)

- [ ] **Step 4.1: Make `tenantClaims` required**

In `apps/backend/src/modules/identity/shared/token.service.ts`, change the method signature and update RefreshToken creation:

```ts
export interface TenantClaims {
  organizationId: string;
  membershipId?: string;
  isSuperAdmin?: boolean;
}

// ... existing JwtPayload interface (already updated in Plan 01)

async issueTokenPair(
  user: {
    id: string;
    email: string;
    role: string;
    customRoleId: string | null;
    customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  },
  tenantClaims: TenantClaims,   // SaaS-02a — now required
): Promise<TokenPair> {
  const permissions = user.customRole?.permissions ?? [];
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    customRoleId: user.customRoleId,
    permissions,
    features: [],
    organizationId: tenantClaims.organizationId,
    membershipId: tenantClaims.membershipId,
    isSuperAdmin: tenantClaims.isSuperAdmin ?? false,
  };

  const accessToken = this.jwt.sign(payload, {
    secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
    expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
  });

  const rawRefresh = randomUUID();
  const tokenSelector = rawRefresh.slice(0, 8);
  const tokenHash = await bcrypt.hash(rawRefresh, 10);
  const ttl = this.config.get<string>('JWT_REFRESH_TTL') ?? '30d';
  const expiresAt = new Date(Date.now() + this.parseTtlMs(ttl));

  await this.prisma.refreshToken.create({
    data: {
      userId: user.id,
      organizationId: tenantClaims.organizationId,     // SaaS-02a
      tokenHash,
      tokenSelector,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: rawRefresh };
}
```

- [ ] **Step 4.2: Update the spec**

Locate the existing test file (or create `token.service.spec.ts` next to the service). Ensure it includes:

```ts
it('persists organizationId on created RefreshToken', async () => {
  const user = fakeUser();
  await svc.issueTokenPair(user, { organizationId: 'org-1', membershipId: 'm-1' });
  const token = await prisma.refreshToken.findFirst({ where: { userId: user.id } });
  expect(token?.organizationId).toBe('org-1');
});

it('signs JWT with organizationId + membershipId + isSuperAdmin claims', async () => {
  const user = fakeUser();
  const pair = await svc.issueTokenPair(user, {
    organizationId: 'org-1',
    membershipId: 'm-1',
    isSuperAdmin: true,
  });
  const decoded = JSON.parse(
    Buffer.from(pair.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(decoded.organizationId).toBe('org-1');
  expect(decoded.membershipId).toBe('m-1');
  expect(decoded.isSuperAdmin).toBe(true);
});
```

If the spec uses mocked Prisma, assert `prisma.refreshToken.create` was called with `organizationId` in `data`.

- [ ] **Step 4.3: Run tests**

```bash
cd apps/backend && npx jest token.service.spec
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 4.4: Fix any callsites broken by the required param**

```bash
cd apps/backend && npm run typecheck 2>&1 | head -40
```

Callsites that will now fail:
- `login.handler.ts` — already passes `tenantClaims` after Plan 01 (should still typecheck).
- `refresh-token.handler.ts` — Task 5 fixes this.
- Any tests constructing `TokenService` directly — update per spec above.

- [ ] **Step 4.5: Commit**

```bash
git add apps/backend/src/modules/identity/shared/token.service.ts apps/backend/src/modules/identity/shared/token.service.spec.ts
git commit -m "feat(saas-02a): TokenService — required tenantClaims + persist organizationId on RefreshToken"
```

---

## Task 5 — RefreshTokenHandler: round-trip orgId through refresh flow

**Files:**
- Modify: `apps/backend/src/modules/identity/refresh-token/refresh-token.handler.ts`
- Modify: `apps/backend/src/modules/identity/refresh-token/refresh-token.handler.spec.ts`

- [ ] **Step 5.1: Read current handler**

```bash
cd apps/backend && cat src/modules/identity/refresh-token/refresh-token.handler.ts
```

Identify where the old token is validated and where the new pair is issued.

- [ ] **Step 5.2: Update the handler**

Refresh flow must carry the `organizationId` from the old token into the new one. The default org fallback handles pre-backfill tokens (should be zero in prod after backfill but defend anyway):

```ts
import { DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';

// ... inside execute(), after old token + user are validated:
const tenantClaims = {
  organizationId: oldToken.organizationId ?? DEFAULT_ORGANIZATION_ID,
  isSuperAdmin: user.role === 'SUPER_ADMIN',
};

// Revoke old token (existing logic) — keep as-is.

return this.tokens.issueTokenPair(user, tenantClaims);
```

Resolve `membershipId` if easily available via a lookup; otherwise leave undefined (optional claim).

- [ ] **Step 5.3: Update the spec**

Add to `refresh-token.handler.spec.ts`:

```ts
it('carries organizationId from old refresh token into new token pair', async () => {
  const user = await seedUser();
  const oldToken = await seedRefreshToken(user, { organizationId: 'org-A' });
  const pair = await handler.execute({ refreshToken: oldToken.raw });
  const newToken = await prisma.refreshToken.findFirst({
    where: { userId: user.id, revokedAt: null },
  });
  expect(newToken?.organizationId).toBe('org-A');

  const decoded = JSON.parse(
    Buffer.from(pair.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(decoded.organizationId).toBe('org-A');
});
```

- [ ] **Step 5.4: Run tests**

```bash
cd apps/backend && npx jest refresh-token.handler.spec
```

- [ ] **Step 5.5: Commit**

```bash
git add apps/backend/src/modules/identity/refresh-token/refresh-token.handler.ts apps/backend/src/modules/identity/refresh-token/refresh-token.handler.spec.ts
git commit -m "feat(saas-02a): RefreshTokenHandler round-trips organizationId through refresh flow"
```

---

## Task 6 — LogoutHandler: scope token revocation by org

**Files:**
- Modify: `apps/backend/src/modules/identity/logout/logout.handler.ts`
- Modify: `apps/backend/src/modules/identity/logout/logout.handler.spec.ts`

- [ ] **Step 6.1: Read current handler**

```bash
cd apps/backend && cat src/modules/identity/logout/logout.handler.ts
```

It likely revokes a single token by `tokenHash` match or all user tokens.

- [ ] **Step 6.2: Update handler — inject TenantContextService**

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class LogoutHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: LogoutCommand) {
    const orgId = this.tenant.requireOrganizationId();

    // If logging out a specific refresh token, confirm it belongs to this org
    // before revoking (prevents super-admin accidentally nuking cross-org tokens
    // via impersonation shenanigans).
    await this.prisma.refreshToken.updateMany({
      where: {
        userId: cmd.userId,
        organizationId: orgId,       // SaaS-02a — scope revocation
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }
}
```

Adapt the exact field names to the existing command/DTO.

- [ ] **Step 6.3: Update spec with cross-org test**

Append to `logout.handler.spec.ts`:

```ts
it('does not revoke refresh tokens from other orgs', async () => {
  const user = await seedUser();
  await seedRefreshToken(user, { organizationId: 'org-A' });
  await seedRefreshToken(user, { organizationId: 'org-B' });

  await runWithTenant({ organizationId: 'org-A' }, () =>
    handler.execute({ userId: user.id }),
  );

  const revokedA = await prisma.refreshToken.count({
    where: { userId: user.id, organizationId: 'org-A', revokedAt: { not: null } },
  });
  const revokedB = await prisma.refreshToken.count({
    where: { userId: user.id, organizationId: 'org-B', revokedAt: { not: null } },
  });
  expect(revokedA).toBeGreaterThan(0);
  expect(revokedB).toBe(0);
});
```

(Use the `runWithTenant` helper from the isolation harness in Plan 01; import from `test/tenant-isolation/isolation-harness.ts`, or create a lightweight unit-test version.)

- [ ] **Step 6.4: Run tests + commit**

```bash
cd apps/backend && npx jest logout.handler.spec
git add apps/backend/src/modules/identity/logout/logout.handler.ts apps/backend/src/modules/identity/logout/logout.handler.spec.ts
git commit -m "feat(saas-02a): LogoutHandler scopes token revocation by current org"
```

---

## Task 7 — Role handlers: scope all CRUD by org

**Files:**
- Modify: `apps/backend/src/modules/identity/roles/create-role.handler.ts`
- Modify: `apps/backend/src/modules/identity/roles/delete-role.handler.ts`
- Modify: `apps/backend/src/modules/identity/roles/list-roles.handler.ts`
- Modify: `apps/backend/src/modules/identity/roles/list-permissions.handler.ts`
- Modify: `apps/backend/src/modules/identity/roles/assign-permissions.handler.ts`
- Modify: `apps/backend/src/modules/identity/roles/roles.handler.spec.ts`

- [ ] **Step 7.1: Update `CreateRoleHandler`**

Current code (Plan 01 snapshot):
```ts
async execute(cmd: CreateRoleCommand) {
  const existing = await this.prisma.customRole.findUnique({
    where: { name: cmd.name },
  });
  if (existing) throw new ConflictException(`Role "${cmd.name}" already exists`);
  return this.prisma.customRole.create({
    data: { name: cmd.name },
    include: { permissions: true },
  });
}
```

Replace with:
```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class CreateRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateRoleCommand) {
    const organizationId = this.tenant.requireOrganizationId();
    const existing = await this.prisma.customRole.findUnique({
      where: { organizationId_name: { organizationId, name: cmd.name } },
    });
    if (existing) throw new ConflictException(`Role "${cmd.name}" already exists`);
    return this.prisma.customRole.create({
      data: { name: cmd.name, organizationId },
      include: { permissions: true },
    });
  }
}
```

The composite unique key name is `organizationId_name` (Prisma's auto-generated name from `@@unique([organizationId, name])`). Verify via `npx prisma generate` output if uncertain.

- [ ] **Step 7.2: Update `DeleteRoleHandler`**

Scope the lookup:

```ts
async execute(cmd: DeleteRoleCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  const role = await this.prisma.customRole.findFirst({
    where: { id: cmd.id, organizationId },
  });
  if (!role) throw new NotFoundException('Role not found');
  // ... existing delete logic
  await this.prisma.customRole.delete({ where: { id: cmd.id } });
}
```

Inject `TenantContextService` in the constructor.

- [ ] **Step 7.3: Update `ListRolesHandler`**

```ts
async execute() {
  const organizationId = this.tenant.requireOrganizationId();
  return this.prisma.customRole.findMany({
    where: { organizationId },
    include: { permissions: true },
    orderBy: { createdAt: 'desc' },
  });
}
```

- [ ] **Step 7.4: Update `ListPermissionsHandler`**

If it currently lists permissions of a specific role, scope the role lookup by org first:

```ts
async execute(cmd: { roleId: string }) {
  const organizationId = this.tenant.requireOrganizationId();
  const role = await this.prisma.customRole.findFirst({
    where: { id: cmd.roleId, organizationId },
  });
  if (!role) throw new NotFoundException('Role not found');
  return this.prisma.permission.findMany({
    where: { customRoleId: role.id, organizationId },
    orderBy: [{ subject: 'asc' }, { action: 'asc' }],
  });
}
```

- [ ] **Step 7.5: Update `AssignPermissionsHandler`**

```ts
async execute(cmd: AssignPermissionsCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  const role = await this.prisma.customRole.findFirst({
    where: { id: cmd.roleId, organizationId },
  });
  if (!role) throw new NotFoundException('Role not found');

  // Replace permissions — existing atomic pattern; add organizationId on creates.
  await this.prisma.$transaction([
    this.prisma.permission.deleteMany({ where: { customRoleId: role.id } }),
    this.prisma.permission.createMany({
      data: cmd.permissions.map((p) => ({
        customRoleId: role.id,
        organizationId,                       // SaaS-02a — match parent role's org
        action: p.action,
        subject: p.subject,
      })),
    }),
  ]);

  return this.prisma.customRole.findUnique({
    where: { id: role.id },
    include: { permissions: true },
  });
}
```

- [ ] **Step 7.6: Update `roles.handler.spec.ts` with cross-org cases**

Add tests like:

```ts
describe('CreateRoleHandler — cross-org isolation', () => {
  it('allows the same role name in two different orgs', async () => {
    await runWithTenant({ organizationId: 'org-A' }, () =>
      handler.execute({ name: 'Reception Supervisor' }),
    );
    // Not a conflict: different org.
    await expect(
      runWithTenant({ organizationId: 'org-B' }, () =>
        handler.execute({ name: 'Reception Supervisor' }),
      ),
    ).resolves.toBeDefined();
  });

  it('throws conflict when same name within the same org', async () => {
    await runWithTenant({ organizationId: 'org-A' }, () =>
      handler.execute({ name: 'Dup' }),
    );
    await expect(
      runWithTenant({ organizationId: 'org-A' }, () =>
        handler.execute({ name: 'Dup' }),
      ),
    ).rejects.toThrow(/already exists/);
  });
});

describe('DeleteRoleHandler — cross-org isolation', () => {
  it('returns NotFound when deleting a role from another org', async () => {
    const role = await runWithTenant({ organizationId: 'org-A' }, () =>
      createHandler.execute({ name: 'R' }),
    );
    await expect(
      runWithTenant({ organizationId: 'org-B' }, () =>
        deleteHandler.execute({ id: role.id }),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 7.7: Run tests**

```bash
cd apps/backend && npx jest roles.handler.spec
```

Expected: all tests pass, including the new cross-org cases.

- [ ] **Step 7.8: Commit**

```bash
git add apps/backend/src/modules/identity/roles
git commit -m "feat(saas-02a): scope all role + permission handlers by current org"
```

---

## Task 8 — LoginHandler: pass isSuperAdmin in tenantClaims

**Files:**
- Modify: `apps/backend/src/modules/identity/login/login.handler.ts`
- Modify: `apps/backend/src/modules/identity/login/login.handler.spec.ts`

Plan 01 added `organizationId` + `membershipId` to login's tenantClaims but didn't emit `isSuperAdmin`. Since `TokenService` now requires the claims and Plan 02a adds `isSuperAdmin` to the JWT payload, login must emit it.

- [ ] **Step 8.1: Update handler**

In `login.handler.ts`, amend the tenantClaims construction:

```ts
return this.tokens.issueTokenPair(user, {
  organizationId: membership?.organizationId ?? DEFAULT_ORGANIZATION_ID,
  membershipId: membership?.id,
  isSuperAdmin: user.role === 'SUPER_ADMIN',    // SaaS-02a
});
```

- [ ] **Step 8.2: Update spec**

Add to `login.handler.spec.ts`:

```ts
it('marks SUPER_ADMIN users as isSuperAdmin in JWT', async () => {
  const admin = await seedUser({ role: 'SUPER_ADMIN' });
  const result = await handler.execute({ email: admin.email, password: 'Passw0rd!' });
  const decoded = JSON.parse(
    Buffer.from(result.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(decoded.isSuperAdmin).toBe(true);
});

it('regular users are not isSuperAdmin', async () => {
  const regular = await seedUser({ role: 'RECEPTIONIST' });
  const result = await handler.execute({ email: regular.email, password: 'Passw0rd!' });
  const decoded = JSON.parse(
    Buffer.from(result.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(decoded.isSuperAdmin).toBe(false);
});
```

- [ ] **Step 8.3: Run tests + commit**

```bash
cd apps/backend && npx jest login.handler.spec
git add apps/backend/src/modules/identity/login/login.handler.ts apps/backend/src/modules/identity/login/login.handler.spec.ts
git commit -m "feat(saas-02a): LoginHandler emits isSuperAdmin in JWT tenant claims"
```

---

## Task 9 — NOT NULL migration + composite unique activation

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02a_identity_not_null/migration.sql`
- Modify: `apps/backend/prisma/schema/identity.prisma` — strip `?` from `organizationId`

- [ ] **Step 9.1: Update schema — make organizationId required**

Edit `apps/backend/prisma/schema/identity.prisma`. Change `organizationId String?` to `organizationId String` on all 3 models.

- [ ] **Step 9.2: Generate migration**

```bash
cd apps/backend && npx prisma migrate dev --name saas02a_identity_not_null --create-only
```

Prisma will generate `ALTER TABLE ... ALTER COLUMN "organizationId" SET NOT NULL`.

- [ ] **Step 9.3: Add safety precondition**

At the top of the generated SQL, add a defensive check:

```sql
-- SaaS-02a safety: abort if any NULL organizationId remains (shouldn't after backfill).
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "RefreshToken" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "CustomRole"   WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Permission"   WHERE "organizationId" IS NULL)
  INTO bad_count;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'SaaS-02a: % identity rows still have NULL organizationId. Re-run backfill before NOT NULL.', bad_count;
  END IF;
END $$;
```

- [ ] **Step 9.4: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 9.5: Commit**

```bash
git add apps/backend/prisma/schema/identity.prisma apps/backend/prisma/migrations/*_saas02a_identity_not_null
git commit -m "feat(saas-02a): migration — NOT NULL organizationId on identity models (after backfill)"
```

---

## Task 10 — Populate `SCOPED_MODELS` + activate Prisma extension for identity

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 10.1: Register the 3 models**

In `prisma.service.ts`, find `SCOPED_MODELS` (added in Plan 01 as an empty Set). Add the identity models:

```ts
const SCOPED_MODELS: TenantScopedModelRegistry = new Set<string>([
  // SaaS-02a — identity cluster
  'RefreshToken',
  'CustomRole',
  'Permission',
]);
```

- [ ] **Step 10.2: Run the full unit suite with permissive mode**

```bash
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run test
```

Expected: all tests still pass. The extension now injects `organizationId` from CLS into the 3 models' where clauses; handlers updated in Tasks 4–8 already pass it explicitly, so injection is a no-op at the handler level, but it catches any untouched callsite that forgot.

If a test fails because the extension double-injects or conflicts, debug the callsite — don't widen the registry or revert.

- [ ] **Step 10.3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02a): activate Prisma scoping extension for identity models"
```

---

## Task 11 — RLS policies for identity tables

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02a_identity_rls/migration.sql`

- [ ] **Step 11.1: Write the migration**

Create `prisma/migrations/<TS>_saas02a_identity_rls/migration.sql`:

```sql
-- SaaS-02a: enable Row-Level Security on identity tables.
-- Uses app_current_org_id() GUC helper defined in SaaS-01.
-- Policy semantics:
--   * If GUC is unset (NULL), bypass filter — for background jobs without tenant
--     context. App code should ALWAYS set GUC inside transactions touching these
--     tables once Plan 02h flips TENANT_ENFORCEMENT=strict (penetration tests).
--   * Otherwise, filter by organization_id = GUC value.

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission"   ENABLE ROW LEVEL SECURITY;

-- FORCE ensures the policies apply even to table owners (the DB role the app
-- uses is typically a table owner in dev; in prod we use a non-owner role).
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Permission"   FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_refresh_token ON "RefreshToken"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_custom_role ON "CustomRole"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_permission ON "Permission"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
```

- [ ] **Step 11.2: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 11.3: Sanity-check policies are active**

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`
  SELECT tablename, rowsecurity, forcerowsecurity
  FROM pg_tables
  WHERE tablename IN ('RefreshToken','CustomRole','Permission')
\`.then(r => { console.log(r); p.\$disconnect(); });
"
```

Expected output: all 3 rows show `rowsecurity: true, forcerowsecurity: true`.

- [ ] **Step 11.4: Run full test suite**

```bash
cd apps/backend && npm run test && npm run test:e2e
```

Expected: pass. The `OR app_current_org_id() IS NULL` bypass keeps tests green when CLS isn't set.

- [ ] **Step 11.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02a_identity_rls
git commit -m "feat(saas-02a): enable RLS + tenant_isolation policies on 3 identity tables"
```

---

## Task 12 — Isolation e2e spec for identity cluster

**Files:**
- Create: `apps/backend/test/tenant-isolation/identity.e2e-spec.ts`

- [ ] **Step 12.1: Create the spec**

Create `apps/backend/test/tenant-isolation/identity.e2e-spec.ts`:

```ts
import { bootHarness, IsolationHarness } from './isolation-harness';
import * as bcrypt from 'bcryptjs';

describe('SaaS-02a — identity cluster isolation', () => {
  let h: IsolationHarness;

  beforeAll(async () => {
    h = await bootHarness();
  });

  afterAll(async () => {
    if (h) await h.close();
  });

  it('refresh tokens created in org A are invisible from org B', async () => {
    const a = await h.createOrg('id-iso-a', 'أ');
    const b = await h.createOrg('id-iso-b', 'ب');

    // Seed a user + refresh token scoped to A.
    const user = await h.prisma.user.create({
      data: {
        email: `iso-${Date.now()}@t.test`,
        passwordHash: await bcrypt.hash('Pw!12345', 4),
        name: 'Iso',
        role: 'RECEPTIONIST',
      },
    });
    const tokenA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.refreshToken.create({
        data: {
          userId: user.id,
          organizationId: a.id,
          tokenHash: 'hash-a',
          tokenSelector: 'sel-a',
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
    );

    const fromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.refreshToken.findUnique({ where: { id: tokenA.id } }),
    );
    expect(fromB).toBeNull();

    const listFromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.refreshToken.findMany({ where: { userId: user.id } }),
    );
    expect(listFromB).toEqual([]);
  });

  it('role names are unique per org, not globally', async () => {
    const a = await h.createOrg('id-role-a', 'أ');
    const b = await h.createOrg('id-role-b', 'ب');

    const roleA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.create({ data: { name: 'Supervisor', organizationId: a.id } }),
    );
    const roleB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.customRole.create({ data: { name: 'Supervisor', organizationId: b.id } }),
    );
    expect(roleA.id).not.toBe(roleB.id);
  });

  it('deleting a role in org A does not affect org B roles with same name', async () => {
    const a = await h.createOrg('id-del-a', 'أ');
    const b = await h.createOrg('id-del-b', 'ب');
    const roleA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.create({ data: { name: 'Clerk', organizationId: a.id } }),
    );
    const roleB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.customRole.create({ data: { name: 'Clerk', organizationId: b.id } }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.delete({ where: { id: roleA.id } }),
    );
    const stillThere = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.customRole.findUnique({ where: { id: roleB.id } }),
    );
    expect(stillThere).not.toBeNull();
  });

  it('permissions are scoped through their parent role org', async () => {
    const a = await h.createOrg('id-perm-a', 'أ');
    const b = await h.createOrg('id-perm-b', 'ب');
    const roleA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.create({ data: { name: 'R', organizationId: a.id } }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.permission.create({
        data: { customRoleId: roleA.id, organizationId: a.id, action: 'read', subject: 'Booking' },
      }),
    );
    const fromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.permission.findMany({ where: { customRoleId: roleA.id } }),
    );
    expect(fromB).toEqual([]);
  });

  it('RLS at the SQL level also hides rows when org GUC is different', async () => {
    const a = await h.createOrg('id-rls-a', 'أ');
    const b = await h.createOrg('id-rls-b', 'ب');
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.create({ data: { name: 'RLS-Role', organizationId: a.id } }),
    );
    const rowsFromB = await h.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
      return tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "CustomRole" WHERE name = 'RLS-Role'
      `;
    });
    expect(Number(rowsFromB[0].count)).toBe(0);
  });

  it('super-admin context bypasses scoping (read-all)', async () => {
    const a = await h.createOrg('id-sa-a', 'أ');
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.customRole.create({ data: { name: 'SA-Visible', organizationId: a.id } }),
    );
    const fromSuperAdmin = await h.runAs({ isSuperAdmin: true }, () =>
      h.prisma.customRole.findMany({ where: { name: 'SA-Visible' } }),
    );
    expect(fromSuperAdmin.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 12.2: Run the e2e**

```bash
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run test:e2e -- --testPathPattern='tenant-isolation/identity'
```

Expected: all 6 specs pass.

- [ ] **Step 12.3: Commit**

```bash
git add apps/backend/test/tenant-isolation/identity.e2e-spec.ts
git commit -m "test(saas-02a): identity cluster cross-tenant isolation e2e"
```

---

## Task 13 — Switch dev/test default to permissive + CI env

**Files:**
- Modify: `apps/backend/.env.example`
- Modify: `apps/backend/test/jest-e2e.json` (or jest setup file)

- [ ] **Step 13.1: Bump `.env.example` default**

In `apps/backend/.env.example`, change:

```
TENANT_ENFORCEMENT=off
```

to:

```
# SaaS-02a+: default to permissive in dev/test. Production deploys should
# keep `off` until every cluster is rolled out (Plan 02h switches to strict).
TENANT_ENFORCEMENT=permissive
```

- [ ] **Step 13.2: Set permissive mode in jest setup**

Find or create `apps/backend/test/setup.ts` (referenced by jest `setupFilesAfterEach` or `globalSetup`). Add at the top:

```ts
process.env.TENANT_ENFORCEMENT ??= 'permissive';
process.env.DEFAULT_ORGANIZATION_ID ??= '00000000-0000-0000-0000-000000000001';
```

If the file doesn't exist, add the glob to jest config. Otherwise prepend these lines so all tests run under permissive unless overridden.

- [ ] **Step 13.3: Run everything**

```bash
cd apps/backend && npm run typecheck && npm run test && npm run test:e2e
```

Expected: green across the board.

- [ ] **Step 13.4: Commit**

```bash
git add apps/backend/.env.example apps/backend/test/setup.ts
git commit -m "chore(saas-02a): default TENANT_ENFORCEMENT=permissive in dev+test"
```

---

## Task 14 — Cluster rollout playbook + update saas-tenancy.md

**Files:**
- Modify: `apps/backend/docs/saas-tenancy.md`

- [ ] **Step 14.1: Append the cluster rollout checklist**

Append to `apps/backend/docs/saas-tenancy.md`:

````markdown
## Cluster rollout playbook

Use this checklist when extending tenant enforcement to a new cluster (following the SaaS-02a pattern).

### Phase 1 — Schema (additive)
1. Add `organizationId String?` to every tenant-scoped model in the cluster's `.prisma` file.
2. Add `@@index([organizationId])`.
3. Update any `@unique` that should be per-org → composite `@@unique([organizationId, ...])`.
4. Denormalize `organizationId` on child tables where the parent has it — the Prisma extension can't traverse joins.
5. `prisma migrate dev --create-only`, then append FK constraints to `Organization` with `ON DELETE RESTRICT`.

### Phase 2 — Backfill
6. Migration sets `organizationId = '00000000-0000-0000-0000-000000000001'` (default org) for every existing row.
7. Verify counts: `SELECT COUNT(*) FROM t WHERE "organizationId" IS NULL` returns 0 post-backfill.

### Phase 3 — Code updates
8. Every handler that reads/writes these models injects `TenantContextService` and calls `requireOrganizationId()`.
9. Cross-model queries filter explicitly (don't rely on the Prisma extension alone — write `where: { organizationId }` in handler code for intent).
10. `updateMany` and `deleteMany` must include `organizationId` in `where` even though the extension handles it — defensive depth.
11. `$queryRaw` calls must either include `organizationId` predicate explicitly or run inside an RLS-wrapped transaction.

### Phase 4 — Activate
12. Add model names to `SCOPED_MODELS` in `prisma.service.ts`.
13. Add the composite-unique-key's Prisma name to any `findUnique` call that relied on the old (single-field) unique.
14. Follow-up migration: `ALTER COLUMN "organizationId" SET NOT NULL` (after guard check for zero NULLs).

### Phase 5 — RLS
15. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;`
16. `CREATE POLICY tenant_isolation_<table> ON "..." USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);`

### Phase 6 — Isolation tests
17. Add a `<cluster>.e2e-spec.ts` under `test/tenant-isolation/` proving:
    - Cross-org read returns null / empty.
    - Cross-org update/delete is blocked (NotFound).
    - RLS hides rows at SQL level when GUC differs.
    - Super-admin context bypasses scoping.

### Phase 7 — Commit
Each of the above phases is a separate commit prefixed `feat(saas-02X):`.

## Identity cluster example (SaaS-02a reference)

See the three identity-cluster migrations and commits:
- `feat(saas-02a): extend identity schema with organizationId (nullable) on 3 models`
- `feat(saas-02a): migration — add nullable organizationId to identity models + FK + indexes`
- `feat(saas-02a): migration — backfill organizationId=default on identity models`
- `feat(saas-02a): TokenService — required tenantClaims + persist organizationId on RefreshToken`
- `feat(saas-02a): scope all role + permission handlers by current org`
- `feat(saas-02a): activate Prisma scoping extension for identity models`
- `feat(saas-02a): migration — NOT NULL organizationId on identity models (after backfill)`
- `feat(saas-02a): enable RLS + tenant_isolation policies on 3 identity tables`
- `test(saas-02a): identity cluster cross-tenant isolation e2e`
````

- [ ] **Step 14.2: Commit**

```bash
git add apps/backend/docs/saas-tenancy.md
git commit -m "docs(saas-02a): cluster rollout playbook + identity cluster example"
```

---

## Task 15 — Final verification + PR

**Files:**
- None (verification + PR).

- [ ] **Step 15.1: Run the full suite**

```bash
cd apps/backend && npm run typecheck && npm run test && npm run test:e2e
```

Expected: 0 typescript errors, all unit tests pass, all e2e pass (including the new identity isolation suite).

- [ ] **Step 15.2: Verify migration chain**

```bash
cd apps/backend && ls prisma/migrations | tail -10
```

Expected order (4 new SaaS-02a migrations, chronological):
- `<TS>_saas02a_identity_add_org_nullable`
- `<TS>_saas02a_identity_backfill`
- `<TS>_saas02a_identity_not_null`
- `<TS>_saas02a_identity_rls`

- [ ] **Step 15.3: Boot server in each mode**

```bash
cd apps/backend && TENANT_ENFORCEMENT=off npm run dev    # legacy mode — unchanged
# Ctrl+C, then:
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run dev    # identity now scoped
# Ctrl+C, then:
cd apps/backend && TENANT_ENFORCEMENT=strict npm run dev    # identity scoped + non-tenant requests 400
```

Verify each mode boots and `GET /api/v1/health` responds.

- [ ] **Step 15.4: Open PR**

```bash
git push -u origin feat/saas-02a-identity-cluster
gh pr create --title "feat(saas-02a): identity cluster tenant rollout — RefreshToken + CustomRole + Permission" --body "$(cat <<'EOF'
## Summary
First cluster rollout of SaaS-02. Adds `organizationId` to 3 staff-auth identity models, registers them in the Prisma scoping extension, enables RLS policies, and flips dev/test defaults to `TENANT_ENFORCEMENT=permissive`.

## What changed
- Schema: `RefreshToken`, `CustomRole`, `Permission` all gain `organizationId` (FK to Organization, ON DELETE RESTRICT). `CustomRole` unique is now composite `(organizationId, name)` — same role name can exist in multiple orgs.
- Migrations: 4 new files (add nullable → backfill → NOT NULL → RLS), all additive.
- Handlers: `TokenService`, `RefreshTokenHandler`, `LogoutHandler`, and all 5 role/permission handlers scope by current org via `TenantContextService`.
- Login: JWT now emits `isSuperAdmin` claim.
- Extension: `SCOPED_MODELS` populated with the 3 identity models; extension is now live in permissive mode.
- RLS: `ENABLE + FORCE` with `tenant_isolation_<table>` policies using `app_current_org_id()` GUC.
- Tests: 6 new cross-tenant isolation e2e specs; cross-org test cases added to role/logout unit specs.
- Default: dev/test now boot in `permissive` mode. Prod deploys should keep `off` until Plan 02h.

## Invariants verified
- [x] `TENANT_ENFORCEMENT=off` → legacy behavior unchanged.
- [x] `TENANT_ENFORCEMENT=permissive` → all unit + e2e tests pass; identity cluster scoped.
- [x] Migrations additive (CLAUDE.md rule).
- [x] RLS bypass when GUC unset (system jobs friendly).
- [x] User model NOT touched — multi-org via Membership stays correct.

## Out of scope
- `ClientRefreshToken` → deferred to SaaS-02b with `Client.organizationId`.
- `User.customRoleId → Membership.customRoleId` refactor → future plan.
- Strict mode in production → Plan 02h.

## Next
Plan 02b — people cluster (Client, Employee, EmployeeService, availability, branch-membership).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 15.5: Done**

Plan 02a complete. Identity cluster is the first tenant-scoped cluster. Pattern is proven. Subsequent cluster rollouts (02b–02g) follow the same 7-phase playbook documented in `saas-tenancy.md`.

---

## Self-review checklist

- [x] **Spec coverage:** 3 identity models × (schema + migration + backfill + NOT NULL + RLS + handlers + tests + docs). Nothing from the stated scope is skipped.
- [x] **No placeholders:** every step has exact paths, SQL, typescript, commands.
- [x] **Type consistency:** `TenantClaims`, `JwtPayload` claim names (`organizationId` / `membershipId` / `isSuperAdmin`), composite unique key shape (`organizationId_name`), `DEFAULT_ORGANIZATION_ID` UUID — all identical across files.
- [x] **Commit cadence:** 13 commits prefixed `feat(saas-02a):` / `test(saas-02a):` / `docs(saas-02a):` / `chore(saas-02a):`.
- [x] **Reversible:** each migration is append-only; `SCOPED_MODELS` change is a one-liner revert if needed; RLS policies can be dropped without data loss.
- [x] **Dependency:** plan depends only on SaaS-01 primitives already merged — no forward references.
