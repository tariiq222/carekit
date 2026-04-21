# SaaS-03 — Verticals System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a `Vertical` primitive that drives clinic-type-aware terminology, seed data, and UI behavior. Each Organization belongs to one Vertical. The Vertical determines: (a) default Departments + ServiceCategories seeded into a new org, (b) bilingual terminology (`doctor` vs `consultant` vs `stylist`), (c) template family grouping (MEDICAL / CONSULTING / SALON / FITNESS) that Plan 08 uses for website themes. This plan ADDS infrastructure + seed data + terminology packs + an HTTP surface + a `useTerminology()` hook. It does NOT refactor existing dashboard strings — that is Plan 06's responsibility.

**Architecture:** Strangler pattern, consistent with Plans 01–02d. `Vertical` + `VerticalSeedDepartment` + `VerticalSeedServiceCategory` + `VerticalTerminologyOverride` are **platform-level** tables (not tenant-scoped — they describe the catalog of verticals CareKit offers). `Organization.verticalId` is a nullable FK; migration backfills the default org to the `dental` vertical. A new module at `src/modules/platform/verticals/` exposes vertical list / get / terminology endpoints under `src/api/public/` (for the signup wizard) and `src/api/dashboard/` (for super-admin CRUD). The signup wizard (Plan 07) calls `seedOrganizationFromVertical(orgId, verticalId)` which copies seed rows into the tenant's `Department` + `ServiceCategory` tables (respecting the tenant scoping Proxy). Terminology packs are JSON files under `packages/shared/terminology/{medical,consulting,salon,fitness}.json` merged at runtime with `VerticalTerminologyOverride` rows. A new dashboard hook `useTerminology()` reads `session.organization.vertical.templateFamily` and returns a `t(key)` function returning `{ ar, en }`.

**Tech Stack:** NestJS 11, Prisma 7, `nestjs-cls` (`TenantContextService`), `@carekit/shared` (new `terminology/` folder), Next.js 15 dashboard, Jest + Supertest (e2e).

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites first.** Plans miss callsites. Before committing any code that registers a new handler or module, grep for existing references.
2. **Migrations are immutable.** Append-only; never edit historical migrations.
3. **`$transaction` callback form bypasses the Proxy.** `tx` inside `async (tx) => {}` is a raw client — explicit `organizationId` required in ALL `tx.*.create()` / `tx.*.findFirst()` calls inside the callback when scoped models are touched. Relevant to `seed-organization-from-vertical.handler.ts` because it creates Department + ServiceCategory rows inside a transaction.
4. **Extension covers `where` not `data`.** All `prisma.*.create({ data: {} })` for scoped models need explicit `organizationId`.
5. **`TENANT_ENFORCEMENT=off` must keep working.** Public endpoints (`list-verticals`, `get-terminology`) hit platform tables — no tenant context required. Seeding runs inside a tenant context (set by the caller — signup wizard or super-admin acting-as-tenant).
6. **`runAs` / CLS callbacks must be `async () => {}`.** The seed helper may be called from a BullMQ job — ensure the caller wraps in `tenant.runAs(orgId, async () => {...})`.
7. **Divergence-before-commit.** If reality disagrees with any step, STOP, document, propose amendment, execute only after confirmation.

---

## SCOPED_MODELS after this plan

Vertical tables are **platform-level** (not tenant-scoped). SCOPED_MODELS is unchanged by 03:

```ts
// 03 adds no rows to SCOPED_MODELS — Vertical, VerticalSeedDepartment,
// VerticalSeedServiceCategory, VerticalTerminologyOverride are platform-level.
```

---

## File Structure

### New files (created in this plan)

**Schema:**
- `apps/backend/prisma/schema/platform.prisma` — extend with `Vertical`, `VerticalSeedDepartment`, `VerticalSeedServiceCategory`, `VerticalTerminologyOverride`, `TemplateFamily` enum.

**Migration:**
- `apps/backend/prisma/migrations/<ts>_saas_03_verticals_system/migration.sql`
- `apps/backend/prisma/migrations/<ts>_saas_03_verticals_seed_data/migration.sql`

**Backend module:**
- `apps/backend/src/modules/platform/verticals/verticals.module.ts`
- `apps/backend/src/modules/platform/verticals/list-verticals/list-verticals.handler.ts`
- `apps/backend/src/modules/platform/verticals/list-verticals/list-verticals.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/get-vertical/get-vertical.handler.ts`
- `apps/backend/src/modules/platform/verticals/get-vertical/get-vertical.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/get-terminology/get-terminology.handler.ts`
- `apps/backend/src/modules/platform/verticals/get-terminology/get-terminology.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/seed-organization-from-vertical/seed-organization-from-vertical.handler.ts`
- `apps/backend/src/modules/platform/verticals/seed-organization-from-vertical/seed-organization-from-vertical.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/create-vertical/create-vertical.handler.ts` (super-admin)
- `apps/backend/src/modules/platform/verticals/create-vertical/create-vertical.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/update-vertical/update-vertical.handler.ts` (super-admin)
- `apps/backend/src/modules/platform/verticals/update-vertical/update-vertical.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/upsert-vertical-seed/upsert-vertical-seed.handler.ts` (super-admin)
- `apps/backend/src/modules/platform/verticals/upsert-vertical-seed/upsert-vertical-seed.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/upsert-terminology-override/upsert-terminology-override.handler.ts` (super-admin)
- `apps/backend/src/modules/platform/verticals/upsert-terminology-override/upsert-terminology-override.handler.spec.ts`
- `apps/backend/src/modules/platform/verticals/terminology.types.ts` — shared TS types for terminology keys
- `apps/backend/src/modules/platform/verticals/terminology.loader.ts` — loads JSON packs from `@carekit/shared/terminology/*`
- `apps/backend/src/modules/platform/verticals/dto/list-verticals.dto.ts`
- `apps/backend/src/modules/platform/verticals/dto/create-vertical.dto.ts`
- `apps/backend/src/modules/platform/verticals/dto/upsert-vertical-seed.dto.ts`
- `apps/backend/src/modules/platform/verticals/dto/upsert-terminology-override.dto.ts`

**Controllers:**
- `apps/backend/src/api/public/verticals.controller.ts` — public list + get + terminology
- `apps/backend/src/api/dashboard/super-admin-verticals.controller.ts` — super-admin CRUD (guarded by placeholder `SuperAdminGuard` from Plan 05b; for now uses `@SuperAdminOnly()` decorator that reads `req.user.isSuperAdmin`)

**Guard (stub that Plan 05b replaces):**
- `apps/backend/src/common/guards/super-admin.guard.ts`
- `apps/backend/src/common/guards/super-admin.guard.spec.ts`

**Shared terminology packs:**
- `packages/shared/src/terminology/medical.json`
- `packages/shared/src/terminology/consulting.json`
- `packages/shared/src/terminology/salon.json`
- `packages/shared/src/terminology/fitness.json`
- `packages/shared/src/terminology/index.ts` — barrel export + `TerminologyKey` TS type + `TerminologyPack` interface

**Dashboard hook:**
- `apps/dashboard/hooks/use-terminology.ts`
- `apps/dashboard/hooks/use-terminology.test.tsx`

**Tests (backend e2e):**
- `apps/backend/test/e2e/platform/verticals-public.e2e-spec.ts`
- `apps/backend/test/e2e/platform/terminology-merge.e2e-spec.ts`
- `apps/backend/test/e2e/platform/seed-organization-from-vertical.e2e-spec.ts`

**Memory:**
- `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas03_status.md`

### Modified files

- `apps/backend/prisma/schema/organization.prisma` — NOT modified. Organization model already lives in `platform.prisma`.
- `apps/backend/prisma/schema/platform.prisma` — extend `Organization` with `verticalId String?` FK.
- `apps/backend/src/modules/platform/platform.module.ts` (or `app.module.ts` import list) — register `VerticalsModule`.
- `apps/backend/src/api/public/public.module.ts` — register `VerticalsController`.
- `apps/backend/src/api/dashboard/dashboard.module.ts` — register `SuperAdminVerticalsController`.
- `packages/shared/package.json` — ensure `./terminology` subpath export if needed.
- `apps/backend/CLAUDE.md` — add one line under "Conventions" describing verticals pattern.

### Explicitly out of scope

- Dashboard string refactor to use `useTerminology()` (Plan 06).
- Website themes per template family (Plan 08).
- Signup wizard integration (Plan 07).
- Super-admin UI (Plan 05b) — this plan exposes the HTTP surface with a stub `SuperAdminGuard`; Plan 05b replaces the guard implementation.

---

## Invariants (must hold at every task boundary)

1. `npm run typecheck` passes.
2. `npm run test` passes.
3. `npm run test:e2e` passes.
4. `TENANT_ENFORCEMENT=off` (default) → runtime behavior unchanged for existing flows.
5. Default organization is backfilled to the `dental` vertical.
6. All 4 terminology JSON files ship with 100% coverage of `TerminologyKey` union.

---

## Task 1 — Pre-flight grep audit

- [ ] **Step 1.1: Confirm there is no existing `Vertical` model or module**

```bash
cd apps/backend && grep -rn "Vertical\|vertical" prisma/schema/ src/modules/ src/api/ --include="*.ts" --include="*.prisma" | grep -iv "vertical slice"
```

Expected: no matches related to a domain concept. If anything shows up, document and pause.

- [ ] **Step 1.2: Confirm `packages/shared/src/` structure**

```bash
ls packages/shared/src/
cat packages/shared/package.json | head -40
```

Verify the barrel `index.ts` exists and `package.json` has `"exports"` that allow adding `./terminology`. If exports are restricted, we must add the new subpath.

- [ ] **Step 1.3: Confirm `Organization` model location**

```bash
grep -n "^model Organization" apps/backend/prisma/schema/*.prisma
```

Expected: `platform.prisma`. (Plan 01 put it there.) If found elsewhere, update the file paths in this plan accordingly.

- [ ] **Step 1.4: Confirm no existing `SuperAdminGuard`**

```bash
grep -rn "SuperAdminGuard\|isSuperAdmin" apps/backend/src/ --include="*.ts"
```

Expected: references in JWT payload / TenantContextService only (from Plan 01). No existing guard class.

---

## Task 2 — Shared terminology packs (packages/shared)

We add these first because the backend loader imports them, and the dashboard hook imports the same types.

- [ ] **Step 2.1: Create `packages/shared/src/terminology/index.ts`**

```ts
// packages/shared/src/terminology/index.ts
// Terminology packs drive vertical-aware wording across dashboard and website.
// Each key has both Arabic and English values. The base pack is the template
// family's JSON; a Vertical may override individual keys via
// VerticalTerminologyOverride rows in the DB.

import medical from './medical.json';
import consulting from './consulting.json';
import salon from './salon.json';
import fitness from './fitness.json';

export const TEMPLATE_FAMILIES = ['MEDICAL', 'CONSULTING', 'SALON', 'FITNESS'] as const;
export type TemplateFamily = (typeof TEMPLATE_FAMILIES)[number];

export const TERMINOLOGY_KEYS = [
  'employee.singular',
  'employee.plural',
  'employee.possessive',
  'service.singular',
  'service.plural',
  'client.singular',
  'client.plural',
  'booking.singular',
  'booking.plural',
  'appointment.singular',
  'appointment.plural',
  'department.singular',
  'department.plural',
  'category.singular',
  'category.plural',
  'branch.singular',
  'branch.plural',
  'session.singular',
  'session.plural',
] as const;

export type TerminologyKey = (typeof TERMINOLOGY_KEYS)[number];

export interface TerminologyValue {
  ar: string;
  en: string;
}

export type TerminologyPack = Record<TerminologyKey, TerminologyValue>;

export const BASE_PACKS: Record<TemplateFamily, TerminologyPack> = {
  MEDICAL: medical as TerminologyPack,
  CONSULTING: consulting as TerminologyPack,
  SALON: salon as TerminologyPack,
  FITNESS: fitness as TerminologyPack,
};

export function mergeOverrides(
  base: TerminologyPack,
  overrides: Array<{ tokenKey: string; valueAr: string; valueEn: string }>,
): TerminologyPack {
  const out: TerminologyPack = { ...base };
  for (const o of overrides) {
    if ((TERMINOLOGY_KEYS as readonly string[]).includes(o.tokenKey)) {
      out[o.tokenKey as TerminologyKey] = { ar: o.valueAr, en: o.valueEn };
    }
  }
  return out;
}
```

- [ ] **Step 2.2: Create `medical.json`**

`packages/shared/src/terminology/medical.json`:

```json
{
  "employee.singular": { "ar": "طبيب", "en": "Doctor" },
  "employee.plural": { "ar": "الأطباء", "en": "Doctors" },
  "employee.possessive": { "ar": "طبيبك", "en": "your doctor" },
  "service.singular": { "ar": "خدمة", "en": "Service" },
  "service.plural": { "ar": "الخدمات", "en": "Services" },
  "client.singular": { "ar": "مريض", "en": "Patient" },
  "client.plural": { "ar": "المرضى", "en": "Patients" },
  "booking.singular": { "ar": "حجز", "en": "Booking" },
  "booking.plural": { "ar": "الحجوزات", "en": "Bookings" },
  "appointment.singular": { "ar": "موعد", "en": "Appointment" },
  "appointment.plural": { "ar": "المواعيد", "en": "Appointments" },
  "department.singular": { "ar": "قسم", "en": "Department" },
  "department.plural": { "ar": "الأقسام", "en": "Departments" },
  "category.singular": { "ar": "فئة", "en": "Category" },
  "category.plural": { "ar": "الفئات", "en": "Categories" },
  "branch.singular": { "ar": "فرع", "en": "Branch" },
  "branch.plural": { "ar": "الفروع", "en": "Branches" },
  "session.singular": { "ar": "جلسة", "en": "Session" },
  "session.plural": { "ar": "الجلسات", "en": "Sessions" }
}
```

- [ ] **Step 2.3: Create `consulting.json`**

```json
{
  "employee.singular": { "ar": "مستشار", "en": "Consultant" },
  "employee.plural": { "ar": "المستشارون", "en": "Consultants" },
  "employee.possessive": { "ar": "مستشارك", "en": "your consultant" },
  "service.singular": { "ar": "استشارة", "en": "Consultation" },
  "service.plural": { "ar": "الاستشارات", "en": "Consultations" },
  "client.singular": { "ar": "عميل", "en": "Client" },
  "client.plural": { "ar": "العملاء", "en": "Clients" },
  "booking.singular": { "ar": "حجز", "en": "Booking" },
  "booking.plural": { "ar": "الحجوزات", "en": "Bookings" },
  "appointment.singular": { "ar": "موعد", "en": "Appointment" },
  "appointment.plural": { "ar": "المواعيد", "en": "Appointments" },
  "department.singular": { "ar": "قسم", "en": "Department" },
  "department.plural": { "ar": "الأقسام", "en": "Departments" },
  "category.singular": { "ar": "مجال", "en": "Area" },
  "category.plural": { "ar": "المجالات", "en": "Areas" },
  "branch.singular": { "ar": "مكتب", "en": "Office" },
  "branch.plural": { "ar": "المكاتب", "en": "Offices" },
  "session.singular": { "ar": "جلسة", "en": "Session" },
  "session.plural": { "ar": "الجلسات", "en": "Sessions" }
}
```

- [ ] **Step 2.4: Create `salon.json`**

```json
{
  "employee.singular": { "ar": "مصفف", "en": "Stylist" },
  "employee.plural": { "ar": "المصففون", "en": "Stylists" },
  "employee.possessive": { "ar": "مصففك", "en": "your stylist" },
  "service.singular": { "ar": "خدمة", "en": "Service" },
  "service.plural": { "ar": "الخدمات", "en": "Services" },
  "client.singular": { "ar": "عميل", "en": "Client" },
  "client.plural": { "ar": "العملاء", "en": "Clients" },
  "booking.singular": { "ar": "حجز", "en": "Booking" },
  "booking.plural": { "ar": "الحجوزات", "en": "Bookings" },
  "appointment.singular": { "ar": "موعد", "en": "Appointment" },
  "appointment.plural": { "ar": "المواعيد", "en": "Appointments" },
  "department.singular": { "ar": "قسم", "en": "Section" },
  "department.plural": { "ar": "الأقسام", "en": "Sections" },
  "category.singular": { "ar": "فئة", "en": "Category" },
  "category.plural": { "ar": "الفئات", "en": "Categories" },
  "branch.singular": { "ar": "فرع", "en": "Location" },
  "branch.plural": { "ar": "الفروع", "en": "Locations" },
  "session.singular": { "ar": "جلسة", "en": "Session" },
  "session.plural": { "ar": "الجلسات", "en": "Sessions" }
}
```

- [ ] **Step 2.5: Create `fitness.json`**

```json
{
  "employee.singular": { "ar": "مدرب", "en": "Trainer" },
  "employee.plural": { "ar": "المدربون", "en": "Trainers" },
  "employee.possessive": { "ar": "مدربك", "en": "your trainer" },
  "service.singular": { "ar": "برنامج", "en": "Program" },
  "service.plural": { "ar": "البرامج", "en": "Programs" },
  "client.singular": { "ar": "متدرب", "en": "Member" },
  "client.plural": { "ar": "المتدربون", "en": "Members" },
  "booking.singular": { "ar": "حجز", "en": "Booking" },
  "booking.plural": { "ar": "الحجوزات", "en": "Bookings" },
  "appointment.singular": { "ar": "موعد", "en": "Session" },
  "appointment.plural": { "ar": "المواعيد", "en": "Sessions" },
  "department.singular": { "ar": "قسم", "en": "Division" },
  "department.plural": { "ar": "الأقسام", "en": "Divisions" },
  "category.singular": { "ar": "فئة", "en": "Category" },
  "category.plural": { "ar": "الفئات", "en": "Categories" },
  "branch.singular": { "ar": "فرع", "en": "Gym" },
  "branch.plural": { "ar": "الفروع", "en": "Gyms" },
  "session.singular": { "ar": "حصة", "en": "Class" },
  "session.plural": { "ar": "الحصص", "en": "Classes" }
}
```

- [ ] **Step 2.6: Wire shared barrel export**

Edit `packages/shared/src/index.ts` — add:

```ts
export * from './terminology';
```

- [ ] **Step 2.7: Ensure TypeScript allows JSON imports**

Check `packages/shared/tsconfig.json` for `"resolveJsonModule": true`. If missing, add it.

- [ ] **Step 2.8: Typecheck**

```bash
cd packages/shared && npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.9: Commit**

```bash
git add packages/shared/src/terminology/ packages/shared/src/index.ts packages/shared/tsconfig.json
git commit -m "feat(saas-03): add terminology packs for 4 template families"
```

---

## Task 3 — Schema: Vertical + seed models + Organization FK

- [ ] **Step 3.1: Read current `platform.prisma`**

```bash
cat apps/backend/prisma/schema/platform.prisma
```

Confirm `Organization` model exists (added by Plan 01).

- [ ] **Step 3.2: Append vertical models and enum**

Edit `apps/backend/prisma/schema/platform.prisma`. Append at end of file:

```prisma
// ─── Vertical (SaaS-03) ──────────────────────────────────────────────────────
// Platform-level catalog of clinic verticals CareKit supports.

enum TemplateFamily {
  MEDICAL
  CONSULTING
  SALON
  FITNESS
}

model Vertical {
  id             String          @id @default(uuid())
  slug           String          @unique   // dental, cosmetic, dermatology, physiotherapy, family-consulting, psychology, nutrition, barbershop, beauty-salon, spa, nails
  nameAr         String
  nameEn         String
  templateFamily TemplateFamily
  descriptionAr  String?
  descriptionEn  String?
  iconUrl        String?
  sortOrder      Int             @default(0)
  isActive       Boolean         @default(true)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  seedDepartments       VerticalSeedDepartment[]
  seedServiceCategories VerticalSeedServiceCategory[]
  terminologyOverrides  VerticalTerminologyOverride[]
  organizations         Organization[]

  @@index([templateFamily])
  @@index([isActive, sortOrder])
}

model VerticalSeedDepartment {
  id         String   @id @default(uuid())
  verticalId String
  vertical   Vertical @relation(fields: [verticalId], references: [id], onDelete: Cascade)
  nameAr     String
  nameEn     String
  sortOrder  Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  seedCategories VerticalSeedServiceCategory[]

  @@unique([verticalId, nameAr])
  @@index([verticalId])
}

model VerticalSeedServiceCategory {
  id           String                  @id @default(uuid())
  verticalId   String
  vertical     Vertical                @relation(fields: [verticalId], references: [id], onDelete: Cascade)
  departmentId String?
  department   VerticalSeedDepartment? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
  nameAr       String
  nameEn       String
  sortOrder    Int                     @default(0)
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  @@unique([verticalId, nameAr])
  @@index([verticalId])
  @@index([departmentId])
}

model VerticalTerminologyOverride {
  id         String   @id @default(uuid())
  verticalId String
  vertical   Vertical @relation(fields: [verticalId], references: [id], onDelete: Cascade)
  tokenKey   String   // must match a TerminologyKey in @carekit/shared
  valueAr    String
  valueEn    String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([verticalId, tokenKey])
  @@index([verticalId])
}
```

- [ ] **Step 3.3: Add `verticalId` to Organization**

In the existing `model Organization {...}` block, add after `status` (before `trialEndsAt`):

```prisma
  verticalId     String?
  vertical       Vertical?          @relation(fields: [verticalId], references: [id], onDelete: SetNull)
```

And add index at end:

```prisma
  @@index([verticalId])
```

- [ ] **Step 3.4: Validate schema**

```bash
cd apps/backend && npx prisma format && npx prisma validate
```

Expected: no errors.

---

## Task 4 — Migration (schema + seed data)

- [ ] **Step 4.1: Generate schema migration**

```bash
cd apps/backend && npx prisma migrate dev --name saas_03_verticals_system --create-only
```

Inspect the generated SQL. If generation fails (pgvector), write manually:

```sql
-- CreateEnum
CREATE TYPE "TemplateFamily" AS ENUM ('MEDICAL', 'CONSULTING', 'SALON', 'FITNESS');

-- CreateTable
CREATE TABLE "Vertical" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "templateFamily" "TemplateFamily" NOT NULL,
  "descriptionAr" TEXT,
  "descriptionEn" TEXT,
  "iconUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vertical_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vertical_slug_key" ON "Vertical"("slug");
CREATE INDEX "Vertical_templateFamily_idx" ON "Vertical"("templateFamily");
CREATE INDEX "Vertical_isActive_sortOrder_idx" ON "Vertical"("isActive", "sortOrder");

CREATE TABLE "VerticalSeedDepartment" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalSeedDepartment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalSeedDepartment_verticalId_nameAr_key" ON "VerticalSeedDepartment"("verticalId", "nameAr");
CREATE INDEX "VerticalSeedDepartment_verticalId_idx" ON "VerticalSeedDepartment"("verticalId");
ALTER TABLE "VerticalSeedDepartment" ADD CONSTRAINT "VerticalSeedDepartment_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VerticalSeedServiceCategory" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "departmentId" TEXT,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalSeedServiceCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalSeedServiceCategory_verticalId_nameAr_key" ON "VerticalSeedServiceCategory"("verticalId", "nameAr");
CREATE INDEX "VerticalSeedServiceCategory_verticalId_idx" ON "VerticalSeedServiceCategory"("verticalId");
CREATE INDEX "VerticalSeedServiceCategory_departmentId_idx" ON "VerticalSeedServiceCategory"("departmentId");
ALTER TABLE "VerticalSeedServiceCategory" ADD CONSTRAINT "VerticalSeedServiceCategory_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerticalSeedServiceCategory" ADD CONSTRAINT "VerticalSeedServiceCategory_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "VerticalSeedDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "VerticalTerminologyOverride" (
  "id" TEXT NOT NULL,
  "verticalId" TEXT NOT NULL,
  "tokenKey" TEXT NOT NULL,
  "valueAr" TEXT NOT NULL,
  "valueEn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerticalTerminologyOverride_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerticalTerminologyOverride_verticalId_tokenKey_key" ON "VerticalTerminologyOverride"("verticalId", "tokenKey");
CREATE INDEX "VerticalTerminologyOverride_verticalId_idx" ON "VerticalTerminologyOverride"("verticalId");
ALTER TABLE "VerticalTerminologyOverride" ADD CONSTRAINT "VerticalTerminologyOverride_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Organization: add verticalId FK
ALTER TABLE "Organization" ADD COLUMN "verticalId" TEXT;
CREATE INDEX "Organization_verticalId_idx" ON "Organization"("verticalId");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_verticalId_fkey"
  FOREIGN KEY ("verticalId") REFERENCES "Vertical"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4.2: Apply migration**

```bash
cd apps/backend && npx prisma migrate dev
```

- [ ] **Step 4.3: Create seed-data migration**

```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p apps/backend/prisma/migrations/${TIMESTAMP}_saas_03_verticals_seed_data
```

Write `migration.sql` with the 11 verticals and their seed departments + categories. Use deterministic UUIDs so tests can reference them:

```sql
-- Seed verticals (stable UUIDs — tests rely on these)
INSERT INTO "Vertical" (id, slug, "nameAr", "nameEn", "templateFamily", "descriptionAr", "descriptionEn", "sortOrder", "isActive", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000v0001', 'dental',            'طب الأسنان',          'Dental',              'MEDICAL',    'عيادات الأسنان',       'Dental clinics',             10,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0002', 'cosmetic',          'الطب التجميلي',       'Cosmetic',            'MEDICAL',    'عيادات التجميل',       'Cosmetic clinics',           20,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0003', 'dermatology',       'الجلدية',             'Dermatology',         'MEDICAL',    'عيادات جلدية',         'Dermatology clinics',        30,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0004', 'physiotherapy',     'العلاج الطبيعي',      'Physiotherapy',       'MEDICAL',    'عيادات العلاج الطبيعي','Physiotherapy clinics',      40,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0005', 'family-consulting', 'الاستشارات الأسرية',  'Family Consulting',   'CONSULTING', 'استشارات أسرية',       'Family consulting',          50,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0006', 'psychology',        'الاستشارات النفسية',  'Psychology',          'CONSULTING', 'استشارات نفسية',       'Psychology consulting',      60,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0007', 'nutrition',         'التغذية',             'Nutrition',           'CONSULTING', 'استشارات تغذية',       'Nutrition consulting',       70,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0008', 'barbershop',        'حلاقة رجالية',        'Barbershop',          'SALON',      'حلاقة وتصفيف رجالي',   'Men''s barbershop',          80,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0009', 'beauty-salon',      'صالون تجميل',         'Beauty Salon',        'SALON',      'صالونات التجميل',      'Beauty salons',              90,  true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0010', 'spa',               'سبا',                 'Spa',                 'SALON',      'مراكز سبا',            'Spa centers',                100, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000v0011', 'nails',             'عناية الأظافر',       'Nails',               'SALON',      'مراكز عناية الأظافر',  'Nail salons',                110, true, NOW(), NOW());

-- Seed departments (dental)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd001', '00000000-0000-0000-0000-0000000v0001', 'طب أسنان عام',     'General Dentistry',  10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd002', '00000000-0000-0000-0000-0000000v0001', 'تقويم الأسنان',     'Orthodontics',       20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd003', '00000000-0000-0000-0000-0000000v0001', 'جراحة الفم',        'Oral Surgery',       30, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd004', '00000000-0000-0000-0000-0000000v0001', 'تبييض وتجميل',      'Cosmetic Dentistry', 40, NOW(), NOW());

-- Seed departments (cosmetic)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd011', '00000000-0000-0000-0000-0000000v0002', 'العناية بالبشرة',  'Skincare',           10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd012', '00000000-0000-0000-0000-0000000v0002', 'حقن تجميلية',       'Injectables',        20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd013', '00000000-0000-0000-0000-0000000v0002', 'ليزر',              'Laser',              30, NOW(), NOW());

-- Seed departments (dermatology)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd021', '00000000-0000-0000-0000-0000000v0003', 'أمراض جلدية',       'Dermatology',        10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd022', '00000000-0000-0000-0000-0000000v0003', 'تجميل جلدي',        'Cosmetic Derm',      20, NOW(), NOW());

-- Seed departments (physiotherapy)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd031', '00000000-0000-0000-0000-0000000v0004', 'علاج طبيعي',        'Physical Therapy',   10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd032', '00000000-0000-0000-0000-0000000v0004', 'إعادة تأهيل',       'Rehabilitation',     20, NOW(), NOW());

-- Seed departments (family-consulting)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd041', '00000000-0000-0000-0000-0000000v0005', 'استشارات زوجية',    'Marriage Counseling', 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd042', '00000000-0000-0000-0000-0000000v0005', 'تربية الأبناء',     'Parenting',          20, NOW(), NOW());

-- Seed departments (psychology)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd051', '00000000-0000-0000-0000-0000000v0006', 'علاج نفسي فردي',    'Individual Therapy', 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd052', '00000000-0000-0000-0000-0000000v0006', 'علاج أسري',         'Family Therapy',     20, NOW(), NOW());

-- Seed departments (nutrition)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd061', '00000000-0000-0000-0000-0000000v0007', 'تغذية علاجية',      'Clinical Nutrition', 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd062', '00000000-0000-0000-0000-0000000v0007', 'تغذية رياضية',      'Sports Nutrition',   20, NOW(), NOW());

-- Seed departments (barbershop)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd071', '00000000-0000-0000-0000-0000000v0008', 'حلاقة',             'Haircut',            10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd072', '00000000-0000-0000-0000-0000000v0008', 'لحية',              'Beard',              20, NOW(), NOW());

-- Seed departments (beauty-salon)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd081', '00000000-0000-0000-0000-0000000v0009', 'شعر',               'Hair',               10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd082', '00000000-0000-0000-0000-0000000v0009', 'مكياج',             'Makeup',             20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd083', '00000000-0000-0000-0000-0000000v0009', 'بشرة',              'Skin',               30, NOW(), NOW());

-- Seed departments (spa)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd091', '00000000-0000-0000-0000-0000000v0010', 'مساج',              'Massage',            10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd092', '00000000-0000-0000-0000-0000000v0010', 'علاجات الوجه',      'Facials',            20, NOW(), NOW());

-- Seed departments (nails)
INSERT INTO "VerticalSeedDepartment" (id, "verticalId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vd101', '00000000-0000-0000-0000-0000000v0011', 'مانيكير',           'Manicure',           10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vd102', '00000000-0000-0000-0000-0000000v0011', 'باديكير',           'Pedicure',           20, NOW(), NOW());

-- Seed service categories (one representative row per department — expand as needed per vertical)
INSERT INTO "VerticalSeedServiceCategory" (id, "verticalId", "departmentId", "nameAr", "nameEn", "sortOrder", "createdAt", "updatedAt") VALUES
  ('00000000-0000-0000-0000-0000000vc001', '00000000-0000-0000-0000-0000000v0001', '00000000-0000-0000-0000-0000000vd001', 'كشف عام',          'General Exam',       10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc002', '00000000-0000-0000-0000-0000000v0001', '00000000-0000-0000-0000-0000000vd001', 'حشوات',             'Fillings',           20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc003', '00000000-0000-0000-0000-0000000v0001', '00000000-0000-0000-0000-0000000vd002', 'تقويم معدني',       'Metal Braces',       10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc004', '00000000-0000-0000-0000-0000000v0001', '00000000-0000-0000-0000-0000000vd004', 'تبييض',             'Whitening',          10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc011', '00000000-0000-0000-0000-0000000v0002', '00000000-0000-0000-0000-0000000vd012', 'بوتكس',             'Botox',              10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc012', '00000000-0000-0000-0000-0000000v0002', '00000000-0000-0000-0000-0000000vd012', 'فيلر',              'Filler',             20, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc013', '00000000-0000-0000-0000-0000000v0002', '00000000-0000-0000-0000-0000000vd013', 'إزالة شعر بالليزر',  'Laser Hair Removal', 10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc071', '00000000-0000-0000-0000-0000000v0008', '00000000-0000-0000-0000-0000000vd071', 'قصة كلاسيكية',      'Classic Haircut',    10, NOW(), NOW()),
  ('00000000-0000-0000-0000-0000000vc072', '00000000-0000-0000-0000-0000000v0008', '00000000-0000-0000-0000-0000000vd072', 'تشذيب لحية',        'Beard Trim',         10, NOW(), NOW());

-- Backfill default organization to dental vertical
UPDATE "Organization"
SET "verticalId" = '00000000-0000-0000-0000-0000000v0001'
WHERE id = '00000000-0000-0000-0000-000000000001';
```

- [ ] **Step 4.4: Apply seed migration**

```bash
cd apps/backend && npx prisma migrate deploy
```

- [ ] **Step 4.5: Verify**

```bash
cd apps/backend && npx prisma studio &
# Or via psql:
psql $DATABASE_URL -c 'SELECT slug, "templateFamily" FROM "Vertical" ORDER BY "sortOrder";'
```

Expected: 11 rows.

- [ ] **Step 4.6: Commit**

```bash
git add apps/backend/prisma/schema/platform.prisma apps/backend/prisma/migrations/
git commit -m "feat(saas-03): schema + seed data for verticals system"
```

---

## Task 5 — SuperAdminGuard stub

- [ ] **Step 5.1: TDD — write failing test**

`apps/backend/src/common/guards/super-admin.guard.spec.ts`:

```ts
import { ExecutionContext } from '@nestjs/common';
import { SuperAdminGuard } from './super-admin.guard';

describe('SuperAdminGuard', () => {
  const guard = new SuperAdminGuard();
  const ctx = (user: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) } as ExecutionContext);

  it('allows when user.isSuperAdmin is true', () => {
    expect(guard.canActivate(ctx({ id: 'u1', isSuperAdmin: true }))).toBe(true);
  });

  it('denies when user.isSuperAdmin is false', () => {
    expect(() => guard.canActivate(ctx({ id: 'u1', isSuperAdmin: false }))).toThrow();
  });

  it('denies when no user on request', () => {
    expect(() => guard.canActivate(ctx(undefined))).toThrow();
  });
});
```

Run:

```bash
cd apps/backend && npx jest common/guards/super-admin.guard --no-coverage
```

Expected: fails (module not found).

- [ ] **Step 5.2: Implement**

`apps/backend/src/common/guards/super-admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/**
 * Stub super-admin guard. Plan 05b replaces this with the full super-admin
 * auth flow. Today it simply checks the `isSuperAdmin` JWT claim propagated
 * by Plan 01's JwtStrategy.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: { isSuperAdmin?: boolean } }>();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Super-admin access required');
    }
    return true;
  }
}
```

Run test — expect pass.

- [ ] **Step 5.3: Commit**

```bash
git add apps/backend/src/common/guards/super-admin.guard.ts apps/backend/src/common/guards/super-admin.guard.spec.ts
git commit -m "feat(saas-03): stub SuperAdminGuard (full impl in plan 05b)"
```

---

## Task 6 — `list-verticals.handler`

- [ ] **Step 6.1: TDD — failing test**

`apps/backend/src/modules/platform/verticals/list-verticals/list-verticals.handler.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ListVerticalsHandler } from './list-verticals.handler';

describe('ListVerticalsHandler', () => {
  let handler: ListVerticalsHandler;
  const prisma = {
    vertical: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ListVerticalsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = moduleRef.get(ListVerticalsHandler);
    jest.clearAllMocks();
  });

  it('filters to isActive=true by default and orders by sortOrder', async () => {
    prisma.vertical.findMany.mockResolvedValue([]);
    await handler.execute({});
    expect(prisma.vertical.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  });

  it('returns all when includeInactive=true', async () => {
    prisma.vertical.findMany.mockResolvedValue([]);
    await handler.execute({ includeInactive: true });
    expect(prisma.vertical.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  });

  it('filters by templateFamily when provided', async () => {
    prisma.vertical.findMany.mockResolvedValue([]);
    await handler.execute({ templateFamily: 'MEDICAL' });
    expect(prisma.vertical.findMany).toHaveBeenCalledWith({
      where: { isActive: true, templateFamily: 'MEDICAL' },
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  });
});
```

Run:

```bash
cd apps/backend && npx jest modules/platform/verticals/list-verticals --no-coverage
```

Expected: fails.

- [ ] **Step 6.2: Implement**

`apps/backend/src/modules/platform/verticals/list-verticals/list-verticals.handler.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { TemplateFamily } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface ListVerticalsQuery {
  includeInactive?: boolean;
  templateFamily?: TemplateFamily;
}

@Injectable()
export class ListVerticalsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListVerticalsQuery) {
    const where: Record<string, unknown> = {};
    if (!query.includeInactive) where.isActive = true;
    if (query.templateFamily) where.templateFamily = query.templateFamily;
    return this.prisma.vertical.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { nameAr: 'asc' }],
    });
  }
}
```

Run tests — expect pass.

- [ ] **Step 6.3: Commit**

```bash
git add apps/backend/src/modules/platform/verticals/list-verticals/
git commit -m "feat(saas-03): add ListVerticalsHandler"
```

---

## Task 7 — `get-vertical.handler`

- [ ] **Step 7.1: TDD**

`get-vertical.handler.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { GetVerticalHandler } from './get-vertical.handler';

describe('GetVerticalHandler', () => {
  let handler: GetVerticalHandler;
  const prisma = { vertical: { findFirst: jest.fn() } };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [GetVerticalHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = mod.get(GetVerticalHandler);
    jest.clearAllMocks();
  });

  it('looks up by id or slug', async () => {
    prisma.vertical.findFirst.mockResolvedValue({ id: 'v', slug: 'dental' });
    await handler.execute({ idOrSlug: 'dental' });
    expect(prisma.vertical.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: 'dental' }, { slug: 'dental' }] },
      include: { seedDepartments: true, seedServiceCategories: true, terminologyOverrides: true },
    });
  });

  it('throws 404 if not found', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ idOrSlug: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 7.2: Implement**

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface GetVerticalQuery {
  idOrSlug: string;
}

@Injectable()
export class GetVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ idOrSlug }: GetVerticalQuery) {
    const row = await this.prisma.vertical.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        seedDepartments: true,
        seedServiceCategories: true,
        terminologyOverrides: true,
      },
    });
    if (!row) throw new NotFoundException(`Vertical not found: ${idOrSlug}`);
    return row;
  }
}
```

- [ ] **Step 7.3: Commit**

```bash
git add apps/backend/src/modules/platform/verticals/get-vertical/
git commit -m "feat(saas-03): add GetVerticalHandler"
```

---

## Task 8 — `terminology.loader` + `get-terminology.handler`

- [ ] **Step 8.1: Loader**

`apps/backend/src/modules/platform/verticals/terminology.loader.ts`:

```ts
import { Injectable } from '@nestjs/common';
import {
  BASE_PACKS,
  TemplateFamily,
  TerminologyPack,
  mergeOverrides,
} from '@carekit/shared';

@Injectable()
export class TerminologyLoader {
  getBase(family: TemplateFamily): TerminologyPack {
    return BASE_PACKS[family];
  }

  merge(
    family: TemplateFamily,
    overrides: Array<{ tokenKey: string; valueAr: string; valueEn: string }>,
  ): TerminologyPack {
    return mergeOverrides(this.getBase(family), overrides);
  }
}
```

- [ ] **Step 8.2: TDD handler**

`get-terminology.handler.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TerminologyLoader } from '../terminology.loader';
import { GetTerminologyHandler } from './get-terminology.handler';

describe('GetTerminologyHandler', () => {
  let handler: GetTerminologyHandler;
  const prisma = { vertical: { findFirst: jest.fn() } };
  const loader = new TerminologyLoader();

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        GetTerminologyHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: TerminologyLoader, useValue: loader },
      ],
    }).compile();
    handler = mod.get(GetTerminologyHandler);
    jest.clearAllMocks();
  });

  it('returns base pack when no overrides exist', async () => {
    prisma.vertical.findFirst.mockResolvedValue({
      id: 'v', slug: 'dental', templateFamily: 'MEDICAL', terminologyOverrides: [],
    });
    const pack = await handler.execute({ verticalSlug: 'dental' });
    expect(pack['employee.singular']).toEqual({ ar: 'طبيب', en: 'Doctor' });
  });

  it('applies overrides on top of base pack', async () => {
    prisma.vertical.findFirst.mockResolvedValue({
      id: 'v', slug: 'dental', templateFamily: 'MEDICAL',
      terminologyOverrides: [{ tokenKey: 'employee.singular', valueAr: 'استشاري', valueEn: 'Specialist' }],
    });
    const pack = await handler.execute({ verticalSlug: 'dental' });
    expect(pack['employee.singular']).toEqual({ ar: 'استشاري', en: 'Specialist' });
    expect(pack['client.singular']).toEqual({ ar: 'مريض', en: 'Patient' });
  });

  it('throws 404 when vertical missing', async () => {
    prisma.vertical.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ verticalSlug: 'nope' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 8.3: Implement**

`get-terminology.handler.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { TerminologyPack } from '@carekit/shared';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TerminologyLoader } from '../terminology.loader';

export interface GetTerminologyQuery {
  verticalSlug: string;
}

@Injectable()
export class GetTerminologyHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loader: TerminologyLoader,
  ) {}

  async execute({ verticalSlug }: GetTerminologyQuery): Promise<TerminologyPack> {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug: verticalSlug, isActive: true },
      include: { terminologyOverrides: true },
    });
    if (!vertical) throw new NotFoundException(`Vertical not found: ${verticalSlug}`);
    return this.loader.merge(vertical.templateFamily, vertical.terminologyOverrides);
  }
}
```

Run tests — pass.

- [ ] **Step 8.4: Commit**

```bash
git add apps/backend/src/modules/platform/verticals/terminology.loader.ts \
        apps/backend/src/modules/platform/verticals/get-terminology/
git commit -m "feat(saas-03): terminology loader + GetTerminologyHandler"
```

---

## Task 9 — `seed-organization-from-vertical.handler`

This handler copies `VerticalSeedDepartment` + `VerticalSeedServiceCategory` rows into the tenant's `Department` + `ServiceCategory` tables. **Scoped models are touched inside a `$transaction` callback — explicit `organizationId` required on every `tx.*.create()` (Lesson 11).**

- [ ] **Step 9.1: TDD**

`seed-organization-from-vertical.handler.spec.ts` (abbreviated — full test uses in-memory Prisma mock):

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant';
import { SeedOrganizationFromVerticalHandler } from './seed-organization-from-vertical.handler';

describe('SeedOrganizationFromVerticalHandler', () => {
  let handler: SeedOrganizationFromVerticalHandler;
  const mockTx = {
    department: { create: jest.fn() },
    serviceCategory: { create: jest.fn() },
  };
  const prisma = {
    vertical: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  };
  const tenant = { requireOrganizationId: () => 'org-1' } as unknown as TenantContextService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        SeedOrganizationFromVerticalHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();
    handler = mod.get(SeedOrganizationFromVerticalHandler);
    jest.clearAllMocks();
  });

  it('creates Department rows with explicit organizationId', async () => {
    prisma.vertical.findFirst.mockResolvedValue({
      id: 'v1', templateFamily: 'MEDICAL',
      seedDepartments: [{ id: 'sd1', nameAr: 'د', nameEn: 'D', sortOrder: 0 }],
      seedServiceCategories: [],
    });
    mockTx.department.create.mockResolvedValue({ id: 'new-dept' });
    await handler.execute({ verticalId: 'v1' });
    expect(mockTx.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-1', nameAr: 'د', nameEn: 'D' }),
    });
  });

  it('creates ServiceCategory rows with organizationId and maps departmentId', async () => {
    prisma.vertical.findFirst.mockResolvedValue({
      id: 'v1', templateFamily: 'MEDICAL',
      seedDepartments: [{ id: 'sd1', nameAr: 'د', nameEn: 'D', sortOrder: 0 }],
      seedServiceCategories: [{ id: 'sc1', departmentId: 'sd1', nameAr: 'ك', nameEn: 'C', sortOrder: 0 }],
    });
    mockTx.department.create.mockResolvedValue({ id: 'new-dept' });
    mockTx.serviceCategory.create.mockResolvedValue({ id: 'new-cat' });
    await handler.execute({ verticalId: 'v1' });
    expect(mockTx.serviceCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        departmentId: 'new-dept',
        nameAr: 'ك',
      }),
    });
  });
});
```

- [ ] **Step 9.2: Implement**

`seed-organization-from-vertical.handler.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { TenantContextService } from '../../../../common/tenant';

export interface SeedOrganizationFromVerticalCommand {
  verticalId: string;
}

@Injectable()
export class SeedOrganizationFromVerticalHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute({ verticalId }: SeedOrganizationFromVerticalCommand) {
    const organizationId = this.tenant.requireOrganizationId();

    const vertical = await this.prisma.vertical.findFirst({
      where: { id: verticalId, isActive: true },
      include: { seedDepartments: true, seedServiceCategories: true },
    });
    if (!vertical) throw new NotFoundException(`Vertical not found: ${verticalId}`);

    // Map seed department id → newly created tenant department id
    const deptIdMap = new Map<string, string>();

    await this.prisma.$transaction(async (tx) => {
      // Lesson 11: tx bypasses Proxy — every create must pass organizationId explicitly.
      for (const sd of vertical.seedDepartments.sort((a, b) => a.sortOrder - b.sortOrder)) {
        const created = await tx.department.create({
          data: {
            organizationId,
            nameAr: sd.nameAr,
            nameEn: sd.nameEn,
            sortOrder: sd.sortOrder,
          },
        });
        deptIdMap.set(sd.id, created.id);
      }

      for (const sc of vertical.seedServiceCategories.sort((a, b) => a.sortOrder - b.sortOrder)) {
        await tx.serviceCategory.create({
          data: {
            organizationId,
            departmentId: sc.departmentId ? deptIdMap.get(sc.departmentId) ?? null : null,
            nameAr: sc.nameAr,
            nameEn: sc.nameEn,
            sortOrder: sc.sortOrder,
          },
        });
      }
    });

    return {
      verticalId,
      organizationId,
      departmentsCreated: deptIdMap.size,
      categoriesCreated: vertical.seedServiceCategories.length,
    };
  }
}
```

- [ ] **Step 9.3: Run unit tests — expect pass**

- [ ] **Step 9.4: Commit**

```bash
git add apps/backend/src/modules/platform/verticals/seed-organization-from-vertical/
git commit -m "feat(saas-03): seed org departments + categories from vertical"
```

---

## Task 10 — Super-admin CRUD handlers

Each follows the same pattern: DTO + handler + spec. Abbreviated here — write full specs following Tasks 6–9 structure.

- [ ] **Step 10.1: `create-vertical.handler` + spec**

DTO:

```ts
// dto/create-vertical.dto.ts
import { IsEnum, IsOptional, IsString, IsBoolean, IsInt, Matches } from 'class-validator';
import { TemplateFamily } from '@prisma/client';

export class CreateVerticalDto {
  @Matches(/^[a-z][a-z0-9-]{1,40}$/)
  slug!: string;

  @IsString() nameAr!: string;
  @IsString() nameEn!: string;
  @IsEnum(TemplateFamily) templateFamily!: TemplateFamily;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsString() iconUrl?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
```

Handler: `prisma.vertical.create({ data: dto })`. Conflict (duplicate slug) → `ConflictException`.

- [ ] **Step 10.2: `update-vertical.handler` + spec**

Partial DTO; `prisma.vertical.update({ where: { id }, data })`. 404 if missing.

- [ ] **Step 10.3: `upsert-vertical-seed.handler` + spec**

DTO accepts a `departments: Array<{ nameAr, nameEn, sortOrder }>` + `categories: Array<{ nameAr, nameEn, sortOrder, departmentNameAr? }>`. Handler replaces seeds inside a transaction: `tx.verticalSeedServiceCategory.deleteMany({ where: { verticalId } })` → `tx.verticalSeedDepartment.deleteMany(...)` → recreate.

- [ ] **Step 10.4: `upsert-terminology-override.handler` + spec**

DTO: `{ tokenKey: TerminologyKey, valueAr, valueEn }`. Handler: `prisma.verticalTerminologyOverride.upsert({ where: { verticalId_tokenKey: {...} }, update, create })`. Validate `tokenKey` is in `TERMINOLOGY_KEYS`.

- [ ] **Step 10.5: Commit each handler separately**

```bash
git add apps/backend/src/modules/platform/verticals/create-vertical/
git commit -m "feat(saas-03): CreateVerticalHandler (super-admin)"
git add apps/backend/src/modules/platform/verticals/update-vertical/
git commit -m "feat(saas-03): UpdateVerticalHandler (super-admin)"
git add apps/backend/src/modules/platform/verticals/upsert-vertical-seed/
git commit -m "feat(saas-03): UpsertVerticalSeedHandler (super-admin)"
git add apps/backend/src/modules/platform/verticals/upsert-terminology-override/
git commit -m "feat(saas-03): UpsertTerminologyOverrideHandler (super-admin)"
```

---

## Task 11 — Module wiring

- [ ] **Step 11.1: Write `verticals.module.ts`**

```ts
import { Module } from '@nestjs/common';
import { TenantModule } from '../../../common/tenant/tenant.module';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { ListVerticalsHandler } from './list-verticals/list-verticals.handler';
import { GetVerticalHandler } from './get-vertical/get-vertical.handler';
import { GetTerminologyHandler } from './get-terminology/get-terminology.handler';
import { SeedOrganizationFromVerticalHandler } from './seed-organization-from-vertical/seed-organization-from-vertical.handler';
import { CreateVerticalHandler } from './create-vertical/create-vertical.handler';
import { UpdateVerticalHandler } from './update-vertical/update-vertical.handler';
import { UpsertVerticalSeedHandler } from './upsert-vertical-seed/upsert-vertical-seed.handler';
import { UpsertTerminologyOverrideHandler } from './upsert-terminology-override/upsert-terminology-override.handler';
import { TerminologyLoader } from './terminology.loader';

@Module({
  imports: [DatabaseModule, TenantModule],
  providers: [
    TerminologyLoader,
    ListVerticalsHandler,
    GetVerticalHandler,
    GetTerminologyHandler,
    SeedOrganizationFromVerticalHandler,
    CreateVerticalHandler,
    UpdateVerticalHandler,
    UpsertVerticalSeedHandler,
    UpsertTerminologyOverrideHandler,
  ],
  exports: [
    ListVerticalsHandler,
    GetVerticalHandler,
    GetTerminologyHandler,
    SeedOrganizationFromVerticalHandler,
    CreateVerticalHandler,
    UpdateVerticalHandler,
    UpsertVerticalSeedHandler,
    UpsertTerminologyOverrideHandler,
    TerminologyLoader,
  ],
})
export class VerticalsModule {}
```

- [ ] **Step 11.2: Register in platform module or app.module.ts**

```bash
grep -n "PlatformModule\|VerticalsModule" apps/backend/src/app.module.ts apps/backend/src/modules/platform/*.module.ts
```

If `PlatformModule` exists — add `VerticalsModule` to its `imports`. Otherwise add to `app.module.ts` directly.

- [ ] **Step 11.3: Commit**

```bash
git add apps/backend/src/modules/platform/verticals/verticals.module.ts apps/backend/src/app.module.ts
git commit -m "feat(saas-03): register VerticalsModule"
```

---

## Task 12 — Controllers

- [ ] **Step 12.1: Public controller**

`apps/backend/src/api/public/verticals.controller.ts`:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TemplateFamily } from '@prisma/client';
import { ListVerticalsHandler } from '../../modules/platform/verticals/list-verticals/list-verticals.handler';
import { GetVerticalHandler } from '../../modules/platform/verticals/get-vertical/get-vertical.handler';
import { GetTerminologyHandler } from '../../modules/platform/verticals/get-terminology/get-terminology.handler';
import { ApiStandardResponses } from '../../common/swagger';

@ApiTags('Public / Platform')
@Controller('public/verticals')
export class VerticalsController {
  constructor(
    private readonly list: ListVerticalsHandler,
    private readonly get: GetVerticalHandler,
    private readonly terminology: GetTerminologyHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active verticals' })
  @ApiQuery({ name: 'templateFamily', required: false, enum: TemplateFamily })
  @ApiStandardResponses()
  index(@Query('templateFamily') templateFamily?: TemplateFamily) {
    return this.list.execute({ templateFamily });
  }

  @Get(':idOrSlug')
  @ApiOperation({ summary: 'Get vertical with seed data' })
  @ApiParam({ name: 'idOrSlug' })
  @ApiStandardResponses()
  show(@Param('idOrSlug') idOrSlug: string) {
    return this.get.execute({ idOrSlug });
  }

  @Get(':slug/terminology')
  @ApiOperation({ summary: 'Get merged terminology pack for a vertical' })
  @ApiParam({ name: 'slug' })
  @ApiStandardResponses()
  getTerminology(@Param('slug') slug: string) {
    return this.terminology.execute({ verticalSlug: slug });
  }
}
```

- [ ] **Step 12.2: Super-admin controller**

`apps/backend/src/api/dashboard/super-admin-verticals.controller.ts`:

```ts
import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CreateVerticalDto } from '../../modules/platform/verticals/dto/create-vertical.dto';
import { CreateVerticalHandler } from '../../modules/platform/verticals/create-vertical/create-vertical.handler';
import { UpdateVerticalHandler } from '../../modules/platform/verticals/update-vertical/update-vertical.handler';
import { UpsertVerticalSeedHandler } from '../../modules/platform/verticals/upsert-vertical-seed/upsert-vertical-seed.handler';
import { UpsertTerminologyOverrideHandler } from '../../modules/platform/verticals/upsert-terminology-override/upsert-terminology-override.handler';
import { UpsertVerticalSeedDto } from '../../modules/platform/verticals/dto/upsert-vertical-seed.dto';
import { UpsertTerminologyOverrideDto } from '../../modules/platform/verticals/dto/upsert-terminology-override.dto';
import { ApiStandardResponses } from '../../common/swagger';

@ApiTags('Dashboard / Platform (Super-Admin)')
@ApiBearerAuth()
@UseGuards(JwtGuard, SuperAdminGuard)
@Controller('dashboard/admin/verticals')
export class SuperAdminVerticalsController {
  constructor(
    private readonly create: CreateVerticalHandler,
    private readonly update: UpdateVerticalHandler,
    private readonly upsertSeed: UpsertVerticalSeedHandler,
    private readonly upsertTerm: UpsertTerminologyOverrideHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a vertical' })
  @ApiStandardResponses()
  createVertical(@Body() dto: CreateVerticalDto) {
    return this.create.execute(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vertical' })
  @ApiStandardResponses()
  updateVertical(@Param('id') id: string, @Body() dto: Partial<CreateVerticalDto>) {
    return this.update.execute({ id, patch: dto });
  }

  @Post(':id/seed')
  @ApiOperation({ summary: 'Replace vertical seed departments + categories' })
  @ApiStandardResponses()
  upsertSeedData(@Param('id') id: string, @Body() dto: UpsertVerticalSeedDto) {
    return this.upsertSeed.execute({ verticalId: id, ...dto });
  }

  @Post(':id/terminology')
  @ApiOperation({ summary: 'Upsert a terminology override' })
  @ApiStandardResponses()
  upsertTerminology(@Param('id') id: string, @Body() dto: UpsertTerminologyOverrideDto) {
    return this.upsertTerm.execute({ verticalId: id, ...dto });
  }
}
```

- [ ] **Step 12.3: Register controllers**

Add `VerticalsController` to `src/api/public/public.module.ts` `controllers` array, and `SuperAdminVerticalsController` to `src/api/dashboard/dashboard.module.ts`. Both modules import `VerticalsModule`.

- [ ] **Step 12.4: Regenerate OpenAPI snapshot**

```bash
cd apps/backend && npm run openapi:build-and-snapshot
```

- [ ] **Step 12.5: Commit**

```bash
git add apps/backend/src/api/public/verticals.controller.ts \
        apps/backend/src/api/dashboard/super-admin-verticals.controller.ts \
        apps/backend/src/api/public/public.module.ts \
        apps/backend/src/api/dashboard/dashboard.module.ts \
        apps/backend/openapi.json
git commit -m "feat(saas-03): HTTP surface for verticals (public + super-admin)"
```

---

## Task 13 — Dashboard `useTerminology()` hook

- [ ] **Step 13.1: Types**

Assume the dashboard session already exposes `organization: { vertical?: { templateFamily: TemplateFamily, slug: string, terminologyOverrides?: [...] } | null }` — Plan 07 guarantees this. For this plan we accept it may be `null` and fall back to MEDICAL.

- [ ] **Step 13.2: Implement hook**

`apps/dashboard/hooks/use-terminology.ts`:

```ts
'use client';

import { useMemo } from 'react';
import {
  BASE_PACKS,
  TemplateFamily,
  TerminologyKey,
  TerminologyPack,
  mergeOverrides,
} from '@carekit/shared';
import { useSession } from './use-session';

export interface UseTerminologyResult {
  pack: TerminologyPack;
  t: (key: TerminologyKey, locale?: 'ar' | 'en') => string;
}

export function useTerminology(): UseTerminologyResult {
  const { session } = useSession();
  const vertical = session?.organization?.vertical ?? null;

  const pack = useMemo<TerminologyPack>(() => {
    const family: TemplateFamily = vertical?.templateFamily ?? 'MEDICAL';
    const overrides = vertical?.terminologyOverrides ?? [];
    return mergeOverrides(BASE_PACKS[family], overrides);
  }, [vertical]);

  const locale = session?.locale ?? 'ar';

  return {
    pack,
    t: (key, loc = locale) => pack[key]?.[loc] ?? key,
  };
}
```

- [ ] **Step 13.3: Test**

`apps/dashboard/hooks/use-terminology.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react';
import { useTerminology } from './use-terminology';

jest.mock('./use-session', () => ({
  useSession: () => ({
    session: {
      locale: 'ar',
      organization: {
        vertical: { slug: 'dental', templateFamily: 'MEDICAL', terminologyOverrides: [] },
      },
    },
  }),
}));

describe('useTerminology', () => {
  it('returns Arabic value for medical employee.singular', () => {
    const { result } = renderHook(() => useTerminology());
    expect(result.current.t('employee.singular')).toBe('طبيب');
  });

  it('returns English value when locale=en', () => {
    const { result } = renderHook(() => useTerminology());
    expect(result.current.t('employee.singular', 'en')).toBe('Doctor');
  });
});
```

Run:

```bash
cd apps/dashboard && npm run test -- use-terminology
```

- [ ] **Step 13.4: Commit**

```bash
git add apps/dashboard/hooks/use-terminology.ts apps/dashboard/hooks/use-terminology.test.tsx
git commit -m "feat(saas-03): dashboard useTerminology hook"
```

---

## Task 14 — Backend e2e tests

- [ ] **Step 14.1: `verticals-public.e2e-spec.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';

describe('Public verticals endpoints (saas-03)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());

  it('GET /public/verticals returns 11 seeded verticals', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/public/verticals').expect(200);
    expect(res.body.length).toBe(11);
    expect(res.body.map((v: { slug: string }) => v.slug)).toEqual(
      expect.arrayContaining(['dental', 'cosmetic', 'barbershop', 'spa']),
    );
  });

  it('GET /public/verticals/dental returns seed departments', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/public/verticals/dental').expect(200);
    expect(res.body.slug).toBe('dental');
    expect(res.body.seedDepartments.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /public/verticals/dental/terminology returns merged pack', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/verticals/dental/terminology')
      .expect(200);
    expect(res.body['employee.singular']).toEqual({ ar: 'طبيب', en: 'Doctor' });
  });

  it('GET /public/verticals/barbershop/terminology returns SALON pack', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/public/verticals/barbershop/terminology')
      .expect(200);
    expect(res.body['employee.singular']).toEqual({ ar: 'مصفف', en: 'Stylist' });
  });
});
```

- [ ] **Step 14.2: `terminology-merge.e2e-spec.ts`**

Insert a `VerticalTerminologyOverride` row, GET the pack, assert the override wins; delete the row.

- [ ] **Step 14.3: `seed-organization-from-vertical.e2e-spec.ts`**

Create two orgs A and B, run seed handler under ORG_A context, verify ORG_B has no departments, verify ORG_A has exactly the dental seed departments + categories.

- [ ] **Step 14.4: Run**

```bash
cd apps/backend && npm run test:e2e -- platform
```

Expected: all pass.

- [ ] **Step 14.5: Commit**

```bash
git add apps/backend/test/e2e/platform/
git commit -m "test(saas-03): e2e specs for vertical listing + terminology + seeding"
```

---

## Task 15 — Final verification + PR

- [ ] **Step 15.1: Full unit suite**

```bash
cd apps/backend && npm run test
```

Expected: baseline (953 post-02d) + new tests, all passing.

- [ ] **Step 15.2: Full e2e**

```bash
cd apps/backend && npm run test:e2e
```

- [ ] **Step 15.3: Typecheck**

```bash
cd apps/backend && npm run typecheck
cd apps/dashboard && npm run typecheck
cd packages/shared && npm run typecheck
```

- [ ] **Step 15.4: Update backend CLAUDE.md**

In the "Conventions" bullet list, add:

> - **Verticals (SaaS-03).** Each org has a `Vertical`. Use `useTerminology()` in the dashboard and `GetTerminologyHandler` in the backend — never hardcode role/service/client nouns. See `src/modules/platform/verticals/`.

- [ ] **Step 15.5: Update memory**

Write `memory/saas03_status.md`:

```
---
name: SaaS-03 status
description: Plan 03 (verticals system) — status
type: project
---
**Status:** Delivered <date> in PR #<n>. 11 verticals seeded across 4 template families. Default org backfilled to dental.

**Deliverables:** Vertical + 3 seed/override models; platform/verticals module (8 handlers); public + super-admin controllers; 4 terminology JSON packs in @carekit/shared; useTerminology() hook; 3 e2e specs; SuperAdminGuard stub (Plan 05b replaces).

**No SCOPED_MODELS changes.** Vertical tables are platform-level.

**Next:** Plan 04 (billing) and Plan 05b (super-admin) both depend on this.
```

- [ ] **Step 15.6: Open PR**

```bash
gh pr create \
  --base main \
  --head feat/saas-03-verticals-system \
  --title "feat(saas-03): verticals system" \
  --body "Adds Vertical primitive + 11 seeded verticals + 4 terminology packs + useTerminology() hook."
```

---

## Amendments applied during execution

> Empty until execution. Record any divergence here with root cause + resolution.
