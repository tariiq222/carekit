# SaaS-02c — Org-Config + Org-Experience + Singletons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Checkbox (`- [ ]`) steps.

**Goal:** Extend tenant scoping to 12 org-config + org-experience models, AND execute the first two **singleton conversions** (`BrandingConfig`, `OrganizationSettings`). New pattern: singleton-per-org with upsert-on-read semantics.

**Architecture:** Same 7-phase cluster rollout pattern documented in `docs/saas-tenancy.md`. NEW pattern this plan introduces and documents: **singleton conversion** — changing `id @default("default")` (one row system-wide) → `id @default(uuid()) + organizationId @unique` (one row per org). Read handlers switch to **upsert-on-read**: if the current org has no row, create one with defaults.

**Tech Stack:** Prisma 7, PostgreSQL 16, NestJS 11. Builds on SaaS-01 / 02a / 02b.

---

## Scope

### Non-singleton models (12)

| Model | File | Uniqueness change |
|---|---|---|
| `Branch` | `organization.prisma` | — |
| `Department` | `organization.prisma` | `nameAr @unique` → `@@unique([organizationId, nameAr])` |
| `ServiceCategory` | `organization.prisma` | — |
| `Service` | `organization.prisma` | — |
| `ServiceBookingConfig` | `organization.prisma` | — (child of Service — denormalize `organizationId`) |
| `ServiceDurationOption` | `organization.prisma` | — (child of Service — denormalize) |
| `EmployeeServiceOption` | `organization.prisma` | — (child of ServiceDurationOption; cross-BC to people.EmployeeService — denormalize) |
| `BusinessHour` | `organization.prisma` | — (child of Branch — denormalize) |
| `Holiday` | `organization.prisma` | — (child of Branch — denormalize) |
| `IntakeForm` | `organization.prisma` | — |
| `IntakeField` | `organization.prisma` | — (child of IntakeForm — denormalize) |
| `Rating` | `organization.prisma` | `bookingId @unique` kept — one rating per booking, booking itself is per-org |

### Singleton models (2)

| Model | Current shape | New shape |
|---|---|---|
| `BrandingConfig` | `id @default("default")` (one row system-wide) + `websiteDomain @unique` | `id @default(uuid())` + `organizationId @unique` + **keep** `websiteDomain @unique` globally (only one org can own a domain) |
| `OrganizationSettings` | `id @default("default")` | `id @default(uuid())` + `organizationId @unique` |

### Singleton conversion strategy

1. Add `organizationId String?` nullable.
2. Backfill: `UPDATE "BrandingConfig" SET "organizationId" = DEFAULT_ORG_ID WHERE id = 'default'`. Similar for `OrganizationSettings`.
3. Change `id` default from `"default"` to `gen_random_uuid()::text`. Existing row keeps its `id = 'default'` — valid identifier, just not the default for new rows.
4. Add `@@unique([organizationId])` constraint.
5. Make `organizationId NOT NULL`.
6. Handler pattern: `upsert-on-read` — `prisma.brandingConfig.upsert({ where: { organizationId }, update: {}, create: { organizationId, ...defaults } })`.

### Invariants

Mirrors 02a/02b invariants. Plus:
- After migration, `BrandingConfig.findUnique({ where: { id: 'default' } })` still returns the default-org row (same row, same id). Callsites that used that pattern keep working until they're migrated to org-scoped lookups.
- New orgs (created in Plan 04) get BrandingConfig + OrganizationSettings via upsert-on-read — no explicit seeding needed, but Plan 04's signup wizard WILL seed them eagerly for performance.

---

## Pre-flight checks (REQUIRED before Task 1)

Carry over from 02b lessons:

- [ ] **Grep ALL callsites** of the 14 models + both singletons:

```bash
cd apps/backend
grep -rn 'prisma\.\(branch\|department\|serviceCategory\|service\|serviceBookingConfig\|serviceDurationOption\|employeeServiceOption\|businessHour\|holiday\|intakeForm\|intakeField\|rating\|brandingConfig\|organizationSettings\)\.' src | wc -l
grep -rn "findUnique.*nameAr\|findUnique.*websiteDomain" src | head -20
grep -rn "id:\s*'default'" src | head -20
```

Every `id: 'default'` callsite must be found — they ALL need to move to org-scoped lookups.

- [ ] **Check for cross-BC event consumers** that might read these models:

```bash
grep -rn "brandingConfig\|organizationSettings\|@OnEvent" src/modules | head -40
```

- [ ] **Confirm playbook and helpers exist** from 02a/02b:

```bash
grep -n "requireOrganizationIdOrDefault" apps/backend/src/common/tenant/tenant-context.service.ts
ls apps/backend/test/tenant-isolation/
```

Both should succeed.

- [ ] **Check RLS non-superuser role wrapper exists** in `isolation-harness.ts` (added in 02b Task 12 iteration):

```bash
grep -n "role\|superuser" apps/backend/test/tenant-isolation/isolation-harness.ts
```

---

## File Structure

### New files

- `apps/backend/prisma/migrations/<TS>_saas02c_org_add_org_nullable/migration.sql`
- `apps/backend/prisma/migrations/<TS>_saas02c_org_backfill/migration.sql`
- `apps/backend/prisma/migrations/<TS>_saas02c_singletons_convert/migration.sql` — the unique part
- `apps/backend/prisma/migrations/<TS>_saas02c_org_not_null/migration.sql`
- `apps/backend/prisma/migrations/<TS>_saas02c_org_rls/migration.sql`
- `apps/backend/test/tenant-isolation/org-config.e2e-spec.ts`
- `apps/backend/test/tenant-isolation/org-experience.e2e-spec.ts`
- `apps/backend/test/tenant-isolation/singletons.e2e-spec.ts`

### Modified files

- `apps/backend/prisma/schema/organization.prisma` — 14 models gain `organizationId` + singletons change defaults + composite uniques where needed.
- 44 handler files across `org-config/` + `org-experience/` clusters.
- `apps/backend/src/infrastructure/database/prisma.service.ts` — `SCOPED_MODELS` +14.
- `apps/backend/docs/saas-tenancy.md` — append "Singleton conversion pattern" section + org-config/org-experience example.

---

## Task 1 — Schema: add nullable organizationId to 12 non-singleton models

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`

- [ ] **Step 1.1: `Branch`**

```prisma
model Branch {
  id             String   @id @default(uuid())
  organizationId String?                     // SaaS-02c
  nameAr         String
  // ... existing unchanged ...

  businessHours BusinessHour[]
  holidays      Holiday[]

  @@index([organizationId])
}
```

- [ ] **Step 1.2: `Department` — composite unique on nameAr**

```prisma
model Department {
  id             String   @id @default(uuid())
  organizationId String?                     // SaaS-02c
  nameAr         String                       // was @unique globally
  // ... existing unchanged ...

  categories ServiceCategory[]

  @@unique([organizationId, nameAr], name: "dept_org_nameAr")  // SaaS-02c
  @@index([isActive])
  @@index([organizationId])
}
```

- [ ] **Step 1.3: `ServiceCategory`, `Service`** — add `organizationId String?` + `@@index([organizationId])`. No unique changes.

- [ ] **Step 1.4: `ServiceBookingConfig`, `ServiceDurationOption`** — add denormalized `organizationId String?` + `@@index`.

- [ ] **Step 1.5: `EmployeeServiceOption`** — add denormalized `organizationId String?` + `@@index`.

- [ ] **Step 1.6: `BusinessHour`, `Holiday`** — add denormalized `organizationId String?` + `@@index`.

- [ ] **Step 1.7: `IntakeForm`, `IntakeField`** — add `organizationId String?` + `@@index`.

- [ ] **Step 1.8: `Rating`** — add `organizationId String?` + `@@index`. Keep `bookingId @unique` as-is.

- [ ] **Step 1.9: Validate**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

- [ ] **Step 1.10: Commit**

```bash
git add apps/backend/prisma/schema/organization.prisma
git commit -m "feat(saas-02c): add nullable organizationId to 12 non-singleton models + composite unique on Department.nameAr"
```

---

## Task 2 — Schema: singleton adjustments

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`

- [ ] **Step 2.1: `BrandingConfig`**

```prisma
model BrandingConfig {
  id                    String   @id @default(uuid())         // was @default("default")
  organizationId        String?  @unique                       // SaaS-02c — @unique makes this 1-row-per-org
  // ... all fields unchanged ...
  websiteDomain         String?      @unique                   // kept globally unique (domain ownership)
  activeWebsiteTheme    WebsiteTheme @default(SAWAA)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

- [ ] **Step 2.2: `OrganizationSettings`**

```prisma
model OrganizationSettings {
  id                     String   @id @default(uuid())         // was @default("default")
  organizationId         String?  @unique                       // SaaS-02c
  // ... all other fields unchanged ...
}
```

- [ ] **Step 2.3: Validate + commit**

```bash
cd apps/backend && npx prisma validate
git add apps/backend/prisma/schema/organization.prisma
git commit -m "feat(saas-02c): singleton schema change — organizationId @unique on BrandingConfig + OrganizationSettings"
```

---

## Task 3 — Schema migration (nullable + FKs + composite uniques)

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02c_org_add_org_nullable/migration.sql`

- [ ] **Step 3.1: Generate (create-only)**

```bash
cd apps/backend && npx prisma migrate dev --name saas02c_org_add_org_nullable --create-only
```

If Prisma conflicts with pgvector (per index lesson #4), write manually.

- [ ] **Step 3.2: Append FKs and verify index names**

At the end of the generated SQL, append FK constraints mirroring the 02b pattern:

```sql
-- FKs for all 14 models (singletons included)
ALTER TABLE "Branch"                ADD CONSTRAINT "Branch_organizationId_fkey"                FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Department"            ADD CONSTRAINT "Department_organizationId_fkey"            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceCategory"       ADD CONSTRAINT "ServiceCategory_organizationId_fkey"       FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Service"               ADD CONSTRAINT "Service_organizationId_fkey"               FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceBookingConfig"  ADD CONSTRAINT "ServiceBookingConfig_organizationId_fkey"  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceDurationOption" ADD CONSTRAINT "ServiceDurationOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "EmployeeServiceOption" ADD CONSTRAINT "EmployeeServiceOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "BusinessHour"          ADD CONSTRAINT "BusinessHour_organizationId_fkey"          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Holiday"               ADD CONSTRAINT "Holiday_organizationId_fkey"               FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "IntakeForm"            ADD CONSTRAINT "IntakeForm_organizationId_fkey"            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "IntakeField"           ADD CONSTRAINT "IntakeField_organizationId_fkey"           FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Rating"                ADD CONSTRAINT "Rating_organizationId_fkey"                FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "BrandingConfig"        ADD CONSTRAINT "BrandingConfig_organizationId_fkey"        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "OrganizationSettings"  ADD CONSTRAINT "OrganizationSettings_organizationId_fkey"  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
```

Also make sure the old `"Department_nameAr_key"` unique got dropped by Prisma (grep the generated SQL for `DROP INDEX.*Department.*nameAr`; if missing, add `DROP INDEX IF EXISTS "Department_nameAr_key";`).

- [ ] **Step 3.3: Apply + typecheck + commit**

```bash
cd apps/backend && npx prisma migrate dev && npm run typecheck
git add apps/backend/prisma/migrations/*_saas02c_org_add_org_nullable
git commit -m "feat(saas-02c): migration — nullable organizationId + FKs + composite unique (Department)"
```

---

## Task 4 — Backfill migration

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02c_org_backfill/migration.sql`

- [ ] **Step 4.1: Write SQL**

```sql
-- SaaS-02c: assign existing rows to default organization.
-- Child tables inherit from parent — more robust than hardcoded UUIDs if a
-- future staging DB has different orgs.

UPDATE "Branch"          SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Department"      SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ServiceCategory" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Service"         SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "IntakeForm"      SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Rating"          SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- Inherit from parents
UPDATE "ServiceBookingConfig"  sbc SET "organizationId" = s."organizationId" FROM "Service"       s WHERE sbc."serviceId"  = s.id AND sbc."organizationId"  IS NULL;
UPDATE "ServiceDurationOption" sdo SET "organizationId" = s."organizationId" FROM "Service"       s WHERE sdo."serviceId"  = s.id AND sdo."organizationId"  IS NULL;
UPDATE "EmployeeServiceOption" eso SET "organizationId" = sdo."organizationId" FROM "ServiceDurationOption" sdo WHERE eso."durationOptionId" = sdo.id AND eso."organizationId" IS NULL;
UPDATE "BusinessHour"          bh  SET "organizationId" = b."organizationId" FROM "Branch"        b WHERE bh."branchId"    = b.id AND bh."organizationId"   IS NULL;
UPDATE "Holiday"               h   SET "organizationId" = b."organizationId" FROM "Branch"        b WHERE h."branchId"     = b.id AND h."organizationId"    IS NULL;
UPDATE "IntakeField"           f   SET "organizationId" = i."organizationId" FROM "IntakeForm"    i WHERE f."formId"       = i.id AND f."organizationId"    IS NULL;

-- Singletons (IDEMPOTENT — existing 'default' row gets default org)
UPDATE "BrandingConfig"       SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OrganizationSettings" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
```

- [ ] **Step 4.2: Apply + verify zero NULLs remain**

```bash
cd apps/backend && npx prisma migrate dev
cd apps/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const models = ['branch','department','serviceCategory','service','serviceBookingConfig','serviceDurationOption','employeeServiceOption','businessHour','holiday','intakeForm','intakeField','rating','brandingConfig','organizationSettings'];
(async () => {
  let bad = 0;
  for (const m of models) {
    const total = await p[m].count();
    const missing = await p[m].count({ where: { organizationId: null } });
    console.log({ m, total, missing });
    if (missing > 0) bad++;
  }
  await p.\$disconnect();
  if (bad) process.exit(1);
})();
"
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/backend/prisma/migrations/*_saas02c_org_backfill
git commit -m "feat(saas-02c): migration — backfill organizationId on 14 org-config/experience models incl. singletons"
```

---

## Task 5 — BrandingConfig singleton handlers (upsert-on-read pattern)

**Files:**
- Modify: `apps/backend/src/modules/org-experience/branding/get-branding.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/public/get-public-branding.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`
- Modify: matching spec files

- [ ] **Step 5.1: `get-branding.handler.ts` — upsert-on-read**

```ts
import { TenantContextService, DEFAULT_ORGANIZATION_ID } from '../../../common/tenant';

@Injectable()
export class GetBrandingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute() {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    return this.prisma.brandingConfig.upsert({
      where: { organizationId },
      update: {},
      create: {
        organizationId,
        organizationNameAr: 'CareKit',
        activeWebsiteTheme: 'SAWAA',
      },
    });
  }
}
```

The `update: {}` is intentional — no-op on hit; `create: {...defaults}` populates sensible defaults on first access for a new org. The singleton no longer exists globally; every org has its own row.

- [ ] **Step 5.2: `upsert-branding.handler.ts`**

```ts
async execute(cmd: UpsertBrandingCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  return this.prisma.brandingConfig.upsert({
    where: { organizationId },
    update: { ...cmd },
    create: { organizationId, ...cmd, organizationNameAr: cmd.organizationNameAr ?? 'CareKit' },
  });
}
```

Plus: any call site that previously did `findUnique({ where: { id: 'default' } })` — update to `findUnique({ where: { organizationId } })`.

- [ ] **Step 5.3: `get-public-branding.handler.ts`**

Public endpoint — the tenant is resolved from host subdomain (Plan 09) or falls back to default. Use `requireOrganizationIdOrDefault()`:

```ts
async execute() {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  const config = await this.prisma.brandingConfig.findUnique({ where: { organizationId } });
  // defaults for unbranded orgs
  return config ?? { organizationNameAr: 'CareKit', activeWebsiteTheme: 'SAWAA' };
}
```

- [ ] **Step 5.4: `upload-logo.handler.ts`** — update the field on the scoped row:

```ts
async execute(cmd: UploadLogoCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  // ... existing file upload logic ...
  return this.prisma.brandingConfig.upsert({
    where: { organizationId },
    update: { logoUrl: publicUrl },
    create: { organizationId, logoUrl: publicUrl, organizationNameAr: 'CareKit' },
  });
}
```

- [ ] **Step 5.5: Update specs + run**

Each spec needs at minimum: "reads the org-scoped row, not a global default" + "two orgs can have different branding simultaneously".

```bash
cd apps/backend && npx jest --testPathPattern='branding'
```

- [ ] **Step 5.6: Commit**

```bash
git add apps/backend/src/modules/org-experience/branding
git commit -m "feat(saas-02c): BrandingConfig singleton handlers use upsert-on-read per org"
```

---

## Task 6 — OrganizationSettings singleton handlers

**Files:**
- Modify: `get-org-settings.handler.ts`, `upsert-org-settings.handler.ts` + specs

- [ ] **Step 6.1: Same upsert-on-read pattern as BrandingConfig**

```ts
// get-org-settings.handler.ts
async execute() {
  const organizationId = this.tenant.requireOrganizationIdOrDefault();
  return this.prisma.organizationSettings.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId },   // schema defaults handle vatRate, locale, timezone, etc.
  });
}
```

```ts
// upsert-org-settings.handler.ts
async execute(cmd: UpsertOrgSettingsCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  return this.prisma.organizationSettings.upsert({
    where: { organizationId },
    update: cmd,
    create: { organizationId, ...cmd },
  });
}
```

- [ ] **Step 6.2: Grep all other callsites that read OrganizationSettings**

```bash
cd apps/backend && grep -rn "organizationSettings\.findUnique\|organizationSettings\.findFirst" src | head -20
```

Likely hits: ZATCA handlers read `vatRate`, Invoice generator reads seller address, email handlers read footer social. All must migrate to scoped lookup. Add each to commit.

- [ ] **Step 6.3: Run + commit**

```bash
cd apps/backend && npx jest --testPathPattern='org-settings'
git add apps/backend/src/modules
git commit -m "feat(saas-02c): OrganizationSettings singleton handlers use upsert-on-read per org + migrate all downstream readers"
```

---

## Task 7 — Branches handlers

**Files:**
- Modify: 9 handlers in `apps/backend/src/modules/org-config/branches/`

- [ ] **Step 7.1: Apply the standard cluster-rollout pattern**

Every handler:
1. Inject `TenantContextService`.
2. On creates: `data: { ..., organizationId }`.
3. On reads/updates/deletes: `where: { ..., organizationId }` (extension covers this but spell it out for intent).
4. Public branches handler (`public/get-public-branches.handler.ts`): use `requireOrganizationIdOrDefault()`.

Reference pattern from 02b Task 8.

- [ ] **Step 7.2: Specs — add one cross-org case per handler**

Example for `create-branch`:

```ts
it('allows same branch name in two different orgs', async () => {
  await runWithTenant({ organizationId: 'org-A' }, async () =>
    handler.execute({ nameAr: 'الفرع الرئيسي' }),
  );
  await expect(
    runWithTenant({ organizationId: 'org-B' }, async () =>
      handler.execute({ nameAr: 'الفرع الرئيسي' }),
    ),
  ).resolves.toBeDefined();
});
```

- [ ] **Step 7.3: Commit**

```bash
git add apps/backend/src/modules/org-config/branches
git commit -m "feat(saas-02c): scope 9 branch handlers by current org"
```

---

## Task 8 — BusinessHours + Holidays handlers

**Files:**
- Modify: 5 handlers in `apps/backend/src/modules/org-config/business-hours/`

- [ ] **Step 8.1: Pattern (denormalized org inherited from parent Branch)**

`set-business-hours.handler.ts` writes `BusinessHour` rows keyed by `branchId`. Inherit org from the branch:

```ts
async execute(cmd: SetBusinessHoursCommand) {
  const organizationId = this.tenant.requireOrganizationId();
  const branch = await this.prisma.branch.findFirst({
    where: { id: cmd.branchId, organizationId },
  });
  if (!branch) throw new NotFoundException();

  await this.prisma.$transaction([
    this.prisma.businessHour.deleteMany({ where: { branchId: branch.id, organizationId } }),
    this.prisma.businessHour.createMany({
      data: cmd.hours.map((h) => ({
        ...h,
        branchId: branch.id,
        organizationId,    // denormalized from branch
      })),
    }),
  ]);

  return this.prisma.businessHour.findMany({ where: { branchId: branch.id, organizationId } });
}
```

Apply same pattern to `add-holiday`, `remove-holiday`, `list-holidays`, `get-business-hours`.

- [ ] **Step 8.2: Commit**

```bash
git add apps/backend/src/modules/org-config/business-hours
git commit -m "feat(saas-02c): scope business-hours + holidays handlers; denormalize org from Branch"
```

---

## Task 9 — Departments + Categories handlers

**Files:**
- Modify: 4 department handlers + 4 category handlers

- [ ] **Step 9.1: `create-department.handler.ts` — use composite unique**

```ts
async execute(cmd: CreateDepartmentCommand) {
  const organizationId = this.tenant.requireOrganizationId();

  const existing = await this.prisma.department.findUnique({
    where: { dept_org_nameAr: { organizationId, nameAr: cmd.nameAr } },
  });
  if (existing) throw new ConflictException('Department name already exists in this organization');

  return this.prisma.department.create({
    data: { ...cmd, organizationId },
  });
}
```

- [ ] **Step 9.2: Other department + category handlers**

Standard scoping. `delete-*`, `update-*`, `list-*` all receive `TenantContextService` and filter by org.

- [ ] **Step 9.3: Commit**

```bash
git add apps/backend/src/modules/org-config/departments apps/backend/src/modules/org-config/categories
git commit -m "feat(saas-02c): scope 8 department + category handlers by current org"
```

---

## Task 10 — Services handlers (biggest chunk — 10 files)

**Files:**
- Modify: 10 handlers in `apps/backend/src/modules/org-experience/services/`

- [ ] **Step 10.1: Apply pattern + denormalize**

- `create-service.handler.ts` — scope categoryId lookup by org, set `organizationId` on Service.
- `update-service.handler.ts`, `archive-service.handler.ts`, `get-service.handler.ts` — scope by org.
- `list-services.handler.ts` — `where: { organizationId }`.
- `set-service-booking-configs.handler.ts` — denormalize org from parent Service to each ServiceBookingConfig.
- `get-service-booking-configs.handler.ts` — scope.
- `set-duration-options.handler.ts` — denormalize to ServiceDurationOption.
- `set-employee-service-options.handler.ts` — cross-cluster: reads `people.EmployeeService` (already scoped from 02b) + writes `EmployeeServiceOption` (denormalize).
- `list-service-employees.handler.ts` — join through scoped tables.

- [ ] **Step 10.2: Specs + commit**

```bash
cd apps/backend && npx jest --testPathPattern='services' --testPathIgnorePatterns='node_modules'
git add apps/backend/src/modules/org-experience/services
git commit -m "feat(saas-02c): scope 10 service handlers + denormalize org on ServiceBookingConfig, ServiceDurationOption, EmployeeServiceOption"
```

---

## Task 11 — IntakeForms + Ratings handlers

**Files:**
- Modify: 4 intake-form handlers + 2 rating handlers

- [ ] **Step 11.1: Standard pattern**

Intake forms + fields follow parent-child denormalization. Ratings read client + employee via scoped lookups. `submit-rating.handler.ts` sets `organizationId` from current tenant + validates that bookingId/clientId/employeeId all belong to same org.

- [ ] **Step 11.2: Commit**

```bash
git add apps/backend/src/modules/org-experience/intake-forms apps/backend/src/modules/org-experience/ratings
git commit -m "feat(saas-02c): scope intake-forms + ratings handlers by current org"
```

---

## Task 12 — NOT NULL migration (strip ? from schema + safety guard)

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`
- Create: `apps/backend/prisma/migrations/<TS>_saas02c_org_not_null/migration.sql`

- [ ] **Step 12.1: Schema — remove `?` from organizationId on all 14 models**

- [ ] **Step 12.2: Generate + prepend safety guard**

```bash
cd apps/backend && npx prisma migrate dev --name saas02c_org_not_null --create-only
```

Prepend:

```sql
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "Branch"                WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Department"            WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceCategory"       WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Service"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceBookingConfig"  WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceDurationOption" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeServiceOption" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "BusinessHour"          WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Holiday"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "IntakeForm"            WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "IntakeField"           WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Rating"                WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "BrandingConfig"        WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "OrganizationSettings"  WHERE "organizationId" IS NULL)
  INTO bad;
  IF bad > 0 THEN RAISE EXCEPTION 'SaaS-02c: % org-cluster rows still NULL.', bad; END IF;
END $$;
```

- [ ] **Step 12.3: Apply + commit**

```bash
cd apps/backend && npx prisma migrate dev
git add apps/backend/prisma
git commit -m "feat(saas-02c): migration — NOT NULL organizationId on 14 org-cluster models"
```

---

## Task 13 — Register in SCOPED_MODELS

**Files:**
- Modify: `apps/backend/src/infrastructure/database/prisma.service.ts`

- [ ] **Step 13.1: Extend the set**

```ts
const SCOPED_MODELS = new Set<string>([
  // SaaS-02a
  'RefreshToken', 'CustomRole', 'Permission',
  // SaaS-02b
  'Client', 'ClientRefreshToken', 'Employee', 'EmployeeBranch', 'EmployeeService',
  'EmployeeAvailability', 'EmployeeAvailabilityException',
  // SaaS-02c
  'Branch', 'Department', 'ServiceCategory', 'Service',
  'ServiceBookingConfig', 'ServiceDurationOption', 'EmployeeServiceOption',
  'BusinessHour', 'Holiday',
  'IntakeForm', 'IntakeField', 'Rating',
  'BrandingConfig', 'OrganizationSettings',
]);
```

- [ ] **Step 13.2: Run full suite, both modes**

```bash
cd apps/backend && npm run test && npm run test:e2e
TENANT_ENFORCEMENT=off npm run test
```

- [ ] **Step 13.3: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02c): activate Prisma scoping extension for 14 org-cluster models"
```

---

## Task 14 — RLS policies

**Files:**
- Create: `apps/backend/prisma/migrations/<TS>_saas02c_org_rls/migration.sql`

- [ ] **Step 14.1: Write migration**

14 tables × `ENABLE + FORCE + policy`. Pattern identical to 02a/02b:

```sql
ALTER TABLE "Branch"                ENABLE ROW LEVEL SECURITY; ALTER TABLE "Branch"                FORCE ROW LEVEL SECURITY;
-- (repeat for all 14 tables)

CREATE POLICY tenant_isolation_branch                  ON "Branch"                USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
-- (repeat, one policy per table, snake_case policy names)
```

Generate the full block by copy-paste; 14 identical pairs.

- [ ] **Step 14.2: Apply + verify + commit**

```bash
cd apps/backend && npx prisma migrate dev
git add apps/backend/prisma/migrations/*_saas02c_org_rls
git commit -m "feat(saas-02c): enable RLS + tenant_isolation policies on 14 org-cluster tables"
```

---

## Task 15 — Isolation e2e specs

**Files:**
- Create: `test/tenant-isolation/org-config.e2e-spec.ts`
- Create: `test/tenant-isolation/org-experience.e2e-spec.ts`
- Create: `test/tenant-isolation/singletons.e2e-spec.ts`

- [ ] **Step 15.1: `singletons.e2e-spec.ts` — the most important**

```ts
import { bootHarness, IsolationHarness } from './isolation-harness';

describe('SaaS-02c — singleton isolation', () => {
  let h: IsolationHarness;
  beforeAll(async () => { h = await bootHarness(); });
  afterAll(async () => { if (h) await h.close(); });

  it('each org gets its own BrandingConfig via upsert-on-read', async () => {
    const a = await h.createOrg('br-a', 'أ');
    const b = await h.createOrg('br-b', 'ب');

    const brA = await h.runAs({ organizationId: a.id }, async () =>
      h.prisma.brandingConfig.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id, organizationNameAr: 'عيادة أ' },
      }),
    );
    const brB = await h.runAs({ organizationId: b.id }, async () =>
      h.prisma.brandingConfig.upsert({
        where: { organizationId: b.id },
        update: {},
        create: { organizationId: b.id, organizationNameAr: 'عيادة ب' },
      }),
    );

    expect(brA.id).not.toBe(brB.id);
    expect(brA.organizationNameAr).toBe('عيادة أ');
    expect(brB.organizationNameAr).toBe('عيادة ب');
  });

  it('OrganizationSettings also scopes per org + defaults fill on upsert-create', async () => {
    const a = await h.createOrg('os-a', 'أ');
    const settings = await h.runAs({ organizationId: a.id }, async () =>
      h.prisma.organizationSettings.upsert({
        where: { organizationId: a.id },
        update: {},
        create: { organizationId: a.id },
      }),
    );
    expect(settings.vatRate.toString()).toBe('0.15');
    expect(settings.timezone).toBe('Asia/Riyadh');
  });

  it('websiteDomain remains globally unique (two orgs cannot claim the same domain)', async () => {
    const a = await h.createOrg('dom-a', 'أ');
    const b = await h.createOrg('dom-b', 'ب');
    await h.runAs({ organizationId: a.id }, async () =>
      h.prisma.brandingConfig.upsert({
        where: { organizationId: a.id },
        update: { websiteDomain: 'same-domain.com' },
        create: { organizationId: a.id, organizationNameAr: 'أ', websiteDomain: 'same-domain.com' },
      }),
    );
    await expect(
      h.runAs({ organizationId: b.id }, async () =>
        h.prisma.brandingConfig.upsert({
          where: { organizationId: b.id },
          update: { websiteDomain: 'same-domain.com' },
          create: { organizationId: b.id, organizationNameAr: 'ب', websiteDomain: 'same-domain.com' },
        }),
      ),
    ).rejects.toThrow(/Unique constraint/);
  });

  it('existing default row (id="default") is accessible as default-org BrandingConfig', async () => {
    const row = await h.prisma.brandingConfig.findUnique({
      where: { organizationId: '00000000-0000-0000-0000-000000000001' },
    });
    expect(row).not.toBeNull();
  });
});
```

- [ ] **Step 15.2: `org-config.e2e-spec.ts`**

Cover: same Department.nameAr in two orgs allowed; same Branch name in two orgs allowed; business hours of one branch invisible from another org context.

- [ ] **Step 15.3: `org-experience.e2e-spec.ts`**

Cover: Service with same name/slug in two orgs; intake-form + field isolation; rating row only visible within its org.

- [ ] **Step 15.4: Run**

```bash
cd apps/backend && npm run test:e2e -- --testPathPattern='tenant-isolation/(org-|singletons)'
```

- [ ] **Step 15.5: Commit**

```bash
git add apps/backend/test/tenant-isolation
git commit -m "test(saas-02c): isolation e2e for singletons + org-config + org-experience (~15 cases)"
```

---

## Task 16 — Amend playbook with singleton-conversion pattern

**Files:**
- Modify: `apps/backend/docs/saas-tenancy.md`

- [ ] **Step 16.1: Append section**

```markdown
## Singleton conversion pattern (added in SaaS-02c)

Converting a globally-unique "singleton" table (one row keyed by `id = "default"`) into a per-org table:

### Schema change
```prisma
// BEFORE
model Thing {
  id String @id @default("default")
  // ...fields
}

// AFTER
model Thing {
  id             String  @id @default(uuid())
  organizationId String  @unique    // one row per org
  // ...fields
}
```

### Migration pattern
1. Add `organizationId String?` nullable.
2. Backfill: `UPDATE "Thing" SET "organizationId" = DEFAULT_ORG WHERE "organizationId" IS NULL`.
3. Alter column default: `ALTER TABLE "Thing" ALTER COLUMN id SET DEFAULT gen_random_uuid()::text`.
4. Add unique + NOT NULL in follow-up migration.

The existing `id = 'default'` row stays — it's still a valid id (just no longer the default for new inserts).

### Handler pattern — upsert-on-read
```ts
async get() {
  const organizationId = tenant.requireOrganizationIdOrDefault();
  return prisma.thing.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, ...schemaDefaults },
  });
}

async upsert(cmd) {
  const organizationId = tenant.requireOrganizationId();
  return prisma.thing.upsert({
    where: { organizationId },
    update: cmd,
    create: { organizationId, ...cmd },
  });
}
```

### What NOT to change
- Global uniques that must remain globally unique (e.g. `websiteDomain`) — keep `@unique`, do not composite-ize.
- `id` field values of existing rows — they stay; the default just changes for new inserts.

### Grep checklist before commit
```bash
grep -rn "id:\s*'default'" apps/backend/src | head
```
Every match must be migrated to `{ organizationId }` lookup.

## Org-cluster example (SaaS-02c)

Covers 14 models (12 non-singleton + 2 singletons). First use of upsert-on-read. See commits prefixed `feat(saas-02c):` on `feat/saas-02c-org-config-singletons` branch.
```

- [ ] **Step 16.2: Commit**

```bash
git add apps/backend/docs/saas-tenancy.md
git commit -m "docs(saas-02c): singleton-conversion pattern + org-cluster example"
```

---

## Task 17 — Final verification + PR

- [ ] **Step 17.1: Full suite — both modes**

```bash
cd apps/backend
TENANT_ENFORCEMENT=off npm run test && TENANT_ENFORCEMENT=off npm run test:e2e
TENANT_ENFORCEMENT=permissive npm run test && TENANT_ENFORCEMENT=permissive npm run test:e2e
npm run typecheck
```

All must be green.

- [ ] **Step 17.2: Manual smoke**

Hit `/api/v1/dashboard/branding` with a staff JWT. Confirm the response is the default org's branding config (not the old singleton fallback).

- [ ] **Step 17.3: Open PR**

```bash
git push -u origin feat/saas-02c-org-config-singletons
gh pr create --title "feat(saas-02c): org-config + org-experience + first singleton conversions (BrandingConfig + OrganizationSettings)" --body "$(cat <<'EOF'
## Summary
Third cluster of SaaS-02 rollout. 12 non-singleton models + 2 singleton conversions. Introduces the **upsert-on-read** pattern for per-org singletons.

## What changed
- Schema: 14 models gain `organizationId` FK to Organization (ON DELETE RESTRICT).
- Composite unique on `Department.nameAr`; `websiteDomain` kept globally unique.
- **Singleton conversion:** `BrandingConfig` + `OrganizationSettings` move from `id @default("default")` (global) to `id @default(uuid()) + organizationId @unique` (per-org).
- 44 handler files across `org-config/` + `org-experience/` updated.
- 14 models added to `SCOPED_MODELS`.
- RLS policies on 14 tables.
- Isolation e2e: +15 cases spread across `singletons`, `org-config`, `org-experience` specs.
- Playbook: singleton-conversion pattern documented.

## Invariants verified
- [x] `TENANT_ENFORCEMENT=off` — unchanged.
- [x] `TENANT_ENFORCEMENT=permissive` — all tests green; upsert-on-read auto-creates rows for new orgs.
- [x] Existing `id='default'` BrandingConfig row stays accessible as default-org config.
- [x] 5 new migrations, all additive.

## New patterns documented
- Singleton conversion: three-step migration + upsert-on-read.
- Denormalized `organizationId` on child tables (BusinessHour, Holiday, IntakeField, ServiceBookingConfig, ServiceDurationOption, EmployeeServiceOption) — repeated from 02a/02b.

## Next
Plan 02d — bookings cluster + BookingSettings singleton.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 17.4: Done.**

---

## Self-review

- [x] Spec coverage: all 14 models (12 non-singleton + 2 singletons) + 44 handlers addressed via task groupings.
- [x] Singleton conversion fully specified: schema, migration, handler pattern, test.
- [x] Type consistency: `DEFAULT_ORGANIZATION_ID`, composite key names (`dept_org_nameAr`), upsert pattern — consistent across tasks.
- [x] Lessons from 02a/02b applied: grep callsites pre-flight, `requireOrganizationIdOrDefault()` in public handlers, `async` callbacks in tests, `data.organizationId` explicit on creates.
- [x] Reversible: each phase an independent commit; schema additive.
