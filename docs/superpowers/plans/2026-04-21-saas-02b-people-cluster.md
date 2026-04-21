# SaaS-02b — People Cluster Tenant Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Extend tenant scoping to 7 people-cluster models (`Client`, `ClientRefreshToken`, `Employee`, `EmployeeBranch`, `EmployeeService`, `EmployeeAvailability`, `EmployeeAvailabilityException`). Client auth (website users) becomes tenant-aware — this is the new pattern 02a deferred. By end of plan: `people` + `identity:ClientRefreshToken` are fully scoped; dev/test boots in `permissive` with two clusters live.

**Architecture:** Same 7-phase pattern as 02a (schema → backfill → code → NOT NULL → scoping extension → RLS → e2e) documented in `docs/saas-tenancy.md`. New wrinkle: **client auth** — `ClientTokenService` + `ClientJwtStrategy` + 6 client-auth handlers gain tenant-aware flow. Client's tenant is inferred from (1) host subdomain (dormant until Plan 09), (2) explicit header during dev/test, (3) default org fallback in permissive mode.

**Tech Stack:** Prisma 7, PostgreSQL 16, NestJS 11, Jest. Builds on SaaS-01 + SaaS-02a primitives.

---

## Scope

### In-scope models (7)

| Model | File | Unique shape change |
|---|---|---|
| `Client` | `people.prisma` | `phone @unique` → `@@unique([organizationId, phone])` |
| `ClientRefreshToken` | `identity.prisma` | — |
| `Employee` | `people.prisma` | `email @unique` + `slug @unique` → `@@unique([organizationId, email])` + `@@unique([organizationId, slug])` |
| `EmployeeBranch` | `people.prisma` | — (inherits via Employee) |
| `EmployeeService` | `people.prisma` | — |
| `EmployeeAvailability` | `people.prisma` | — |
| `EmployeeAvailabilityException` | `people.prisma` | — |

### New concept: Client tenancy

Clients belong to **one organization** (Plan 01 decision). A person booking at clinic A and clinic B has two `Client` rows. The `Client.organizationId` is set at registration from `TenantContext` (populated by middleware from host/header). `ClientRefreshToken.organizationId` inherits from `Client.organizationId`.

### Explicitly deferred

- Subdomain-based tenant resolution for client requests → Plan 09.
- Cross-org client identity merge ("I'm the same person at two clinics, link my data") → future plan; may require `ClientProfile` (global) + `Client` (per-org) split.
- Mobile client app (paused).

### Invariants at every task boundary

Mirrors 02a invariants. Plus:

- `TENANT_ENFORCEMENT=permissive` continues to work after this plan (dev/test default).
- Both staff auth (02a) and client auth (this plan) issue JWTs with `organizationId`.
- Existing client registration flow on `http://localhost:5104` (website) keeps working against default org.

---

## Pre-flight checks (REQUIRED before starting Task 1)

Per index lesson #1:

- [ ] **Grep all callsites of modified services/handlers.** Run this and record results:

```bash
cd apps/backend
grep -rn "ClientTokenService\|clientTokens\." src | head -40
grep -rn "prisma\.client\.\|prisma\.employee\." src | head -40
grep -rn "prisma\.clientRefreshToken\." src | head -20
```

Expected: catalog every file that reads/writes the 7 models. These are candidates for handler updates in Tasks 6–10. Any callsite missed = tenant leak risk.

- [ ] **Verify test harness is reusable.** 02a uses `test/tenant-isolation/isolation-harness.ts`. Confirm:

```bash
ls apps/backend/test/tenant-isolation/
```

Expected: `isolation-harness.ts`, `foundation.e2e-spec.ts`, `identity.e2e-spec.ts`. Task 14 extends it with `people.e2e-spec.ts`.

- [ ] **Confirm `tenant.requireOrganizationIdOrDefault()` exists** (added in 02a Task 10 amendment):

```bash
grep -n "requireOrganizationIdOrDefault" apps/backend/src/common/tenant/tenant-context.service.ts
```

If absent: STOP and add it first (SaaS-02a should have landed it; confirm 02a merge before proceeding).

---

## File Structure

### New files

| File | Purpose |
|---|---|
| `apps/backend/prisma/migrations/<TS>_saas02b_people_add_org_nullable/migration.sql` | Add nullable `organizationId` + indexes + FK on 7 tables. Replace global uniques on `Client.phone`, `Employee.email`, `Employee.slug`. |
| `apps/backend/prisma/migrations/<TS>_saas02b_people_backfill/migration.sql` | Populate `organizationId=DEFAULT_ORG_ID` on all existing rows. |
| `apps/backend/prisma/migrations/<TS>_saas02b_people_not_null/migration.sql` | Flip to `NOT NULL` after safety check. |
| `apps/backend/prisma/migrations/<TS>_saas02b_people_rls/migration.sql` | Enable + FORCE RLS + tenant_isolation policies on 7 tables. |
| `apps/backend/test/tenant-isolation/people.e2e-spec.ts` | Cross-tenant isolation proofs (10+ cases) including client auth flow. |

### Modified files

- `apps/backend/prisma/schema/people.prisma` — `organizationId` field + relation + per-org uniques.
- `apps/backend/prisma/schema/identity.prisma` — `organizationId` on `ClientRefreshToken`.
- `apps/backend/src/modules/identity/shared/client-token.service.ts` — require `tenantClaims`, persist on `ClientRefreshToken.create`.
- `apps/backend/src/modules/identity/client-jwt.strategy.ts` — propagate `organizationId` into `req.user`.
- `apps/backend/src/modules/identity/client-auth/register.handler.ts` — read `TenantContext` org, persist on Client.
- `apps/backend/src/modules/identity/client-auth/client-login.handler.ts` — lookup Client scoped by `(organizationId, phone)` / `(organizationId, email)`.
- `apps/backend/src/modules/identity/client-auth/client-refresh.handler.ts` — scope refresh lookup + issue new tokens with Client's org.
- `apps/backend/src/modules/identity/client-auth/client-logout.handler.ts` — scope revocation.
- `apps/backend/src/modules/identity/client-auth/get-me.handler.ts` — scope Client lookup.
- `apps/backend/src/modules/identity/client-auth/reset-password/reset-password.handler.ts` — scope lookup + token revocation.
- `apps/backend/src/modules/people/**/*.handler.ts` — all client/employee CRUD handlers inject `TenantContextService`.
- `apps/backend/src/infrastructure/database/prisma.service.ts` — extend `SCOPED_MODELS`.
- `apps/backend/src/common/tenant/tenant-resolver.middleware.ts` — extend to resolve tenant from host for client endpoints (stub until Plan 09; for now accept `x-client-org-id` header in permissive dev mode only).
- `apps/backend/docs/saas-tenancy.md` — append "Client auth tenancy" section + people-cluster example.

---

## Task 1 — Extend schemas

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma`
- Modify: `apps/backend/prisma/schema/identity.prisma`

- [ ] **Step 1.1: `Client` — add organizationId + replace `phone @unique`**

```prisma
model Client {
  id                String            @id @default(uuid())
  organizationId    String?                                // SaaS-02b
  userId            String?
  // ... existing fields unchanged ...
  phone             String?                                 // was @unique — now composite below
  // ... rest unchanged ...

  @@unique([organizationId, phone], name: "client_org_phone")
  @@index([userId])
  @@index([deletedAt])
  @@index([phone])
  @@index([organizationId])                                 // SaaS-02b
}
```

Composite unique with explicit `name:` avoids a Prisma-generated identifier you'd otherwise have to guess in `findUnique` calls — we call it `client_org_phone` and reference it as `{ client_org_phone: { organizationId, phone } }`.

- [ ] **Step 1.2: `Employee` — add organizationId + per-org email + slug uniques**

```prisma
model Employee {
  id               String           @id @default(uuid())
  organizationId   String?                                 // SaaS-02b
  userId           String?
  // ... unchanged ...
  email            String?                                  // was @unique
  // ...
  slug             String?                                  // was @unique
  // ... unchanged ...

  @@unique([organizationId, email], name: "employee_org_email")
  @@unique([organizationId, slug],  name: "employee_org_slug")
  @@index([userId])
  @@index([organizationId])                                 // SaaS-02b
}
```

- [ ] **Step 1.3: Denormalize `organizationId` on 4 join/child tables**

For `EmployeeBranch`, `EmployeeService`, `EmployeeAvailability`, `EmployeeAvailabilityException`:

```prisma
model EmployeeBranch {
  id             String   @id @default(uuid())
  organizationId String?                                   // SaaS-02b — denormalized from Employee
  employeeId     String
  employee       Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  branchId       String

  @@unique([employeeId, branchId])
  @@index([employeeId])
  @@index([organizationId])                                // SaaS-02b
}
```

Apply the same shape to the other 3. Denormalization reason is identical to 02a's `Permission` case: the Prisma scoping extension can't traverse joins.

- [ ] **Step 1.4: `ClientRefreshToken` — add organizationId**

In `identity.prisma`:

```prisma
model ClientRefreshToken {
  id             String    @id @default(uuid())
  organizationId String?                                   // SaaS-02b
  clientId       String
  tokenHash      String    @unique
  tokenSelector  String
  expiresAt      DateTime
  revokedAt      DateTime?
  createdAt      DateTime  @default(now())

  @@index([clientId])
  @@index([tokenSelector])
  @@index([organizationId])                                // SaaS-02b
}
```

- [ ] **Step 1.5: Validate**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

- [ ] **Step 1.6: Commit**

```bash
git add apps/backend/prisma/schema/people.prisma apps/backend/prisma/schema/identity.prisma
git commit -m "feat(saas-02b): add organizationId to 7 people-cluster models (nullable) + per-org uniques"
```

---

## Task 2 — Generate + extend schema migration

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02b_people_add_org_nullable/migration.sql`

- [ ] **Step 2.1: Generate (create-only)**

```bash
cd apps/backend && npx prisma migrate dev --name saas02b_people_add_org_nullable --create-only
```

If `prisma migrate dev` fails due to pgvector or other DB hooks (per index lesson #4), write the migration SQL file manually. The expected content is below.

- [ ] **Step 2.2: Verify / write SQL**

Expected file content after Prisma generation (or to write manually):

```sql
-- AlterTable: Client
ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
-- Drop global phone unique (if present as Client_phone_key)
DROP INDEX IF EXISTS "Client_phone_key";
CREATE UNIQUE INDEX "client_org_phone" ON "Client"("organizationId", "phone");
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- AlterTable: Employee
ALTER TABLE "Employee" ADD COLUMN "organizationId" TEXT;
DROP INDEX IF EXISTS "Employee_email_key";
DROP INDEX IF EXISTS "Employee_slug_key";
CREATE UNIQUE INDEX "employee_org_email" ON "Employee"("organizationId", "email");
CREATE UNIQUE INDEX "employee_org_slug"  ON "Employee"("organizationId", "slug");
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

-- AlterTable: EmployeeBranch / EmployeeService / EmployeeAvailability / EmployeeAvailabilityException
ALTER TABLE "EmployeeBranch"                  ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeService"                 ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeAvailability"            ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeAvailabilityException"   ADD COLUMN "organizationId" TEXT;

CREATE INDEX "EmployeeBranch_organizationId_idx"                ON "EmployeeBranch"("organizationId");
CREATE INDEX "EmployeeService_organizationId_idx"               ON "EmployeeService"("organizationId");
CREATE INDEX "EmployeeAvailability_organizationId_idx"          ON "EmployeeAvailability"("organizationId");
CREATE INDEX "EmployeeAvailabilityException_organizationId_idx" ON "EmployeeAvailabilityException"("organizationId");

-- AlterTable: ClientRefreshToken
ALTER TABLE "ClientRefreshToken" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "ClientRefreshToken_organizationId_idx" ON "ClientRefreshToken"("organizationId");

-- FKs: ON DELETE RESTRICT prevents accidentally orphaning data when an org is deleted.
ALTER TABLE "Client"                        ADD CONSTRAINT "Client_organizationId_fkey"                        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Employee"                      ADD CONSTRAINT "Employee_organizationId_fkey"                      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeBranch"                ADD CONSTRAINT "EmployeeBranch_organizationId_fkey"                FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeService"               ADD CONSTRAINT "EmployeeService_organizationId_fkey"               FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAvailability"          ADD CONSTRAINT "EmployeeAvailability_organizationId_fkey"          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeAvailabilityException" ADD CONSTRAINT "EmployeeAvailabilityException_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientRefreshToken"            ADD CONSTRAINT "ClientRefreshToken_organizationId_fkey"            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

Review the actual generated index names if Prisma created different ones (`<Model>_<fieldList>_idx` is the Prisma convention; adjust if yours differ).

- [ ] **Step 2.3: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 2.4: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: optional `organizationId?: string | null` appears on 7 generated Prisma types. Existing callsites still compile.

- [ ] **Step 2.5: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02b_people_add_org_nullable
git commit -m "feat(saas-02b): migration — add nullable organizationId + FK + per-org uniques on 7 tables"
```

---

## Task 3 — Backfill migration

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02b_people_backfill/migration.sql`

- [ ] **Step 3.1: Write SQL**

Create `prisma/migrations/<TS>_saas02b_people_backfill/migration.sql`:

```sql
-- SaaS-02b: assign every pre-existing row to the default organization.
-- Order matters: set Employee first, then denormalize to children.

UPDATE "Client"                      SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Employee"                    SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- For child tables, copy from the parent Employee. Avoids reinforcing the default
-- UUID assumption — if Employee rows had different orgs somehow (shouldn't in
-- a single-tenant backfill but defend), children will inherit correctly.

UPDATE "EmployeeBranch" eb
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE eb."employeeId" = e.id AND eb."organizationId" IS NULL;

UPDATE "EmployeeService" es
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE es."employeeId" = e.id AND es."organizationId" IS NULL;

UPDATE "EmployeeAvailability" ea
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE ea."employeeId" = e.id AND ea."organizationId" IS NULL;

UPDATE "EmployeeAvailabilityException" ex
  SET "organizationId" = e."organizationId"
  FROM "Employee" e
  WHERE ex."employeeId" = e.id AND ex."organizationId" IS NULL;

-- ClientRefreshToken inherits from parent Client.
UPDATE "ClientRefreshToken" crt
  SET "organizationId" = c."organizationId"
  FROM "Client" c
  WHERE crt."clientId" = c.id AND crt."organizationId" IS NULL;
```

- [ ] **Step 3.2: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 3.3: Verify zero NULL rows remain**

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const tables = ['client','employee','employeeBranch','employeeService','employeeAvailability','employeeAvailabilityException','clientRefreshToken'];
  let failed = false;
  for (const t of tables) {
    const total = await p[t].count();
    const missing = await p[t].count({ where: { organizationId: null } });
    console.log({ table: t, total, missing });
    if (missing > 0) failed = true;
  }
  await p.\$disconnect();
  if (failed) process.exit(1);
}
main();
"
```

Expected: all zero missing. Non-zero means a backfill UPDATE didn't match (e.g., orphaned `EmployeeBranch` without a parent `Employee`) — investigate before proceeding.

- [ ] **Step 3.4: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02b_people_backfill
git commit -m "feat(saas-02b): migration — backfill organizationId on 7 people-cluster tables"
```

---

## Task 4 — `ClientTokenService`: require tenantClaims

**Files:**
- Modify: `apps/backend/src/modules/identity/shared/client-token.service.ts`
- Modify: matching `.spec.ts` (create if absent)

- [ ] **Step 4.1: Read current file**

```bash
cd apps/backend && cat src/modules/identity/shared/client-token.service.ts
```

Expected shape: similar to `TokenService` but signs/persists `ClientRefreshToken` instead. Identify the `create` call.

- [ ] **Step 4.2: Change signature + add organizationId write**

```ts
export interface ClientTenantClaims {
  organizationId: string;
}

async issueTokenPair(
  client: { id: string; email: string | null; phone: string | null; name: string },
  tenantClaims: ClientTenantClaims,     // SaaS-02b — required
): Promise<TokenPair> {
  const payload = {
    sub: client.id,
    email: client.email,
    phone: client.phone,
    name: client.name,
    aud: 'client',                       // namespace distinction vs staff JWT
    organizationId: tenantClaims.organizationId,    // SaaS-02b
  };

  const accessToken = this.jwt.sign(payload, {
    secret: this.config.getOrThrow('JWT_CLIENT_ACCESS_SECRET'),
    expiresIn: this.config.get('JWT_CLIENT_ACCESS_TTL') ?? '15m',
  });

  // ... existing refresh-token hashing unchanged ...

  await this.prisma.clientRefreshToken.create({
    data: {
      clientId: client.id,
      organizationId: tenantClaims.organizationId,  // SaaS-02b
      tokenHash,
      tokenSelector,
      expiresAt,
    },
  });

  return { accessToken, refreshToken: rawRefresh };
}
```

Adapt exact property names to the service's real shape.

- [ ] **Step 4.3: Write the spec**

Create or update `client-token.service.spec.ts`:

```ts
it('persists organizationId on ClientRefreshToken', async () => {
  const client = await seedClient({ organizationId: 'org-1' });
  await svc.issueTokenPair(client, { organizationId: 'org-1' });
  const token = await prisma.clientRefreshToken.findFirst({ where: { clientId: client.id } });
  expect(token?.organizationId).toBe('org-1');
});

it('emits organizationId in client JWT', async () => {
  const client = await seedClient({ organizationId: 'org-2' });
  const pair = await svc.issueTokenPair(client, { organizationId: 'org-2' });
  const decoded = JSON.parse(
    Buffer.from(pair.accessToken.split('.')[1], 'base64url').toString(),
  );
  expect(decoded.organizationId).toBe('org-2');
  expect(decoded.aud).toBe('client');
});
```

- [ ] **Step 4.4: Fix broken callsites**

```bash
cd apps/backend && npm run typecheck 2>&1 | grep -E "client-token|issueTokenPair" | head -20
```

Every call to `clientTokens.issueTokenPair(client)` must now pass `{ organizationId }`. Fix in:
- `register.handler.ts`
- `client-login.handler.ts`
- `client-refresh.handler.ts`
- `reset-password.handler.ts` (if it re-issues)

Each source will be fully rewired in later tasks. For now, quick-fix: pass `{ organizationId: client.organizationId ?? DEFAULT_ORGANIZATION_ID }` so typecheck passes. Tasks 5–8 harden each handler properly.

- [ ] **Step 4.5: Commit**

```bash
git add apps/backend/src/modules/identity/shared
git commit -m "feat(saas-02b): ClientTokenService requires tenantClaims + persists organizationId"
```

---

## Task 5 — `ClientJwtStrategy`: propagate organizationId to req.user

**Files:**
- Modify: `apps/backend/src/modules/identity/client-jwt.strategy.ts`
- Modify: matching `.spec.ts`

- [ ] **Step 5.1: Extend the strategy's validate()**

```ts
async validate(payload: any) {
  const client = await this.prisma.client.findUnique({ where: { id: payload.sub } });
  if (!client || !client.isActive) throw new UnauthorizedException();

  return {
    id: client.id,
    email: client.email,
    phone: client.phone,
    name: client.name,
    organizationId: payload.organizationId ?? client.organizationId,   // SaaS-02b
    aud: 'client',
  };
}
```

The fallback `client.organizationId` handles tokens issued before 02b (if any pre-migration tokens still float in the wild).

- [ ] **Step 5.2: Update spec + commit**

```bash
cd apps/backend && npx jest client-jwt.strategy.spec
git add apps/backend/src/modules/identity/client-jwt.strategy.ts apps/backend/src/modules/identity/client-jwt.strategy.spec.ts
git commit -m "feat(saas-02b): ClientJwtStrategy propagates organizationId to req.user"
```

---

## Task 6 — Client registration + login: set and scope organizationId

**Files:**
- Modify: `apps/backend/src/modules/identity/client-auth/register.handler.ts`
- Modify: `apps/backend/src/modules/identity/client-auth/client-login.handler.ts`
- Modify: matching `.spec.ts` files

- [ ] **Step 6.1: `register.handler.ts`**

Read → determine the point where a new `Client` is `create`d. Inject `TenantContextService`, resolve the tenant org, persist on the Client:

```ts
import { TenantContextService, DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';

@Injectable()
export class RegisterHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly clientTokens: ClientTokenService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: RegisterCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    // Pre-check: does this phone already exist in THIS org?
    const existing = await this.prisma.client.findUnique({
      where: { client_org_phone: { organizationId, phone: cmd.phone } },
    });
    if (existing) throw new ConflictException('Phone already registered in this organization');

    const client = await this.prisma.client.create({
      data: {
        organizationId,                                // SaaS-02b
        name: cmd.name,
        phone: cmd.phone,
        email: cmd.email ?? null,
        passwordHash: await this.password.hash(cmd.password),
        accountType: 'FULL',
        source: 'ONLINE',
      },
    });

    return this.clientTokens.issueTokenPair(client, { organizationId });
  }
}
```

- [ ] **Step 6.2: `client-login.handler.ts`**

Lookup is now composite:

```ts
async execute(cmd: ClientLoginCommand) {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();

  const client = await this.prisma.client.findUnique({
    where: { client_org_phone: { organizationId, phone: cmd.phone } },
  });
  if (!client || !client.passwordHash || !client.isActive) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const ok = await this.password.verify(cmd.password, client.passwordHash);
  if (!ok) throw new UnauthorizedException('Invalid credentials');

  return this.clientTokens.issueTokenPair(client, { organizationId });
}
```

- [ ] **Step 6.3: Add isolation test cases**

Append to `register.handler.spec.ts`:

```ts
it('allows same phone to register in two different orgs', async () => {
  await runWithTenant({ organizationId: 'org-A' }, () =>
    handler.execute({ phone: '+966500000001', name: 'X', password: 'Pw!12345' }),
  );
  await expect(
    runWithTenant({ organizationId: 'org-B' }, () =>
      handler.execute({ phone: '+966500000001', name: 'Y', password: 'Pw!12345' }),
    ),
  ).resolves.toBeDefined();
});

it('rejects duplicate phone within the same org', async () => {
  await runWithTenant({ organizationId: 'org-A' }, () =>
    handler.execute({ phone: '+966500000002', name: 'X', password: 'Pw!12345' }),
  );
  await expect(
    runWithTenant({ organizationId: 'org-A' }, () =>
      handler.execute({ phone: '+966500000002', name: 'Y', password: 'Pw!12345' }),
    ),
  ).rejects.toThrow(/already registered/);
});
```

- [ ] **Step 6.4: Run + commit**

```bash
cd apps/backend && npx jest register.handler.spec client-login.handler.spec
git add apps/backend/src/modules/identity/client-auth
git commit -m "feat(saas-02b): client register + login scope + set organizationId on Client"
```

---

## Task 7 — Client refresh, logout, get-me, reset-password

**Files:**
- Modify: `client-refresh.handler.ts`, `client-logout.handler.ts`, `get-me.handler.ts`, `reset-password/reset-password.handler.ts`
- Modify: matching specs

- [ ] **Step 7.1: `client-refresh.handler.ts`**

Load refresh token, read its `organizationId`, pass to new pair:

```ts
const oldToken = await this.prisma.clientRefreshToken.findFirst({
  where: { tokenSelector, revokedAt: null, expiresAt: { gt: new Date() } },
});
// ... bcrypt compare existing ...

// Revoke old (existing logic).

const organizationId = oldToken.organizationId ?? DEFAULT_ORGANIZATION_ID;
const client = await this.prisma.client.findFirst({
  where: { id: oldToken.clientId, organizationId },
});
if (!client) throw new UnauthorizedException();

return this.clientTokens.issueTokenPair(client, { organizationId });
```

- [ ] **Step 7.2: `client-logout.handler.ts`**

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
await this.prisma.clientRefreshToken.updateMany({
  where: { clientId: cmd.clientId, organizationId, revokedAt: null },
  data: { revokedAt: new Date() },
});
```

- [ ] **Step 7.3: `get-me.handler.ts`**

Scope client lookup by current org (prevents a client with a valid JWT from reading data if the token's org doesn't match the resolved tenant context — belt + suspenders):

```ts
const organizationId = this.tenant.requireOrganizationIdOrDefault();
const client = await this.prisma.client.findFirst({
  where: { id: cmd.clientId, organizationId },
});
if (!client) throw new NotFoundException();
return client;
```

- [ ] **Step 7.4: `reset-password.handler.ts`**

Lookup client by phone scoped to org; revoke tokens scoped to org.

- [ ] **Step 7.5: Specs + commit**

Add at minimum one cross-org case per handler (e.g., "logout in org A does not revoke tokens of a similarly-named client in org B").

```bash
cd apps/backend && npx jest client-refresh.handler.spec client-logout.handler.spec get-me.handler.spec reset-password.handler.spec
git add apps/backend/src/modules/identity/client-auth
git commit -m "feat(saas-02b): client refresh/logout/get-me/reset-password all scope by current org"
```

---

## Task 8 — People cluster handlers: employees + clients CRUD

**Files:**
- Modify: every handler under `apps/backend/src/modules/people/**/*.handler.ts`
- Modify: matching specs

- [ ] **Step 8.1: Enumerate handlers**

```bash
find apps/backend/src/modules/people -name "*.handler.ts" | sort
```

Expected list covers: create-client, update-client, delete-client, list-clients, get-client, list-client-bookings (if exists in people cluster); plus equivalents for employees + availability.

- [ ] **Step 8.2: Pattern — injected TenantContextService + scope where clauses**

For every read handler (`find*`, `list*`, `get*`):

```ts
const organizationId = this.tenant.requireOrganizationId();
return this.prisma.client.findFirst({ where: { id: cmd.id, organizationId } });
```

For every write handler (`create*`):

```ts
const organizationId = this.tenant.requireOrganizationId();
return this.prisma.employee.create({
  data: { ...cmd, organizationId },
});
```

For every update/delete:

```ts
const organizationId = this.tenant.requireOrganizationId();
const existing = await this.prisma.employee.findFirst({ where: { id: cmd.id, organizationId } });
if (!existing) throw new NotFoundException();
return this.prisma.employee.update({ where: { id: cmd.id }, data: cmd.patch });
```

(After Task 10 populates `SCOPED_MODELS`, the Prisma extension auto-injects `organizationId` for `findMany/findFirst/updateMany/deleteMany`. The handler-level scoping is explicit intent + defense in depth.)

- [ ] **Step 8.3: Child-table writes must set organizationId denormalized**

When creating an `EmployeeBranch`, copy from parent:

```ts
const employee = await this.prisma.employee.findFirst({
  where: { id: cmd.employeeId, organizationId },
});
if (!employee) throw new NotFoundException();

await this.prisma.employeeBranch.create({
  data: {
    employeeId: employee.id,
    branchId: cmd.branchId,
    organizationId: employee.organizationId,     // SaaS-02b — inherited
  },
});
```

Same pattern for `EmployeeService`, `EmployeeAvailability`, `EmployeeAvailabilityException`.

- [ ] **Step 8.4: Update each spec with one cross-org case**

Pattern:

```ts
it('cannot update an employee from a different org (NotFound)', async () => {
  const emp = await runWithTenant({ organizationId: 'org-A' }, () =>
    createHandler.execute({ ...fields }),
  );
  await expect(
    runWithTenant({ organizationId: 'org-B' }, () =>
      updateHandler.execute({ id: emp.id, patch: { name: 'X' } }),
    ),
  ).rejects.toThrow(NotFoundException);
});
```

- [ ] **Step 8.5: Commit**

```bash
cd apps/backend && npx jest --testPathPattern='modules/people'
git add apps/backend/src/modules/people
git commit -m "feat(saas-02b): scope all people-cluster handlers by current org"
```

---

## Task 9 — NOT NULL migration

**Files:**
- Modify: `apps/backend/prisma/schema/people.prisma` — strip `?` on 6 models
- Modify: `apps/backend/prisma/schema/identity.prisma` — strip `?` on `ClientRefreshToken.organizationId`
- Create: `apps/backend/prisma/migrations/<TS>_saas02b_people_not_null/migration.sql`

- [ ] **Step 9.1: Schema: make organizationId required**

Change `organizationId String?` → `organizationId String` on all 7 models across the two files.

- [ ] **Step 9.2: Generate migration**

```bash
cd apps/backend && npx prisma migrate dev --name saas02b_people_not_null --create-only
```

- [ ] **Step 9.3: Prepend safety guard**

At the top of the generated SQL:

```sql
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "Client" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Employee" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeBranch" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeService" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeAvailability" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeAvailabilityException" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ClientRefreshToken" WHERE "organizationId" IS NULL)
  INTO bad;
  IF bad > 0 THEN
    RAISE EXCEPTION 'SaaS-02b: % people rows still have NULL organizationId. Re-run backfill.', bad;
  END IF;
END $$;
```

- [ ] **Step 9.4: Apply + commit**

```bash
cd apps/backend && npx prisma migrate dev
git add apps/backend/prisma apps/backend/prisma/schema
git commit -m "feat(saas-02b): migration — NOT NULL organizationId on people cluster"
```

---

## Task 10 — Register people models in `SCOPED_MODELS`

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 10.1: Extend the set**

```ts
const SCOPED_MODELS: TenantScopedModelRegistry = new Set<string>([
  // SaaS-02a — identity cluster
  'RefreshToken',
  'CustomRole',
  'Permission',
  // SaaS-02b — people cluster
  'Client',
  'ClientRefreshToken',
  'Employee',
  'EmployeeBranch',
  'EmployeeService',
  'EmployeeAvailability',
  'EmployeeAvailabilityException',
]);
```

- [ ] **Step 10.2: Run full suite with permissive mode**

```bash
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run test && npm run test:e2e
```

Expected: green. Any failure here indicates a callsite missed in Tasks 4–8.

- [ ] **Step 10.3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02b): activate Prisma scoping extension for 7 people-cluster models"
```

---

## Task 11 — RLS policies

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02b_people_rls/migration.sql`

- [ ] **Step 11.1: Write migration**

```sql
-- Enable + FORCE + policies on 7 tables.

ALTER TABLE "Client"                        ENABLE ROW LEVEL SECURITY; ALTER TABLE "Client"                        FORCE ROW LEVEL SECURITY;
ALTER TABLE "Employee"                      ENABLE ROW LEVEL SECURITY; ALTER TABLE "Employee"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeBranch"                ENABLE ROW LEVEL SECURITY; ALTER TABLE "EmployeeBranch"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeService"               ENABLE ROW LEVEL SECURITY; ALTER TABLE "EmployeeService"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailability"          ENABLE ROW LEVEL SECURITY; ALTER TABLE "EmployeeAvailability"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailabilityException" ENABLE ROW LEVEL SECURITY; ALTER TABLE "EmployeeAvailabilityException" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ClientRefreshToken"            ENABLE ROW LEVEL SECURITY; ALTER TABLE "ClientRefreshToken"            FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_client                          ON "Client"                        USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_employee                        ON "Employee"                      USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_employee_branch                 ON "EmployeeBranch"                USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_employee_service                ON "EmployeeService"               USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_employee_availability           ON "EmployeeAvailability"          USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_employee_availability_exception ON "EmployeeAvailabilityException" USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
CREATE POLICY tenant_isolation_client_refresh_token            ON "ClientRefreshToken"            USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
```

- [ ] **Step 11.2: Apply**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 11.3: Verify**

```bash
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT tablename, rowsecurity, forcerowsecurity FROM pg_tables
  WHERE tablename IN ('Client','Employee','EmployeeBranch','EmployeeService','EmployeeAvailability','EmployeeAvailabilityException','ClientRefreshToken')\`
.then(r => { console.log(r); p.\$disconnect(); });
"
```

Expected: all 7 rows show both flags true.

- [ ] **Step 11.4: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02b_people_rls
git commit -m "feat(saas-02b): enable RLS + tenant_isolation policies on 7 people-cluster tables"
```

---

## Task 12 — Isolation e2e spec for people cluster

**Files:**
- Create: `apps/backend/test/tenant-isolation/people.e2e-spec.ts`

- [ ] **Step 12.1: Write the spec**

```ts
import { bootHarness, IsolationHarness } from './isolation-harness';
import * as bcrypt from 'bcryptjs';

describe('SaaS-02b — people cluster isolation', () => {
  let h: IsolationHarness;
  beforeAll(async () => { h = await bootHarness(); });
  afterAll(async () => { if (h) await h.close(); });

  it('same phone can belong to two clients in different orgs', async () => {
    const a = await h.createOrg('ppl-a', 'أ');
    const b = await h.createOrg('ppl-b', 'ب');
    const phone = `+96650${Date.now().toString().slice(-7)}`;

    const cA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.client.create({
        data: { organizationId: a.id, name: 'Iso-A', phone, accountType: 'FULL', source: 'ONLINE' },
      }),
    );
    const cB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.client.create({
        data: { organizationId: b.id, name: 'Iso-B', phone, accountType: 'FULL', source: 'ONLINE' },
      }),
    );
    expect(cA.id).not.toBe(cB.id);
  });

  it('client registered in org A is invisible from org B', async () => {
    const a = await h.createOrg('ppl-inv-a', 'أ');
    const b = await h.createOrg('ppl-inv-b', 'ب');
    const c = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.client.create({ data: { organizationId: a.id, name: 'Hidden', phone: `+966${Date.now()}`, accountType: 'FULL', source: 'ONLINE' } }),
    );
    const fromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.client.findUnique({ where: { id: c.id } }),
    );
    expect(fromB).toBeNull();
  });

  it('employee slug is unique per org (same slug in two orgs is allowed)', async () => {
    const a = await h.createOrg('ppl-slug-a', 'أ');
    const b = await h.createOrg('ppl-slug-b', 'ب');
    const eA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employee.create({ data: { organizationId: a.id, name: 'Dr A', slug: 'dr-smith' } }),
    );
    const eB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.employee.create({ data: { organizationId: b.id, name: 'Dr B', slug: 'dr-smith' } }),
    );
    expect(eA.id).not.toBe(eB.id);
  });

  it('employee availability rows inherit org from parent', async () => {
    const a = await h.createOrg('ppl-avail-a', 'أ');
    const e = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employee.create({ data: { organizationId: a.id, name: 'Dr', slug: `dr-${Date.now()}` } }),
    );
    const av = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employeeAvailability.create({
        data: { employeeId: e.id, organizationId: a.id, dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
      }),
    );
    expect(av.organizationId).toBe(a.id);
  });

  it('client refresh tokens are scoped', async () => {
    const a = await h.createOrg('ppl-crt-a', 'أ');
    const b = await h.createOrg('ppl-crt-b', 'ب');
    const cA = await h.runAs({ organizationId: a.id }, () =>
      h.prisma.client.create({ data: { organizationId: a.id, name: 'CA', phone: `+966${Date.now()}1`, accountType: 'FULL', source: 'ONLINE' } }),
    );
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.clientRefreshToken.create({
        data: { clientId: cA.id, organizationId: a.id, tokenHash: 'h', tokenSelector: 's', expiresAt: new Date(Date.now() + 86_400_000) },
      }),
    );
    const fromB = await h.runAs({ organizationId: b.id }, () =>
      h.prisma.clientRefreshToken.findMany({ where: { clientId: cA.id } }),
    );
    expect(fromB).toEqual([]);
  });

  it('RLS hides people rows at SQL level when GUC differs', async () => {
    const a = await h.createOrg('ppl-rls-a', 'أ');
    const b = await h.createOrg('ppl-rls-b', 'ب');
    await h.runAs({ organizationId: a.id }, () =>
      h.prisma.employee.create({ data: { organizationId: a.id, name: 'RLS', slug: `rls-${Date.now()}` } }),
    );
    const rowsFromB = await h.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${b.id}'`);
      return tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "Employee" WHERE name = 'RLS'
      `;
    });
    // Note: RLS bypass if running as PG superuser — see saas-tenancy.md.
    // This assertion expects a non-superuser role; harness handles role setup.
    expect(Number(rowsFromB[0].count)).toBe(0);
  });
});
```

- [ ] **Step 12.2: Run**

```bash
cd apps/backend && TENANT_ENFORCEMENT=permissive npm run test:e2e -- --testPathPattern='tenant-isolation/people'
```

Expected: all 6 specs pass.

- [ ] **Step 12.3: Commit**

```bash
git add apps/backend/test/tenant-isolation/people.e2e-spec.ts
git commit -m "test(saas-02b): people cluster cross-tenant isolation e2e (6 cases)"
```

---

## Task 13 — Amend rollout playbook with 02b lessons

**Files:**
- Modify: `apps/backend/docs/saas-tenancy.md`

- [ ] **Step 13.1: Append "Client auth tenancy" section**

Append to `saas-tenancy.md`:

````markdown
## Client auth tenancy (added in SaaS-02b)

Client JWT carries `organizationId` just like staff JWT. Differences:

- Client tenant resolution happens at registration time — which organization is the website currently serving? Until Plan 09 ships subdomain routing, client requests in dev/test fall back to `DEFAULT_ORGANIZATION_ID`. Override in tests via `runAs({ organizationId })` helper.
- Clients with the same phone number can exist in multiple orgs — unique is `(organizationId, phone)`, not `phone` alone.
- `ClientRefreshToken.organizationId` mirrors `Client.organizationId`. Inconsistency = bug.

### Adding a new client-auth handler

1. Inject `TenantContextService`.
2. Call `tenant.requireOrganizationIdOrDefault()` — uses default org when context unset.
3. Use composite-unique-name Prisma keys: `findUnique({ where: { client_org_phone: { organizationId, phone } } })`.
4. When creating `ClientRefreshToken`, always pass `organizationId` from the parent `Client`.

## People cluster example (SaaS-02b)

Covers 7 models, 10+ handler updates. Key new patterns:

- **Per-org unique uniques** replacing previously-global unique columns (`Client.phone`, `Employee.email`, `Employee.slug`).
- **Denormalized FK orgId** on child tables (`EmployeeBranch`, `EmployeeService`, `EmployeeAvailability`, `EmployeeAvailabilityException`) — set from parent at write time; RLS + Prisma extension enforce at read time.

See commits prefixed `feat(saas-02b):` on the `feat/saas-02b-people-cluster` branch.
````

- [ ] **Step 13.2: Commit**

```bash
git add apps/backend/docs/saas-tenancy.md
git commit -m "docs(saas-02b): client auth tenancy + people cluster playbook addendum"
```

---

## Task 14 — Final verification + PR

- [ ] **Step 14.1: Full suite, all modes**

```bash
cd apps/backend && npm run typecheck && npm run test && npm run test:e2e
TENANT_ENFORCEMENT=permissive npm run test
TENANT_ENFORCEMENT=off npm run test
```

All three runs must be green.

- [ ] **Step 14.2: Manual smoke**

Boot dev server, register a client via website (`localhost:5104`), log in, hit `GET /api/v1/client/me`. Decoded JWT should show `organizationId`.

- [ ] **Step 14.3: Open PR**

```bash
git push -u origin feat/saas-02b-people-cluster
gh pr create --title "feat(saas-02b): people cluster tenant rollout — Client + Employee + ClientRefreshToken + 4 child tables" --body "$(cat <<'EOF'
## Summary
Second cluster rollout of SaaS-02. 7 models across people + identity get `organizationId`. Client auth (website users) becomes tenant-aware — previously deferred from 02a.

## What changed
- Schema: 7 models gain `organizationId` with FK to Organization (ON DELETE RESTRICT).
- Per-org uniques: `(organizationId, phone)` on Client, `(organizationId, email)` + `(organizationId, slug)` on Employee.
- Denormalized org on 4 child tables (EmployeeBranch/Service/Availability/Exception) — set from parent Employee at write time.
- ClientTokenService requires `tenantClaims`; ClientRefreshToken persists org.
- ClientJwtStrategy propagates `organizationId` into `req.user`.
- 6 client-auth handlers scope + set org (register, login, refresh, logout, get-me, reset-password).
- All people CRUD handlers scope reads/writes by current org.
- SCOPED_MODELS now holds 10 entries (identity + people).
- RLS policies on 7 new tables.
- 6 new isolation e2e specs, plus cross-org cases added to unit specs.

## Invariants verified
- [x] `TENANT_ENFORCEMENT=off` — unchanged behavior.
- [x] `TENANT_ENFORCEMENT=permissive` — all tests green; clients + employees scoped.
- [x] 4 new migrations, all additive.
- [x] No regression in client registration / login flows (manual smoke).

## Next
Plan 02c — org-config + org-experience clusters + first singleton conversions (BrandingConfig, OrganizationSettings).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 14.4: Done.**

---

## Self-review

- [x] Spec coverage: all 7 in-scope models + 6 client-auth handlers + all people CRUD handlers addressed.
- [x] No placeholders: explicit SQL, explicit code, explicit composite-key names.
- [x] Type consistency: `TenantClaims` / `ClientTenantClaims`, composite-key names (`client_org_phone`, `employee_org_email`, `employee_org_slug`), denormalized-org pattern, `DEFAULT_ORGANIZATION_ID` — all identical across tasks.
- [x] Carries 02a lessons (grep callsites, OrDefault helper, manual migration fallback, non-superuser RLS test role).
- [x] Reversible: each phase is an independent commit; schema changes additive; SCOPED_MODELS registration is a one-line revert.
