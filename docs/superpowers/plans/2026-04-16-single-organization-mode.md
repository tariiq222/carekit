# Single-Organization Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert CareKit from multi-tenant SaaS to single-organization deployment by deleting all `tenantId` plumbing across backend, dashboard, mobile, packages, tests, and docs — producing a clean system where each deployment serves one organization with multiple physical branches.

**Architecture:** Modular Monolith + Vertical Slices stays intact. We delete the tenant isolation layer (middleware, decorator, `tenantId` columns, `X-Tenant-ID` header) and convert per-tenant singleton tables (`BrandingConfig`, `OrganizationSettings`, `ChatbotConfig`, `ZatcaConfig`) to true singletons keyed by fixed id `"default"`. The `License` module is deleted entirely. `FeatureFlag` and `Integration` become organization-wide settings. `Branch` model (physical locations) remains untouched. Since project is still in development with no production data, we reset all 41 migrations into one clean `initial_single_organization` migration.

**Tech Stack:** NestJS 11 · Prisma 7 (PostgreSQL + pgvector) · Next.js 15 · React 19 · TanStack Query · Expo SDK 55 · Jest · Vitest · npm workspaces + Turborepo

**Product renaming note:** Throughout docs and seed data, "clinic" wording is acceptable where tied to schema field names (`clinicNameAr` stays to avoid migration churn in this phase) but user-facing copy and CLAUDE.md files shift to "organization/منظمة". Field renames are out of scope for this plan.

---

## Progress Log (Session 2026-04-16)

**Tasks completed in session 1:**
- ✅ Task 1 — backup + feature branches (commit on `backup/pre-tenant-removal` + `feat/single-organization-mode`)
- ✅ Task 2 — all 41 legacy migrations deleted (commit `2fdb874`)
- ✅ Task 3 — tenantId stripped from identity/people/bookings/finance (commit `c1f9c74`)
- ✅ Task 4 — tenantId stripped from org/comms/ai/ops/media + LicenseCache deleted (commit `1c84931` + NIT fix `c368de5`)

**Prisma client regenerated** against the new schema (`npx prisma generate`). Backend build will now FAIL with type errors in roughly 6 handlers until Tasks 9, 16, 19-23 complete. This is expected and was by design — but the plan was too optimistic about running tests between every cluster task.

## Addendum — Revisions discovered during session 1

These revisions are **mandatory** for remaining work. The original plan is kept intact below for reference, but the following adjustments take priority where they conflict.

### Revision 1 — Migration generation MUST move to after singletons

**Problem:** Original Task 5 generates the initial migration, then Tasks 20-23 change schema again (adding `id @default("default")` on BrandingConfig/OrganizationSettings/ChatbotConfig/ZatcaConfig) and regenerate the migration. This forces 4 rewrites of the same migration.

**Revised ordering:**
- **Skip Task 5 for now.** Do not run `prisma migrate dev` yet.
- Complete **Phase 4 first** (Tasks 20-23) — apply all `id @default("default")` edits to schema files first.
- **After Phase 4**, run `prisma migrate dev --name initial_single_organization` ONCE to produce a single clean migration.
- Renumber: Task 5 effectively moves to become the new Task 24-pre (executed before Phase 5 public routes).

### Revision 2 — Cluster tasks cannot run `npm run test` until enough handlers are clean

**Problem:** Original plan says every cluster task ends with `npx jest <cluster>` passing. But `@TenantId()` is still imported from the deleted-later `common/tenant/tenant.decorator.ts`, and handlers in OTHER clusters still emit type errors. So isolated cluster tests pass type-checking only if we don't do a full build — but handler.spec tests import from handlers that in turn import from other modules.

**Revised approach for Phase 3 (Tasks 9-19):**
- Do Phase 2 (Tasks 6-8) FIRST so that `@UserId` is relocated and `common/tenant/` is deleted. This forces us to fix `@TenantId()` imports everywhere.
- BUT: we cannot delete `common/tenant/` until all 172 `@TenantId()` usages are gone. So:
  - **Step 6 (relocate @UserId) runs first** — non-breaking.
  - **Step 7 (slim RequestContext + drop tenant from logs/filters/guard)** — may require touching files.
  - **Step 8 (delete tenant folder + unwire middleware)** — blocked until ALL cluster handlers are clean (Tasks 9-19 done).
- So the real order is: Task 6 → (Tasks 9-19, 20-23 in parallel sets the implementer can do) → Task 7 → Task 8.
- Or more safely: Task 6 → Tasks 9-19 → Tasks 20-23 → Tasks 7-8.

### Revision 3 — Handler cleanup scope was under-estimated

**Problem:** Code quality reviewer on Task 4 identified these handlers that break right now after `prisma generate`:
1. `apps/backend/src/modules/platform/license/validate-license.service.ts` — will be deleted in Task 19.
2. `apps/backend/src/modules/ai/chatbot-config/upsert-chatbot-config.handler.ts` — Task 22.
3. `apps/backend/src/modules/ai/chatbot-config/get-chatbot-config.handler.ts` — Task 22.
4. `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts` + `get-branding.handler.ts` — Task 20.
5. `apps/backend/src/modules/org-experience/org-settings/upsert-org-settings.handler.ts` + `get-org-settings.handler.ts` — Task 21.
6. `apps/backend/src/modules/ai/manage-knowledge-base/manage-knowledge-base.handler.ts` — Task 16.

All 6 are already scheduled for cleanup. No new tasks needed, but the implication is:
- **Do not attempt `npm run build` at backend root until all cluster + singleton tasks are done.**
- Each cluster subagent should run ONLY its cluster's tests, not a full build.
- The final E2E verification (Task 31) is the first time we expect `npm run build` to succeed.

### Revision 4 — Verification approach clarified

**Each cluster task ends with:**
- TypeScript compile check **limited to that cluster's files only**: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep "src/modules/<cluster>\|src/api/.*<cluster>"` — errors in THIS cluster's files must be zero.
- Cluster-scoped Jest run: `npx jest <cluster-path> --runInBand`.
- Commit.

**Full build (`npm run build`) is gated until after Task 23.**

### Revision 5 — Task 5 (migration) relocated

**Old position:** After Phase 1 (schema edits).
**New position:** After Phase 4 (singleton schema edits) — just before Phase 5 (public routes).
**Rationale:** Single migration file produced once, not rewritten 4 times.

---

## New Task Order

1. ✅ Task 1 (safety setup)
2. ✅ Task 2 (delete legacy migrations)
3. ✅ Task 3 (schema strip group 1)
4. ✅ Task 4 (schema strip group 2 + LicenseCache)
5. **Task 6** (relocate @UserId) ← next up
6. **Tasks 9-19** (cluster handler cleanup, in order)
7. **Tasks 20-23** (singleton schema + handler edits)
8. **Task 5** (generate single migration NOW — renamed conceptually to "Task 23b")
9. **Task 7** (slim RequestContext + logs/filters/guard)
10. **Task 8** (delete tenant folder + unwire middleware)
11. **Task 24** (public branding route)
12. **Tasks 25-26** (dashboard cleanup + browser verify)
13. **Task 27** (mobile)
14. **Task 28** (packages)
15. **Task 29** (seed rewrite)
16. **Task 30** (docs)
17. **Task 31** (E2E + QA)

Task numbers in sections below remain as written; the list above is the execution order.

---

## File Structure

### Files deleted entirely

- `apps/backend/src/common/tenant/tenant.middleware.ts`
- `apps/backend/src/common/tenant/tenant.middleware.spec.ts`
- `apps/backend/src/common/tenant/tenant.decorator.ts` (the `@TenantId()` export; `@UserId()` stays — moved to `common/auth/`)
- `apps/backend/src/common/tenant/request-context.ts` (replaced by slimmer version in `common/http/`)
- `apps/backend/src/common/tenant/request-context.spec.ts`
- `apps/backend/src/common/tenant/` folder removed
- `apps/backend/src/modules/platform/license/` entire folder (4 files: `license.types.ts`, `validate-license.service.ts`, `check-feature.handler.ts`, `check-feature.handler.spec.ts`)
- All 41 migration folders under `apps/backend/prisma/migrations/`

### Files created

- `apps/backend/src/common/http/request-context.ts` (slim replacement: `requestId`, `userId`)
- `apps/backend/src/common/auth/user-id.decorator.ts` (moved from old tenant.decorator.ts)
- `apps/backend/prisma/migrations/20260416000000_initial_single_organization/migration.sql` (generated by prisma migrate)

### Files modified (grouped by responsibility)

**Schema (11 files):**
- `apps/backend/prisma/schema/identity.prisma`
- `apps/backend/prisma/schema/people.prisma`
- `apps/backend/prisma/schema/bookings.prisma`
- `apps/backend/prisma/schema/finance.prisma`
- `apps/backend/prisma/schema/organization.prisma`
- `apps/backend/prisma/schema/comms.prisma`
- `apps/backend/prisma/schema/ai.prisma`
- `apps/backend/prisma/schema/ops.prisma`
- `apps/backend/prisma/schema/media.prisma`
- `apps/backend/prisma/schema/platform.prisma` (also deletes `LicenseCache`)
- `apps/backend/prisma/schema/main.prisma` (no changes expected)

**Backend core:**
- `apps/backend/src/app.module.ts` (remove TenantMiddleware wiring)
- `apps/backend/src/common/interceptors/logging.interceptor.ts` (drop tenant from log line)
- `apps/backend/src/common/filters/http-exception.filter.ts` (drop tenant from error context)
- `apps/backend/src/common/auth/current-user.decorator.ts` (remove `tenantId` from `CurrentUser` type)
- `apps/backend/src/common/guards/jwt.guard.ts` (stop injecting tenantId)

**Handlers & controllers:** All 28 controller files in `src/api/` (dashboard, mobile/client, mobile/employee, public) and all handlers referenced by them under `src/modules/<cluster>/<slice>/`. We process cluster-by-cluster.

**Platform module:**
- `apps/backend/src/modules/platform/platform.module.ts` (remove license providers)
- `apps/backend/src/modules/platform/platform.module.spec.ts`
- `apps/backend/src/modules/platform/feature-flags/*.handler.ts` (remove tenantId)
- `apps/backend/src/modules/platform/integrations/*.handler.ts` (remove tenantId)
- `apps/backend/src/modules/platform/problem-reports/*.handler.ts` (remove tenantId)
- `apps/backend/src/api/dashboard/platform.controller.ts`

**Singletons:**
- `apps/backend/src/modules/org-experience/branding/get-branding.handler.ts`
- `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts`
- `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`
- `apps/backend/src/modules/org-experience/org-settings/get-org-settings.handler.ts`
- `apps/backend/src/modules/org-experience/org-settings/upsert-org-settings.handler.ts`
- `apps/backend/src/modules/ai/chatbot-config/*` (whatever handlers exist)
- `apps/backend/src/modules/finance/zatca/*` (zatca config handlers)

**Seed & env:**
- `apps/backend/prisma/seed.ts`
- `apps/backend/.env.example`
- `apps/dashboard/.env.example`
- `apps/dashboard/.env` (local, remove if exists)

**Dashboard:**
- `apps/dashboard/lib/api.ts` (remove `TENANT_ID` + header)
- `apps/dashboard/lib/types/service.ts` (remove tenantId field)
- `apps/dashboard/lib/types/user.ts` (remove tenantId field)
- `apps/dashboard/lib/types/zatca.ts` (remove tenantId field)
- `apps/dashboard/lib/api/problem-reports.ts`
- `apps/dashboard/lib/api/ratings.ts`
- `apps/dashboard/lib/api/media.ts`

**Mobile:**
- `apps/mobile/services/api.ts` (or equivalent axios client — remove tenant header)
- `apps/mobile/.env.example` (if TENANT_ID present)

**Packages:**
- `packages/api-client/**` (remove any `X-Tenant-ID` injection)
- `packages/shared/**` (remove `TenantId` type if exists)

**Tests (~153 files):**
- All `*.handler.spec.ts` under `apps/backend/src/modules/`
- All `*.controller.spec.ts` under `apps/backend/src/api/`
- All `test/e2e/**/*.e2e-spec.ts` and fixtures
- All `apps/dashboard/test/unit/hooks/use-*.spec.tsx` mentioning tenantId
- `apps/backend/test/fixtures/**` (remove tenant setup)

**Docs:**
- `CLAUDE.md` (root)
- `apps/backend/CLAUDE.md` (remove "Tenant isolation is mandatory" rule)
- `apps/dashboard/CLAUDE.md`
- `apps/mobile/CLAUDE.md` (if mentions tenant)

---

## Phase Overview

Each phase ends with: backend builds, tests in scope pass, commit. Numbered tasks below belong to phases:

- **Phase 0 (Task 1):** Safety setup — backup branch + feature branch
- **Phase 1 (Tasks 2-5):** Schema reset — delete migrations, strip tenantId from 10 schemas, generate new initial migration
- **Phase 2 (Tasks 6-8):** Common layer — delete tenant middleware/decorator/context, relocate `@UserId`
- **Phase 3 (Tasks 9-19):** Cluster-by-cluster handler cleanup (11 clusters)
- **Phase 4 (Tasks 20-23):** Singleton refactoring — BrandingConfig, OrganizationSettings, ChatbotConfig, ZatcaConfig
- **Phase 5 (Task 24):** Public routes simplification
- **Phase 6 (Tasks 25-26):** Dashboard cleanup (api.ts, types, .env)
- **Phase 7 (Task 27):** Mobile cleanup
- **Phase 8 (Task 28):** Packages cleanup
- **Phase 9 (Task 29):** Seed rewrite
- **Phase 10 (Task 30):** Documentation updates
- **Phase 11 (Task 31):** End-to-end verification + Chrome DevTools MCP QA

---

## Phase 0 — Safety Setup

### Task 1: Create backup + feature branches

**Files:**
- No source files modified; git operations only

- [ ] **Step 1: Verify main is clean and up-to-date**

```bash
cd /c/pro/carekit
git status
git checkout main
git pull origin main
```

Expected: `nothing to commit, working tree clean` and `Already up to date`.

- [ ] **Step 2: Create backup branch and push it**

```bash
git checkout -b backup/pre-tenant-removal
git push -u origin backup/pre-tenant-removal
```

Expected: new remote branch created.

- [ ] **Step 3: Create working branch from main**

```bash
git checkout main
git checkout -b feat/single-organization-mode
```

Expected: `Switched to a new branch 'feat/single-organization-mode'`.

- [ ] **Step 4: Snapshot local dev DB (safety — in case we need to compare)**

```bash
docker compose -f docker/docker-compose.yml exec -T postgres pg_dump -U postgres carekit_dev > /tmp/carekit_pre_tenant_removal.sql 2>/dev/null || echo "DB not running — skipping snapshot"
```

Expected: either a dump file at `/tmp/` or the skip message if docker is down.

- [ ] **Step 5: Commit empty marker + push**

```bash
git commit --allow-empty -m "chore: start feat/single-organization-mode"
git push -u origin feat/single-organization-mode
```

Expected: branch pushed to origin.

---

## Phase 1 — Schema Reset

### Task 2: Delete all existing migrations

**Files:**
- Delete: `apps/backend/prisma/migrations/*` (41 folders + `migration_lock.toml` kept)

- [ ] **Step 1: Delete all migration folders (keep migration_lock.toml)**

```bash
cd /c/pro/carekit/apps/backend
find prisma/migrations -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
ls prisma/migrations/
```

Expected: only `migration_lock.toml` remains.

- [ ] **Step 2: Commit deletion**

```bash
git add prisma/migrations/
git commit -m "chore(backend): remove legacy migrations — reset for single-org mode"
```

Expected: 41 directories deleted in one commit.

---

### Task 3: Strip tenantId from schemas (identity, people, bookings, finance)

**Files:**
- Modify: `apps/backend/prisma/schema/identity.prisma`
- Modify: `apps/backend/prisma/schema/people.prisma`
- Modify: `apps/backend/prisma/schema/bookings.prisma`
- Modify: `apps/backend/prisma/schema/finance.prisma`

- [ ] **Step 1: Read current identity.prisma and apply edits**

Goal for each model in `identity.prisma` (`User`, `RefreshToken`, `CustomRole`, `Permission`):
- Delete line `tenantId String` (and any doc comment above it referencing tenancy).
- Delete `@@index([tenantId])`.
- Replace `@@unique([tenantId, email])` on `User` with `email String @unique` inline (move `@unique` onto the field declaration). Remove the `@@unique` line.
- Replace `@@unique([tenantId, name])` on `CustomRole` with `name String @unique` inline.
- Remove `tenantId_email` compound unique name dependencies — no action in schema (Prisma generates the name from fields).

Read the file first and apply the edits via Edit tool for each field.

```bash
cat prisma/schema/identity.prisma | head -80
```

- [ ] **Step 2: Apply equivalent edits to people.prisma**

For each model in `people.prisma` (typically `Client`, `Employee`, `EmployeeAvailability`, `EmployeeBranch`, `EmployeeService`, plus any onboarding tables):
- Delete `tenantId String` field.
- Delete any `@@index([tenantId, ...])` — keep other composite indexes intact but strip the `tenantId` prefix column (e.g., `@@index([tenantId, employeeId])` → `@@index([employeeId])`).
- Replace `@@unique([tenantId, email])` on Client with `email String? @unique` (note: Client email may be nullable — preserve nullability from original).

- [ ] **Step 3: Apply equivalent edits to bookings.prisma**

For each model in `bookings.prisma` (`Booking`, `BookingStatusLog`, `WaitlistEntry`, `GroupEnrollment`, `BookingSettings`, etc.):
- Delete `tenantId String` field.
- Delete/strip tenantId-prefixed indexes. E.g., `@@index([tenantId, employeeId, scheduledAt])` → `@@index([employeeId, scheduledAt])`.
- `BookingSettings` currently has `@@unique([tenantId, branchId])` — change to `@@unique([branchId])` (one setting row per branch is still meaningful).

- [ ] **Step 4: Apply equivalent edits to finance.prisma**

For each model (`Payment`, `Invoice`, `Coupon`, `Refund`, `ZatcaConfig`, etc.):
- Delete `tenantId String` field.
- Strip tenantId from all `@@index` and `@@unique`.
- `ZatcaConfig`: if it has `@@unique([tenantId])` or `tenantId String @unique`, replace with `id String @id @default("default")` (singleton — see Task 23). For now just remove tenantId; singleton conversion is done in Phase 4.
- `Coupon` typically has `@@unique([tenantId, code])` — change to `code String @unique`.

- [ ] **Step 5: Run prisma format to validate**

```bash
npx prisma format
```

Expected: formats cleanly, no errors printed.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema/identity.prisma prisma/schema/people.prisma prisma/schema/bookings.prisma prisma/schema/finance.prisma
git commit -m "refactor(schema): remove tenantId from identity, people, bookings, finance"
```

---

### Task 4: Strip tenantId from schemas (organization, comms, ai, ops, media, platform)

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma`
- Modify: `apps/backend/prisma/schema/comms.prisma`
- Modify: `apps/backend/prisma/schema/ai.prisma`
- Modify: `apps/backend/prisma/schema/ops.prisma`
- Modify: `apps/backend/prisma/schema/media.prisma`
- Modify: `apps/backend/prisma/schema/platform.prisma`

- [ ] **Step 1: Edit organization.prisma**

For each model (`Branch`, `Department`, `ServiceCategory`, `Service`, `ServiceDurationOption`, `ServiceBookingConfig`, `EmployeeServiceOption`, `BrandingConfig`, `OrganizationSettings`, `IntakeForm`, `IntakeSubmission`, `Rating`, `BusinessHour`, `Holiday`, etc.):
- Delete `tenantId String` field.
- Strip tenantId from every `@@index` and `@@unique`.
- For `Department`: replace `@@unique([tenantId, nameAr])` with `nameAr String @unique` on the field (move the unique to the field declaration; remove the `@@unique`).
- `BrandingConfig` + `OrganizationSettings`: remove `tenantId String @unique` entirely. Singleton conversion handled in Phase 4 — just remove tenantId here.
- `Branch`: delete `tenantId` field and `@@index([tenantId])`. Keep everything else (isMain, timezone, branch relations to BusinessHour/Holiday).

- [ ] **Step 2: Edit comms.prisma**

Models like `Notification`, `EmailTemplate`, `CommsChatMessage`:
- Delete `tenantId String` field and its indexes.
- Any `@@unique([tenantId, key])` on EmailTemplate → `key String @unique`.

- [ ] **Step 3: Edit ai.prisma**

Models like `ChatSession`, `ChatMessage`, `KnowledgeDocument`, `DocumentChunk`, `ChatbotConfig`:
- Delete `tenantId`.
- `ChatbotConfig`: remove `tenantId String @unique`. Singleton conversion later.
- `KnowledgeDocument`: if `@@unique([tenantId, key])` → `key String @unique`.
- Preserve the pgvector index on DocumentChunk (`@@index([embedding])` or raw-SQL extension).

- [ ] **Step 4: Edit ops.prisma**

Models like `ActivityLog`, `Report`:
- Delete `tenantId` and its indexes.

- [ ] **Step 5: Edit media.prisma**

`File` model:
- Delete `tenantId` and its index.

- [ ] **Step 6: Edit platform.prisma — delete LicenseCache entirely + strip tenantId from rest**

- Delete the entire `model LicenseCache { ... }` block.
- `FeatureFlag`: delete `tenantId`; change `@@unique([tenantId, key])` to `key String @unique`.
- `Integration`: delete `tenantId`; change `@@unique([tenantId, provider])` to `provider String @unique`.
- `ProblemReport`: delete `tenantId` and its index.

- [ ] **Step 7: Run prisma format**

```bash
cd /c/pro/carekit/apps/backend
npx prisma format
```

Expected: formats cleanly, no errors.

- [ ] **Step 8: Commit**

```bash
git add prisma/schema/
git commit -m "refactor(schema): remove tenantId from org/comms/ai/ops/media + delete LicenseCache"
```

---

### Task 5: Generate initial migration

**Files:**
- Create: `apps/backend/prisma/migrations/20260416000000_initial_single_organization/migration.sql` (generated)

- [ ] **Step 1: Reset local DB and generate migration**

Database must be running. If not: `npm run docker:up` at repo root.

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force --skip-seed
npx prisma migrate dev --name initial_single_organization --create-only
```

Expected: new folder under `prisma/migrations/` with timestamp-prefixed name ending `_initial_single_organization` containing `migration.sql`.

- [ ] **Step 2: Review generated SQL**

```bash
ls prisma/migrations/
cat prisma/migrations/*initial_single_organization*/migration.sql | head -80
```

Expected: SQL creates all tables with no `tenant_id` columns anywhere. Verify by greping:

```bash
grep -i "tenant" prisma/migrations/*initial_single_organization*/migration.sql
```

Expected: no output (zero matches).

- [ ] **Step 3: Apply the migration**

```bash
npx prisma migrate deploy
```

Expected: `The following migration(s) have been applied` with the new migration name.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "feat(schema): initial migration for single-organization mode"
```

---

## Phase 2 — Common Layer Cleanup

### Task 6: Move @UserId decorator out of tenant folder

**Files:**
- Create: `apps/backend/src/common/auth/user-id.decorator.ts`
- Modify: (later) callers of `@UserId()` import path

- [ ] **Step 1: Create new file with only the UserId decorator**

```typescript
// apps/backend/src/common/auth/user-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/** Injects the authenticated user's ID from req.user (populated by JwtStrategy). */
export const UserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    if (!req.user?.id) throw new Error('UserId: no authenticated user on request');
    return req.user.id;
  },
);
```

- [ ] **Step 2: Find all callers of `@UserId()` and fix imports in a sweep**

```bash
cd /c/pro/carekit/apps/backend
grep -rl "from '.*tenant/tenant.decorator'" src/ --include="*.ts"
```

For each file listed, replace imports:
- `import { TenantId, UserId } from '.../tenant/tenant.decorator';` → `import { UserId } from '.../auth/user-id.decorator';`
- `import { TenantId } from '.../tenant/tenant.decorator';` → delete the import line.
- `import { UserId } from '.../tenant/tenant.decorator';` → retarget path only.

Use Edit tool per file. The relative path will differ per file location; use the file's distance from `src/common/auth/`.

- [ ] **Step 3: Verify build still resolves (will still fail later for @TenantId usages — that's expected)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: `TenantId` usages show as unknown identifier — that's fine and tracked in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/common/auth/user-id.decorator.ts src/
git commit -m "refactor(common): relocate @UserId decorator to common/auth"
```

---

### Task 7: Replace RequestContext with slim version

**Files:**
- Create: `apps/backend/src/common/http/request-context.ts`
- Modify: `apps/backend/src/common/interceptors/logging.interceptor.ts`
- Modify: `apps/backend/src/common/filters/http-exception.filter.ts`

- [ ] **Step 1: Create slim request-context.ts**

```typescript
// apps/backend/src/common/http/request-context.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const RequestContextStorage = {
  run<T>(ctx: RequestContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  getOrThrow(): RequestContext {
    const ctx = storage.getStore();
    if (!ctx) throw new Error('RequestContext not initialized');
    return ctx;
  },
};
```

- [ ] **Step 2: Update logging.interceptor.ts — remove tenant from log**

Read `src/common/interceptors/logging.interceptor.ts`. Find the log line that reads like:

```typescript
(context ? ` tenant=${context.tenantId} reqId=${context.requestId}` : '')
```

Replace with:

```typescript
(context ? ` reqId=${context.requestId}` : '')
```

Also update the import:

```typescript
import { RequestContextStorage } from '../http/request-context';
```

- [ ] **Step 3: Update http-exception.filter.ts**

Read the file, remove any `tenantId` references from the error payload. Replace import to the new `../http/request-context`.

- [ ] **Step 4: Update jwt.guard.ts to not attach tenantId**

Read `src/common/guards/jwt.guard.ts`. Remove any code that reads `X-Tenant-ID` or attaches `tenantId` to `req.user`. The guard should only populate `id` (and whatever role/email it already handles).

- [ ] **Step 5: Update current-user.decorator.ts**

Read `src/common/auth/current-user.decorator.ts`. Remove the `tenantId: string` field from the `CurrentUser` interface.

- [ ] **Step 6: Commit**

```bash
git add src/common/http/request-context.ts src/common/interceptors/logging.interceptor.ts src/common/filters/http-exception.filter.ts src/common/guards/jwt.guard.ts src/common/auth/current-user.decorator.ts
git commit -m "refactor(common): slim request-context, drop tenantId from logs/filters/guard"
```

---

### Task 8: Delete tenant folder and unwire middleware

**Files:**
- Delete: `apps/backend/src/common/tenant/` (entire folder)
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Remove TenantMiddleware from app.module.ts**

Read `apps/backend/src/app.module.ts`. Find:

```typescript
import { TenantMiddleware } from './common/tenant/tenant.middleware';
// ...
configure(consumer: MiddlewareConsumer) {
  consumer.apply(TenantMiddleware).forRoutes('*');
}
```

Delete the import line. Delete the entire `configure()` method. Remove `implements NestModule` from class declaration if no other middleware remains. Remove `MiddlewareConsumer` import if unused.

- [ ] **Step 2: Delete the tenant folder**

```bash
cd /c/pro/carekit/apps/backend
rm -rf src/common/tenant/
ls src/common/
```

Expected: no `tenant/` subfolder.

- [ ] **Step 3: Verify no remaining imports from deleted folder**

```bash
grep -r "common/tenant" src/ --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add -A src/common/ src/app.module.ts
git commit -m "refactor(backend): delete tenant middleware + decorator + context"
```

---

## Phase 3 — Cluster-by-Cluster Handler Cleanup

Each cluster task follows the same **mechanical pattern**:

1. In every handler: remove `tenantId` from `Command` type, `where` clauses, `create.data`, `update.data`.
2. In every controller: remove `@TenantId() tenantId: string` parameter, remove `tenantId` key when calling handler.
3. In every spec: remove `tenantId` from mock fixtures and assertions.
4. Run cluster tests. Commit.

**Reference template** — applies to every handler in Phase 3:

```typescript
// BEFORE
export type CreateThingCommand = CreateThingDto & { tenantId: string };

@Injectable()
export class CreateThingHandler {
  async execute(dto: CreateThingCommand) {
    return this.prisma.thing.create({
      data: { tenantId: dto.tenantId, name: dto.name },
    });
  }
}

// AFTER
@Injectable()
export class CreateThingHandler {
  async execute(dto: CreateThingDto) {
    return this.prisma.thing.create({
      data: { name: dto.name },
    });
  }
}
```

**Controller template:**

```typescript
// BEFORE
@Post('things')
create(@TenantId() tenantId: string, @Body() body: CreateThingDto) {
  return this.createThing.execute({ tenantId, ...body });
}

// AFTER
@Post('things')
create(@Body() body: CreateThingDto) {
  return this.createThing.execute(body);
}
```

**Spec template:**

```typescript
// BEFORE
const cmd: CreateThingCommand = { tenantId: 'tenant-1', name: 'Foo' };

// AFTER
const cmd: CreateThingDto = { name: 'Foo' };
```

**List handler where clauses** — remove `tenantId: dto.tenantId` from the `where` object, keep all other filters intact.

**findUnique composite keys** — replace `findUnique({ where: { tenantId_email: { tenantId, email } } })` with `findUnique({ where: { email } })`. Same pattern for any `tenantId_name`, `tenantId_key`, `tenantId_provider`, `tenantId_code` compound keys.

---

### Task 9: Cluster — identity

**Files:**
- Modify: `apps/backend/src/modules/identity/**/*.handler.ts` + `.spec.ts`
- Modify: `apps/backend/src/api/dashboard/identity.controller.ts`
- Modify: `apps/backend/src/api/dashboard/identity.controller.spec.ts`
- Modify: `apps/backend/src/api/public/auth.controller.ts`
- Modify: `apps/backend/src/api/public/auth.controller.spec.ts`

- [ ] **Step 1: List all identity handlers + specs**

```bash
cd /c/pro/carekit/apps/backend
ls src/modules/identity/
find src/modules/identity -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply the mechanical pattern to each handler file**

For each file: open it, remove tenantId from Command type, from where/data clauses. Save.

- [ ] **Step 3: Apply pattern to identity.controller.ts (dashboard)**

Remove all `@TenantId() tenantId: string,` parameters. Remove `tenantId,` when spreading into handler.execute call.

- [ ] **Step 4: Apply pattern to public/auth.controller.ts**

Login/refresh/logout endpoints: remove `@TenantId()`. The login handler finds user by email alone now (since email is globally unique in single-org mode).

- [ ] **Step 5: Update specs — identity handlers + controllers**

Remove `tenantId` from all mock data and expectations. Remove any `it('isolates tenants')` or similar tests entirely.

- [ ] **Step 6: Run identity tests**

```bash
npx jest src/modules/identity src/api/dashboard/identity src/api/public/auth --runInBand
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/modules/identity src/api/dashboard/identity.controller.ts src/api/dashboard/identity.controller.spec.ts src/api/public/auth.controller.ts src/api/public/auth.controller.spec.ts
git commit -m "refactor(identity): remove tenantId from handlers, controllers, specs"
```

---

### Task 10: Cluster — people

**Files:**
- Modify: `apps/backend/src/modules/people/**/*.handler.ts` + `.spec.ts`
- Modify: `apps/backend/src/api/dashboard/people.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/client/profile.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/employee/clients.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to all people handlers**

```bash
find src/modules/people -name "*.handler.ts" | xargs -I {} echo {}
```

For each file: remove tenantId from Command, where, data.

- [ ] **Step 2: Apply pattern to three controllers listed above**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/people src/api/dashboard/people src/api/mobile/client/profile src/api/mobile/employee/clients --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/people src/api/
git commit -m "refactor(people): remove tenantId from handlers, controllers, specs"
```

---

### Task 11: Cluster — org-config

**Files:**
- Modify: `apps/backend/src/modules/org-config/**/*.handler.ts` + `.spec.ts`
- Modify: `apps/backend/src/api/dashboard/organization-branches.controller.ts` + spec
- Modify: `apps/backend/src/api/dashboard/organization-departments.controller.ts` + spec
- Modify: `apps/backend/src/api/dashboard/organization-categories.controller.ts` + spec
- Modify: `apps/backend/src/api/dashboard/organization-hours.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to org-config handlers (branches, departments, categories, business-hours)**

- [ ] **Step 2: Apply pattern to the four controllers**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/org-config src/api/dashboard/organization- --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/org-config src/api/dashboard/organization-branches* src/api/dashboard/organization-departments* src/api/dashboard/organization-categories* src/api/dashboard/organization-hours*
git commit -m "refactor(org-config): remove tenantId from branches/departments/categories/hours"
```

---

### Task 12: Cluster — org-experience (non-singleton handlers)

**Files:**
- Modify: `apps/backend/src/modules/org-experience/intake-forms/**`
- Modify: `apps/backend/src/modules/org-experience/ratings/**`
- Modify: `apps/backend/src/modules/org-experience/services/**`
- (Singleton handlers — branding, org-settings — handled in Phase 4)

- [ ] **Step 1: Apply mechanical pattern to intake-forms, ratings, services handlers**

- [ ] **Step 2: Update their specs**

- [ ] **Step 3: Run tests**

```bash
npx jest src/modules/org-experience/intake-forms src/modules/org-experience/ratings src/modules/org-experience/services --runInBand
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/org-experience/intake-forms src/modules/org-experience/ratings src/modules/org-experience/services
git commit -m "refactor(org-experience): remove tenantId from intake-forms, ratings, services"
```

---

### Task 13: Cluster — bookings

**Files:**
- Modify: `apps/backend/src/modules/bookings/**/*.handler.ts` + `.spec.ts` (largest cluster)
- Modify: `apps/backend/src/api/dashboard/bookings.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/client/bookings.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/employee/schedule.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to every handler under src/modules/bookings/**

Expect ~15-20 handlers: create-booking, cancel-booking, reschedule-booking, check-availability, confirm-booking, check-in-booking, complete-booking, no-show-booking, expire-booking, recurring-*, waitlist-*, group-*, booking-settings-*, etc.

- [ ] **Step 2: Apply pattern to the three booking controllers**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/bookings src/api/dashboard/bookings src/api/mobile/client/bookings src/api/mobile/employee/schedule --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/bookings src/api/dashboard/bookings* src/api/mobile/client/bookings* src/api/mobile/employee/schedule*
git commit -m "refactor(bookings): remove tenantId from handlers, controllers, specs"
```

---

### Task 14: Cluster — finance (excluding zatca singleton)

**Files:**
- Modify: `apps/backend/src/modules/finance/**/*.handler.ts` (payments, invoices, coupons, refunds, moyasar-webhook) + specs
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/client/payments.controller.ts` + spec
- (zatca config handlers handled in Phase 4)

- [ ] **Step 1: Apply mechanical pattern to finance handlers EXCEPT zatca config ones**

- [ ] **Step 2: Apply pattern to the two finance controllers**

Note: `finance.controller.ts` may contain endpoints for zatca — for now remove `@TenantId()` params but do NOT change the handler wiring for zatca. The zatca config handlers will be rewritten as singletons in Phase 4 with matching controller updates.

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/finance src/api/dashboard/finance src/api/mobile/client/payments --runInBand
```

Expected: all pass, or zatca tests may fail temporarily — if so, mark them `.skip` and add a note to Task 23.

- [ ] **Step 5: Commit**

```bash
git add src/modules/finance src/api/dashboard/finance* src/api/mobile/client/payments*
git commit -m "refactor(finance): remove tenantId from payments, invoices, coupons, refunds"
```

---

### Task 15: Cluster — comms

**Files:**
- Modify: `apps/backend/src/modules/comms/**/*.handler.ts` + `.spec.ts`
- Modify: `apps/backend/src/api/dashboard/comms.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/client/chat.controller.ts` + spec
- Modify: `apps/backend/src/api/mobile/client/notifications.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to comms handlers (notifications, email-templates, chat)**

- [ ] **Step 2: Apply pattern to three controllers**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/comms src/api/dashboard/comms src/api/mobile/client/chat src/api/mobile/client/notifications --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/comms src/api/dashboard/comms* src/api/mobile/client/chat* src/api/mobile/client/notifications*
git commit -m "refactor(comms): remove tenantId from notifications, email, chat"
```

---

### Task 16: Cluster — ai (excluding chatbot-config singleton)

**Files:**
- Modify: `apps/backend/src/modules/ai/**/*.handler.ts` (chat-completion, embed-document, manage-knowledge-base, semantic-search) + specs
- Modify: `apps/backend/src/api/dashboard/ai.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to ai handlers EXCEPT chatbot-config ones (handled in Phase 4)**

- [ ] **Step 2: Apply pattern to ai.controller.ts**

Note: leave chatbot-config endpoints alone for now; they'll be rewired in Phase 4.

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/ai src/api/dashboard/ai --runInBand
```

Expected: all pass (chatbot-config tests may fail — skip them with a note).

- [ ] **Step 5: Commit**

```bash
git add src/modules/ai src/api/dashboard/ai*
git commit -m "refactor(ai): remove tenantId from chat, embeddings, kb, search"
```

---

### Task 17: Cluster — ops

**Files:**
- Modify: `apps/backend/src/modules/ops/**/*.handler.ts` (generate-report, log-activity, health-check, cron-tasks) + specs
- Modify: `apps/backend/src/api/dashboard/ops.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to ops handlers**

- [ ] **Step 2: Apply pattern to ops.controller.ts**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/ops src/api/dashboard/ops --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/ops src/api/dashboard/ops*
git commit -m "refactor(ops): remove tenantId from reports, activity-log, cron"
```

---

### Task 18: Cluster — media

**Files:**
- Modify: `apps/backend/src/modules/media/**/*.handler.ts` + `.spec.ts`
- Modify: `apps/backend/src/api/dashboard/media.controller.ts` + spec

- [ ] **Step 1: Apply mechanical pattern to media handlers**

- [ ] **Step 2: Apply pattern to media.controller.ts**

- [ ] **Step 3: Update specs**

- [ ] **Step 4: Run tests**

```bash
npx jest src/modules/media src/api/dashboard/media --runInBand
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/modules/media src/api/dashboard/media*
git commit -m "refactor(media): remove tenantId from file handlers"
```

---

### Task 19: Cluster — platform (delete license + cleanup feature-flags, integrations, problem-reports)

**Files:**
- Delete: `apps/backend/src/modules/platform/license/` (entire folder)
- Modify: `apps/backend/src/modules/platform/feature-flags/**`
- Modify: `apps/backend/src/modules/platform/integrations/**`
- Modify: `apps/backend/src/modules/platform/problem-reports/**`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.spec.ts`
- Modify: `apps/backend/src/api/dashboard/platform.controller.ts` + spec

- [ ] **Step 1: Delete the license folder**

```bash
cd /c/pro/carekit/apps/backend
rm -rf src/modules/platform/license/
ls src/modules/platform/
```

Expected: no `license/` subfolder.

- [ ] **Step 2: Update platform.module.ts — remove license providers**

Read the file. Remove these import lines:

```typescript
import { ValidateLicenseService } from './license/validate-license.service';
import { CheckFeatureHandler } from './license/check-feature.handler';
```

Remove `ValidateLicenseService` and `CheckFeatureHandler` from both `providers:` array and `exports:` array.

- [ ] **Step 3: Update platform.module.spec.ts**

Remove any test cases that reference `ValidateLicenseService` or `CheckFeatureHandler` — either delete those `it()` blocks entirely or rewrite them to reference remaining providers.

- [ ] **Step 4: Apply mechanical pattern to feature-flags handlers**

- `list-feature-flags.handler.ts`: remove tenantId from Command type and where clause. List becomes `prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })`.
- `get-feature-flag-map.handler.ts`: remove tenantId. Returns `{ [key]: boolean }` from `findMany()` unfiltered.
- `update-feature-flag.handler.ts`: remove tenantId from Command. Update uses `where: { key: dto.key }` now (since key is `@unique`).

- [ ] **Step 5: Apply pattern to integrations handlers**

- `list-integrations.handler.ts`: `findMany()` without where.
- `upsert-integration.handler.ts`: `upsert({ where: { provider: dto.provider }, ... })`.

- [ ] **Step 6: Apply pattern to problem-reports handlers**

- `create-problem-report.handler.ts`, `list-problem-reports.handler.ts`, `update-problem-report-status.handler.ts`: remove tenantId.

- [ ] **Step 7: Update platform.controller.ts**

Remove all `@TenantId() tenantId: string` params. Remove the feature-check endpoint if it existed (`GET /features/check/:key` — no longer meaningful without license tiers). Alternatively, keep it simple and return `{ enabled: true }` for all — but since license is gone, **delete that endpoint and its handler import**.

- [ ] **Step 8: Update specs for feature-flags, integrations, problem-reports**

- [ ] **Step 9: Run platform tests**

```bash
npx jest src/modules/platform src/api/dashboard/platform --runInBand
```

Expected: all pass.

- [ ] **Step 10: Clean .env.example — remove license vars**

Edit `apps/backend/.env.example`. Remove these lines:

```
# License Server (Platform BC)
LICENSE_SERVER_URL=
LICENSE_KEY=
```

- [ ] **Step 11: Commit**

```bash
git add -A src/modules/platform src/api/dashboard/platform* .env.example
git commit -m "refactor(platform): delete license module + strip tenantId from feature-flags/integrations/problem-reports"
```

---

## Phase 4 — Singleton Refactoring

Pattern for all singleton handlers — id `"default"` is hardcoded:

```typescript
const SINGLETON_ID = 'default';

async get() {
  return this.prisma.thingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, /* sensible defaults */ },
    update: {},
  });
}

async upsert(dto: UpsertThingDto) {
  return this.prisma.thingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...dto },
    update: dto,
  });
}
```

Schema change required: each singleton model's `id` needs `@default("default")` so fresh installs get the row on first write.

### Task 20: Singleton — BrandingConfig

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma` (BrandingConfig model — add `id @default("default")`)
- Modify: `apps/backend/src/modules/org-experience/branding/get-branding.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/branding.handler.spec.ts`
- Modify: `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.spec.ts`

- [ ] **Step 1: Edit schema — BrandingConfig singleton id**

In `organization.prisma`, change the `BrandingConfig` model's id line to:

```prisma
model BrandingConfig {
  id            String   @id @default("default")
  clinicNameAr  String
  // ... rest unchanged
}
```

- [ ] **Step 2: Regenerate prisma migration (append to existing initial migration via `migrate dev`)**

Since we haven't deployed to any environment yet, we can amend the initial migration:

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force --skip-seed
rm -rf prisma/migrations/*_initial_single_organization
npx prisma migrate dev --name initial_single_organization
```

This regenerates one clean migration that includes the `@default("default")` change.

- [ ] **Step 3: Rewrite get-branding.handler.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, clinicNameAr: 'منظمتي' },
      update: {},
    });
  }
}
```

- [ ] **Step 4: Rewrite upsert-branding.handler.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertBrandingDto } from './upsert-branding.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertBrandingHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertBrandingDto) {
    return this.prisma.brandingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, clinicNameAr: dto.clinicNameAr ?? 'منظمتي', ...dto },
      update: dto,
    });
  }
}
```

- [ ] **Step 5: Update upload-logo.handler.ts**

The handler likely does `prisma.brandingConfig.update({ where: { tenantId }, data: { logoUrl } })`. Change to:

```typescript
await this.prisma.brandingConfig.upsert({
  where: { id: 'default' },
  create: { id: 'default', clinicNameAr: 'منظمتي', logoUrl: url },
  update: { logoUrl: url },
});
```

Remove the tenantId parameter from the Command and method signature.

- [ ] **Step 6: Update specs — branding.handler.spec.ts + upload-logo.handler.spec.ts**

Remove tenantId from all mock data. Update expectations to match upsert + singleton id.

- [ ] **Step 7: Update controllers calling branding**

Find `branding` endpoints in `apps/backend/src/api/dashboard/` and `apps/backend/src/api/public/`:

```bash
grep -rl "GetBrandingHandler\|UpsertBrandingHandler" src/api/
```

Remove `@TenantId()` params. `getBranding.execute()` now takes no args.

- [ ] **Step 8: Run branding tests**

```bash
npx jest src/modules/org-experience/branding src/api/dashboard/organization-settings src/api/public/branding --runInBand
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A prisma/schema/ prisma/migrations/ src/modules/org-experience/branding src/api/
git commit -m "refactor(branding): convert BrandingConfig to singleton"
```

---

### Task 21: Singleton — OrganizationSettings

**Files:**
- Modify: `apps/backend/prisma/schema/organization.prisma` (OrganizationSettings model)
- Modify: `apps/backend/src/modules/org-experience/org-settings/get-org-settings.handler.ts`
- Modify: `apps/backend/src/modules/org-experience/org-settings/upsert-org-settings.handler.ts`
- Modify: `apps/backend/src/api/dashboard/organization-settings.controller.ts` + spec

- [ ] **Step 1: Schema edit — OrganizationSettings id @default("default")**

Same pattern as Task 20 step 1.

- [ ] **Step 2: Regenerate migration (same as Task 20 step 2)**

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force --skip-seed
rm -rf prisma/migrations/*_initial_single_organization
npx prisma migrate dev --name initial_single_organization
```

- [ ] **Step 3: Rewrite get-org-settings.handler.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.organizationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID },
      update: {},
    });
  }
}
```

(`create` object must contain whatever non-nullable fields the schema requires — read the current schema and set sensible defaults for each.)

- [ ] **Step 4: Rewrite upsert-org-settings.handler.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertOrgSettingsDto } from './upsert-org-settings.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertOrgSettingsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertOrgSettingsDto) {
    return this.prisma.organizationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto },
      update: dto,
    });
  }
}
```

- [ ] **Step 5: Update organization-settings.controller.ts**

Remove `@TenantId()`, pass no args to get handler, pass DTO only to upsert.

- [ ] **Step 6: Update specs**

- [ ] **Step 7: Run tests**

```bash
npx jest src/modules/org-experience/org-settings src/api/dashboard/organization-settings --runInBand
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A prisma/schema/organization.prisma prisma/migrations/ src/modules/org-experience/org-settings src/api/dashboard/organization-settings*
git commit -m "refactor(org-settings): convert OrganizationSettings to singleton"
```

---

### Task 22: Singleton — ChatbotConfig

**Files:**
- Modify: `apps/backend/prisma/schema/ai.prisma` (ChatbotConfig model)
- Modify: `apps/backend/src/modules/ai/chatbot-config/*.handler.ts` + specs (exact filenames vary — likely get-chatbot-config, upsert-chatbot-config)
- Modify: `apps/backend/src/api/dashboard/ai.controller.ts` (chatbot-config endpoints only)

- [ ] **Step 1: Schema edit — ChatbotConfig id @default("default")**

In `ai.prisma` find `model ChatbotConfig` and set `id String @id @default("default")`.

- [ ] **Step 2: Regenerate migration**

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force --skip-seed
rm -rf prisma/migrations/*_initial_single_organization
npx prisma migrate dev --name initial_single_organization
```

- [ ] **Step 3: List chatbot-config handlers**

```bash
find src/modules/ai -type d -name "chatbot*"
find src/modules/ai -name "*.handler.ts" | xargs grep -l "ChatbotConfig\|chatbotConfig"
```

- [ ] **Step 4: Rewrite each chatbot-config handler as singleton**

Apply the same upsert-with-id=default pattern as Tasks 20-21.

- [ ] **Step 5: Update ai.controller.ts chatbot-config endpoints**

Remove `@TenantId()` from the chatbot-config endpoints specifically.

- [ ] **Step 6: Update specs**

- [ ] **Step 7: Run tests**

```bash
npx jest src/modules/ai/chatbot-config --runInBand
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A prisma/schema/ai.prisma prisma/migrations/ src/modules/ai/chatbot-config src/api/dashboard/ai*
git commit -m "refactor(ai): convert ChatbotConfig to singleton"
```

---

### Task 23: Singleton — ZatcaConfig

**Files:**
- Modify: `apps/backend/prisma/schema/finance.prisma` (ZatcaConfig model)
- Modify: `apps/backend/src/modules/finance/zatca/*.handler.ts` + specs
- Modify: `apps/backend/src/api/dashboard/finance.controller.ts` (zatca endpoints only)

- [ ] **Step 1: Schema edit — ZatcaConfig id @default("default")**

In `finance.prisma` locate `model ZatcaConfig`. Set `id String @id @default("default")` and ensure no `tenantId` remains.

- [ ] **Step 2: Regenerate migration**

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force --skip-seed
rm -rf prisma/migrations/*_initial_single_organization
npx prisma migrate dev --name initial_single_organization
```

- [ ] **Step 3: List zatca handlers**

```bash
find src/modules/finance -type d -name "zatca*"
find src/modules/finance -name "*.handler.ts" | xargs grep -l "ZatcaConfig\|zatcaConfig"
```

- [ ] **Step 4: Rewrite zatca-config handlers as singletons**

Same pattern. Note: zatca has both config (singleton) AND invoice generation logic (not singleton — handled in Task 14 already).

- [ ] **Step 5: Update finance.controller.ts zatca-config endpoints**

Un-skip any tests previously skipped in Task 14.

- [ ] **Step 6: Update specs**

- [ ] **Step 7: Run tests**

```bash
npx jest src/modules/finance/zatca src/api/dashboard/finance --runInBand
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A prisma/schema/finance.prisma prisma/migrations/ src/modules/finance/zatca src/api/dashboard/finance*
git commit -m "refactor(zatca): convert ZatcaConfig to singleton"
```

---

## Phase 5 — Public Routes

### Task 24: Simplify public branding route

**Files:**
- Modify: `apps/backend/src/api/public/branding.controller.ts` + spec

- [ ] **Step 1: Read current branding.controller.ts**

Confirm it has a route like `@Get('branding/:tenantId')`.

- [ ] **Step 2: Replace with parameter-less route**

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetBrandingHandler } from '../../modules/org-experience/branding/get-branding.handler';

@ApiTags('Public')
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly getBranding: GetBrandingHandler) {}

  @Get()
  get() {
    return this.getBranding.execute();
  }
}
```

- [ ] **Step 3: Update public.module.ts if route registration needs adjustment**

Read `apps/backend/src/api/public/public.module.ts` and confirm the controller is still exported. No other changes expected.

- [ ] **Step 4: Update branding.controller.spec.ts**

Remove any test that passes `:tenantId` parameter. Test should now call `GET /public/branding` with no params.

- [ ] **Step 5: Run tests**

```bash
cd /c/pro/carekit/apps/backend
npx jest src/api/public/branding --runInBand
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/api/public/branding.controller.ts src/api/public/branding.controller.spec.ts src/api/public/public.module.ts
git commit -m "refactor(public): simplify branding route — drop :tenantId param"
```

---

## Phase 6 — Dashboard Cleanup

### Task 25: Dashboard api.ts + env + types

**Files:**
- Modify: `apps/dashboard/lib/api.ts`
- Modify: `apps/dashboard/.env.example`
- Modify: `apps/dashboard/.env` (if exists locally — remove `NEXT_PUBLIC_TENANT_ID`)
- Modify: `apps/dashboard/lib/types/service.ts`
- Modify: `apps/dashboard/lib/types/user.ts`
- Modify: `apps/dashboard/lib/types/zatca.ts`
- Modify: `apps/dashboard/lib/api/problem-reports.ts`
- Modify: `apps/dashboard/lib/api/ratings.ts`
- Modify: `apps/dashboard/lib/api/media.ts`

- [ ] **Step 1: Edit apps/dashboard/lib/api.ts — remove TENANT_ID constant and all its uses**

Delete line 18:

```typescript
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ""
```

In `tryRefreshToken()` (around line 68-87), remove this header line from the `headers` object:

```typescript
...(TENANT_ID ? { "X-Tenant-ID": TENANT_ID } : {}),
```

In `request()` (around line 89-107), remove the same header injection line from the `headers: HeadersInit` construction.

- [ ] **Step 2: Edit apps/dashboard/.env.example**

Remove these lines:

```
# Tenant ID for this dashboard instance — must match a tenant in the database
NEXT_PUBLIC_TENANT_ID=
```

- [ ] **Step 3: Edit local .env if exists**

```bash
if [ -f /c/pro/carekit/apps/dashboard/.env ]; then sed -i.bak '/^NEXT_PUBLIC_TENANT_ID/d' /c/pro/carekit/apps/dashboard/.env && rm /c/pro/carekit/apps/dashboard/.env.bak; fi
```

- [ ] **Step 4: Remove tenantId from type files**

For each type file (`service.ts`, `user.ts`, `zatca.ts`): open it, find the `tenantId: string` or `tenantId?: string` field, delete it.

- [ ] **Step 5: Remove tenantId from lib/api functions**

For `problem-reports.ts`, `ratings.ts`, `media.ts`: if any fetch call serializes `tenantId` in body or query, remove it. Most should only have it in return types if those types hadn't been cleaned.

- [ ] **Step 6: Run dashboard typecheck**

```bash
cd /c/pro/carekit/apps/dashboard
npm run typecheck
```

Expected: 0 errors. If errors appear about missing `tenantId` usages, find and remove them.

- [ ] **Step 7: Run dashboard lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 8: Run dashboard unit tests**

```bash
npm run test
```

Expected: all pass. If `use-ratings.spec.tsx`, `use-problem-reports.spec.tsx`, `use-media.spec.tsx` fail due to tenantId in fixtures, remove those references.

- [ ] **Step 9: Commit**

```bash
cd /c/pro/carekit
git add apps/dashboard/lib/ apps/dashboard/.env.example apps/dashboard/test/
git commit -m "refactor(dashboard): remove X-Tenant-ID header + NEXT_PUBLIC_TENANT_ID + type fields"
```

---

### Task 26: Dashboard — verify pages load in browser

**Files:**
- No source changes — verification only

- [ ] **Step 1: Start backend in one terminal**

```bash
cd /c/pro/carekit/apps/backend
npm run dev
```

Expected: `Nest application successfully started` on `:5100`.

- [ ] **Step 2: Start dashboard in another terminal**

```bash
cd /c/pro/carekit/apps/dashboard
npm run dev
```

Expected: Next.js ready on `:5103`.

- [ ] **Step 3: Visit http://localhost:5103/login in a browser**

Expected: login page renders. Network tab should show NO `X-Tenant-ID` header on any request.

- [ ] **Step 4: Log in with seeded admin**

Email: `admin@carekit-test.com`  Password: `Admin@1234`

Expected: redirect to dashboard home.

- [ ] **Step 5: Visit /bookings, /clients, /employees, /branding, /settings**

Each page should load without errors. Lists should render (even if empty).

- [ ] **Step 6: If any page 500s**

Capture the network request in devtools. The backend response will identify the handler still using `tenantId` in its query — fix it, re-run tests for that cluster, commit a fix.

---

## Phase 7 — Mobile Cleanup

### Task 27: Mobile — remove tenant from services

**Files:**
- Modify: `apps/mobile/services/*.ts` (axios clients)
- Modify: `apps/mobile/.env.example` (if exists and has TENANT_ID)
- Modify: `apps/mobile/stores/*.ts` (any redux slice that persists tenant state)

- [ ] **Step 1: Locate tenant references in mobile**

```bash
cd /c/pro/carekit/apps/mobile
grep -rl "tenant\|TENANT_ID\|X-Tenant-ID" . --include="*.ts" --include="*.tsx"
```

- [ ] **Step 2: For each axios client, remove tenant header**

Typical pattern in `services/api.ts`:

```typescript
// BEFORE
instance.interceptors.request.use((config) => {
  config.headers['X-Tenant-ID'] = TENANT_ID;
  return config;
});

// AFTER
// delete entire interceptor if it did nothing else; otherwise just remove the tenant line
```

- [ ] **Step 3: Remove TENANT_ID env var**

If `apps/mobile/.env.example` mentions `TENANT_ID` or `EXPO_PUBLIC_TENANT_ID`, delete the line. Update `app.config.ts` / `expo-constants` consumers accordingly.

- [ ] **Step 4: Remove tenant from Redux state**

If `stores/` contains a `tenantSlice.ts` or `tenant` state in any slice, delete it. Remove references from selectors.

- [ ] **Step 5: Run mobile typecheck (if configured)**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run mobile tests**

```bash
npm run test
```

Expected: all pass (or no tests — mobile test suite may be minimal).

- [ ] **Step 7: Commit**

```bash
cd /c/pro/carekit
git add apps/mobile/
git commit -m "refactor(mobile): remove tenant header + env + redux state"
```

---

## Phase 8 — Packages Cleanup

### Task 28: Clean api-client and shared packages

**Files:**
- Modify: `packages/api-client/src/**/*.ts`
- Modify: `packages/shared/src/**/*.ts`

- [ ] **Step 1: Find tenant references in packages**

```bash
cd /c/pro/carekit
grep -rl "tenant\|TENANT_ID\|X-Tenant-ID" packages/ --include="*.ts"
```

- [ ] **Step 2: Clean api-client**

If api-client has a base fetch wrapper injecting `X-Tenant-ID`, remove it (same pattern as dashboard Task 25). If type definitions include `tenantId`, remove those fields.

- [ ] **Step 3: Clean shared types/enums**

If `packages/shared/src/types/` has a `TenantId` branded type or `Tenant` interface, delete it. Remove any re-exports.

- [ ] **Step 4: Rebuild packages**

```bash
npm run build -- --filter=@carekit/api-client --filter=@carekit/shared
```

Expected: both build cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/
git commit -m "refactor(packages): remove tenant from api-client + shared"
```

---

## Phase 9 — Seed Rewrite

### Task 29: Rewrite seed.ts for single-organization bootstrap

**Files:**
- Modify: `apps/backend/prisma/seed.ts`

- [ ] **Step 1: Replace seed.ts content entirely**

```typescript
// apps/backend/prisma/seed.ts
/**
 * Dev seed — creates an ADMIN user + singletons + main branch.
 * Run:  npm run prisma:seed
 * Safe to re-run: uses upsert everywhere.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const ADMIN_EMAIL    = process.env.SEED_EMAIL    ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@1234';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 1. Admin user
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
    update: {},
  });

  // 2. Branding singleton
  await prisma.brandingConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      clinicNameAr: 'منظمتي',
      clinicNameEn: 'My Organization',
      primaryColor: '#354FD8',
      accentColor:  '#82CC17',
    },
    update: {},
  });

  // 3. Organization settings singleton
  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  // 4. Main branch
  await prisma.branch.upsert({
    where: { id: 'main-branch' },
    create: {
      id:       'main-branch',
      nameAr:   'الفرع الرئيسي',
      nameEn:   'Main Branch',
      isActive: true,
      isMain:   true,
      timezone: 'Asia/Riyadh',
      country:  'SA',
    },
    update: {},
  });

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  Admin  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`✔  Branding singleton ready`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run seed against fresh DB**

```bash
cd /c/pro/carekit/apps/backend
npx prisma migrate reset --force
npm run prisma:seed
```

Expected: all four ✔ lines print. Verify by:

```bash
npx prisma studio
```

Check that `User`, `BrandingConfig` (id=default), `OrganizationSettings` (id=default), `Branch` (id=main-branch) all contain one row each.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "refactor(seed): single-organization bootstrap with singletons + main branch"
```

---

## Phase 10 — Documentation

### Task 30: Update CLAUDE.md files

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `apps/backend/CLAUDE.md`
- Modify: `apps/dashboard/CLAUDE.md`
- Modify: `apps/mobile/CLAUDE.md` (if mentions tenant)

- [ ] **Step 1: Edit root CLAUDE.md**

Read `CLAUDE.md` in repo root. Apply these edits:

- Change the description line from "White-label Clinic Management Platform" to "White-label Organization Management Platform".
- If Golden Rules contains a tenant-related rule, delete it.
- In the design context section, replace "Clinic owners should feel proud" phrasing with "Organization owners should feel proud" where it reads naturally. Keep Arabic copy consistent ("العيادة" → "المنظمة" where appropriate).
- Anywhere `tenantId`, `@TenantId`, or `X-Tenant-ID` appears, delete the sentence or replace with single-organization context.

- [ ] **Step 2: Edit apps/backend/CLAUDE.md**

- **Delete** the rule: "Tenant isolation is mandatory. Every query scopes by `tenantId` extracted via `@TenantId()` ([common/tenant](src/common/tenant/)). A handler missing it is a bug."
- **Replace with**: "System is single-organization. Queries that span physical locations use `branchId` from the request body or authenticated user. There is no tenant layer — one deployment serves one organization."
- Any code examples showing `@TenantId()` → rewrite without the decorator.
- Any reference to `common/tenant/` folder → delete.

- [ ] **Step 3: Edit apps/dashboard/CLAUDE.md**

Scan for any mention of `TENANT_ID`, `X-Tenant-ID`, or tenant concepts. Remove. Dashboard rules (layer rules, DS, i18n) are unchanged.

- [ ] **Step 4: Edit apps/mobile/CLAUDE.md**

Same scan. Remove tenant references.

- [ ] **Step 5: Verify no lingering tenant mentions in docs**

```bash
cd /c/pro/carekit
grep -rin "tenant\|X-Tenant-ID" CLAUDE.md apps/*/CLAUDE.md
```

Expected: no meaningful matches (the word "tenant" may appear in unrelated historical context; review each hit).

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md apps/backend/CLAUDE.md apps/dashboard/CLAUDE.md apps/mobile/CLAUDE.md
git commit -m "docs: update CLAUDE.md files for single-organization model"
```

---

## Phase 11 — End-to-End Verification

### Task 31: Full verification + Chrome DevTools MCP QA gate

**Files:**
- No source files — verification only. Screenshots go under `docs/audits/single-organization-mode/`.

- [ ] **Step 1: Full backend suite**

```bash
cd /c/pro/carekit/apps/backend
npm run lint
npm run build
npm run test
npm run test:e2e
```

Expected: all four pass. If any fails, fix root cause and recommit.

- [ ] **Step 2: Full dashboard suite**

```bash
cd /c/pro/carekit/apps/dashboard
npm run typecheck
npm run lint
npm run build
npm run test
```

Expected: all four pass.

- [ ] **Step 3: Mobile build check**

```bash
cd /c/pro/carekit/apps/mobile
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Full monorepo build**

```bash
cd /c/pro/carekit
npm run build
```

Expected: all packages + apps build.

- [ ] **Step 5: Final tenant grep — must return nothing meaningful**

```bash
cd /c/pro/carekit
grep -rin "tenantId\|@TenantId\|X-Tenant-ID\|NEXT_PUBLIC_TENANT_ID" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.prisma" --include="*.md"
```

Expected: zero matches. If anything appears, fix in-place and amend the relevant commit or add a cleanup commit.

- [ ] **Step 6: Chrome DevTools MCP QA walkthrough (the required pre-merge gate per memory/chrome_devtools_mcp_qa_gate.md)**

Start backend + dashboard. Using Chrome DevTools MCP, walk through these pages and capture a screenshot for each (save to `docs/audits/single-organization-mode/`):

1. `/login` — renders, no X-Tenant-ID header in network tab
2. `/bookings` — list loads (empty OK)
3. `/clients` — list loads
4. `/employees` — list loads
5. `/branches` — Main Branch visible
6. `/departments` — list loads (empty OK)
7. `/services` — list loads
8. `/branding` — GET /branding returns singleton row
9. `/settings` — GET /settings returns singleton row
10. `/invoices` — list loads
11. `/payments` — list loads
12. `/reports` — loads without 500

For each, verify:
- No 4xx/5xx in network tab
- No errors in console
- No request contains `X-Tenant-ID` header

- [ ] **Step 7: Confirm deployment flow works for a second installation**

Simulate provisioning a second organization as a separate deployment:

```bash
cd /tmp
git clone /c/pro/carekit carekit-client-b
cd carekit-client-b
git checkout feat/single-organization-mode
cp apps/backend/.env.example apps/backend/.env
cp apps/dashboard/.env.example apps/dashboard/.env
# point to a separate DB (requires second postgres container or different db name)
```

Manually verify: schema + seed run cleanly on a fresh DB. (This step can be done once — no need to keep the directory.)

- [ ] **Step 8: Push the branch and open draft PR**

```bash
cd /c/pro/carekit
git push origin feat/single-organization-mode
```

Open a draft PR with title `feat: single-organization mode` and body summarizing:
- Goal
- Stats (X commits, Y files, Z lines removed)
- Testing evidence (screenshots + test output)
- Migration note (all historical migrations replaced)

- [ ] **Step 9: Final commit — QA artifacts**

```bash
git add docs/audits/single-organization-mode/
git commit -m "docs(audits): QA screenshots for single-organization mode"
git push
```

---

## Rollback Plan (if something goes irrecoverably wrong mid-way)

```bash
git checkout main
git branch -D feat/single-organization-mode
# If main was ever force-pushed:
git reset --hard origin/backup/pre-tenant-removal
```

`backup/pre-tenant-removal` is the safe return point.

---

## Expected Final Stats

- ~31 tasks, ~23-25 commits (some tasks produce multiple commits, some produce none)
- ~172 `@TenantId()` removals
- ~10 prisma schema files stripped
- 1 migration folder created (replacing 41)
- 4 singleton tables converted (BrandingConfig, OrganizationSettings, ChatbotConfig, ZatcaConfig)
- 1 module deleted entirely (license)
- 0 `tenantId` references in the final codebase
- All ~153 test files still passing

**Time estimate:** 4-6 focused working days with checkpoints between Phase 1, Phase 3, and Phase 11.
