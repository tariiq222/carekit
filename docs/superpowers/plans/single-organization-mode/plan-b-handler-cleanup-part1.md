# Plan B — Handler Cleanup Part 1 (identity, people, org-config, org-experience non-singleton, bookings)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Remove `tenantId` from 5 backend clusters' handlers, controllers, and specs. After this plan, these 5 clusters compile cleanly (against their own cluster scope) and their Jest tests pass.

**Architecture:** Pure mechanical refactor — `tenantId` removed from Command types, Prisma `where`/`data` clauses, controller `@TenantId()` params, and spec fixtures. No logic changes.

**Tech Stack:** NestJS 11 · Prisma 7 · Jest.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Plan A must be COMPLETE. Verify:
  ```bash
  grep -rn "UserId.*from.*tenant" apps/backend/src/ --include="*.ts"
  # Must return ZERO matches
  ```
- You must be on branch `feat/single-organization-mode`.
- `common/auth/user-id.decorator.ts` must exist.

If either check fails, STOP. Complete Plan A first.

**⚠️ Scope amendment (2026-04-16) — identity cluster expanded:**

Originally `JwtPayload.tenantId`, `req.user.tenantId`, and `CurrentUser.tenantId` were reserved for Plan E. This is reversed because the schema (Tasks 1-4) already dropped `User.tenantId` and `RefreshToken.tenantId`, so `token.service.ts` and `jwt.strategy.ts` no longer compile as-is. The auth surface must be cleaned in the identity cluster of Plan B, not deferred.

**Now owned by Plan B (identity cluster):**
- `JwtPayload` interface: remove `tenantId: string` field (apps/backend/src/modules/identity/shared/token.service.ts)
- `issueTokenPair` param type: remove `tenantId` from the user param
- JWT payload construction: remove `tenantId: user.tenantId`
- `refreshToken.create`: remove `tenantId: user.tenantId` (schema already dropped the column)
- `JwtStrategy.validate` return: remove `tenantId: user.tenantId` (apps/backend/src/modules/identity/jwt.strategy.ts)
- `CurrentUser` interface: remove `tenantId: string` field (apps/backend/src/common/auth/current-user.decorator.ts) — moved here from Plan E
- Handler reads of `req.user.tenantId`: delete the read entirely (the handler no longer needs it)

**Still owned by Plan E (unchanged):**
- `TenantMiddleware` wiring in `app.module.ts`
- `@TenantId()` decorator itself (still used by non-identity handlers in Plans C/D until their own cleanup)
- `common/tenant/` folder deletion
- `RequestContext` simplification (keeping requestId + userId only)
- `X-Tenant-ID` header handling in middleware

**Do NOT use placeholder values like `tenantId: ''`** — remove the fields outright. Placeholders create type lies and just defer the cleanup with extra work.

**Expected breakage after B1 commits:**
- Any handler in Plans C/D that still reads `req.user.tenantId` will throw a TS error. This is intentional — the compiler surfaces every remaining call site for Plans C/D to clean.
- Full backend build remains gated until after Plan D (per master plan Revision 4).

**Parallel execution rule:**
- **Plan B and Plan C CAN run in parallel** ONLY if each session uses its OWN sub-branch:
  - Plan B session: `git checkout -b feat/single-org-B-part1 feat/single-organization-mode`
  - Plan C session: `git checkout -b feat/single-org-C-part2 feat/single-organization-mode`
- After BOTH plans finish, they must be merged back to `feat/single-organization-mode` sequentially (B first, then C) to surface any conflicts in `app.module.ts` or shared types.
- **If you are running Plan B alone (not in parallel)**: stay on `feat/single-organization-mode` — no sub-branch needed.
- **Do NOT run Plan D, E, or G while this plan is active.**
- **Plan F (frontend) CAN run in parallel with this plan** — separate file trees.

**Completion contract:**
- Plan B is DONE only when:
  1. All 5 clusters (identity, people, org-config, org-experience non-singleton, bookings) have ZERO `tenantId` in their handler `.ts` files.
  2. Cluster-scoped Jest runs pass for each.
  3. All commits pushed.
- **If this session stops mid-cluster:**
  - Do NOT start another plan. Resume the same cluster in the next session.
  - The cluster must be finished and committed before moving to the next cluster.
  - If you finished cluster 2 of 5 and stop, the next session starts from cluster 3.

---

## Scope — In vs Out

### ✅ In scope (this plan)

**Handlers + controllers + specs for these clusters:**

1. **identity** — `modules/identity/**` + `api/dashboard/identity.controller.ts` + `api/public/auth.controller.ts`
2. **people** — `modules/people/**` + `api/dashboard/people.controller.ts` + `api/mobile/client/profile.controller.ts` + `api/mobile/employee/clients.controller.ts`
3. **org-config** — `modules/org-config/**` + `api/dashboard/organization-branches.controller.ts` + `api/dashboard/organization-departments.controller.ts` + `api/dashboard/organization-categories.controller.ts` + `api/dashboard/organization-hours.controller.ts`
4. **org-experience (non-singleton only)** — `modules/org-experience/intake-forms/**` + `modules/org-experience/ratings/**` + `modules/org-experience/services/**`. **NOT branding/org-settings** — those are Plan D singletons.
5. **bookings** — `modules/bookings/**` + `api/dashboard/bookings.controller.ts` + `api/mobile/client/bookings.controller.ts` + `api/mobile/employee/schedule.controller.ts`

### ❌ Out of scope

- `modules/org-experience/branding/**` → Plan D
- `modules/org-experience/org-settings/**` → Plan D
- `modules/finance/**` → Plan C
- `modules/comms/**` → Plan C
- `modules/ai/**` → Plan C
- `modules/ops/**` → Plan C
- `modules/media/**` → Plan C
- `modules/platform/**` → Plan C
- Schema changes → already done (Tasks 3-4)
- `common/tenant/` deletion → Plan E

---

## Mechanical Pattern (applies to EVERY handler in this plan)

### Pattern 1 — Handler file

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

### Pattern 2 — List handler `where` clause

```typescript
// BEFORE
const where = {
  tenantId: dto.tenantId,
  ...(dto.isActive !== undefined && { isActive: dto.isActive }),
};

// AFTER
const where = {
  ...(dto.isActive !== undefined && { isActive: dto.isActive }),
};
```

### Pattern 3 — findUnique composite keys

```typescript
// BEFORE
await this.prisma.user.findUnique({
  where: { tenantId_email: { tenantId, email } },
});

// AFTER — use the new @unique single field
await this.prisma.user.findUnique({
  where: { email },
});
```

The compound key names `tenantId_X` no longer exist in the generated Prisma client (schema was cleaned in Task 3-4). If you see one, it MUST be replaced with a single-field where clause.

### Pattern 4 — Controller

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

Remove the `@TenantId()` import line too if `TenantId` is no longer used in the file.

### Pattern 5 — Spec

```typescript
// BEFORE
const cmd = { tenantId: 'tenant-1', name: 'Foo' };
expect(mockPrisma.thing.create).toHaveBeenCalledWith({
  data: { tenantId: 'tenant-1', name: 'Foo' },
});

// AFTER
const cmd = { name: 'Foo' };
expect(mockPrisma.thing.create).toHaveBeenCalledWith({
  data: { name: 'Foo' },
});
```

Remove any `it('isolates tenants', ...)` or similar cross-tenant tests entirely.

---

## Task B1 — Cluster: identity

**Files:**
- `apps/backend/src/modules/identity/**/*.handler.ts` and `*.handler.spec.ts` (expect 10-15 files)
- `apps/backend/src/api/dashboard/identity.controller.ts`
- `apps/backend/src/api/dashboard/identity.controller.spec.ts`
- `apps/backend/src/api/public/auth.controller.ts`
- `apps/backend/src/api/public/auth.controller.spec.ts`

**Task B1 auth surface — exact files (scope amendment above applies here):**

- `apps/backend/src/modules/identity/shared/token.service.ts` (+ spec if exists)
- `apps/backend/src/modules/identity/jwt.strategy.ts` (+ spec if exists)
- `apps/backend/src/common/auth/current-user.decorator.ts`

In `current-user.decorator.ts`: remove ONLY the `tenantId: string;` line from the `CurrentUser` interface. Leave `clientId` and `employeeId` untouched.

- [ ] **Step 1: List the files**

```bash
cd c:\pro\carekit/apps/backend
find src/modules/identity -name "*.handler.ts" -o -name "*.handler.spec.ts"
ls src/api/dashboard/identity.controller.ts src/api/dashboard/identity.controller.spec.ts src/api/public/auth.controller.ts src/api/public/auth.controller.spec.ts
```

- [ ] **Step 2: Apply Pattern 1 + 2 + 3 to every handler file**

Read each handler file. Remove `tenantId` from Command type (or merge Command with DTO if that's all that differed). Remove `tenantId` from every `where` clause, `create.data`, `update.data`. Replace any `tenantId_X` compound keys with single-field ones.

- [ ] **Step 3: Apply Pattern 4 to identity.controller.ts and auth.controller.ts**

Remove every `@TenantId() tenantId: string,` parameter. Remove `tenantId,` when spreading into `handler.execute({ ... })`. If no more `@TenantId()` usages remain in the file, remove its import line.

- [ ] **Step 4: Apply Pattern 5 to all identity specs**

Remove `tenantId` from all mock commands, assertions, and fixtures. Delete any `it('isolates tenants')` blocks.

- [ ] **Step 5: Run cluster tests**

```bash
cd c:\pro\carekit/apps/backend
npx jest src/modules/identity src/api/dashboard/identity src/api/public/auth --runInBand
```

Expected: all pass. If any fail due to remaining `tenantId` references, fix in-place.

- [ ] **Step 6: Cluster-scoped typecheck**

```bash
cd c:\pro\carekit/apps/backend
npx tsc --noEmit 2>&1 | grep -E "src/modules/identity|src/api/.*identity|src/api/public/auth" | head -20
```

Expected: zero errors in these files. (Other clusters may have errors — ignore them.)

- [ ] **Step 7: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/modules/identity apps/backend/src/api/dashboard/identity.controller.ts apps/backend/src/api/dashboard/identity.controller.spec.ts apps/backend/src/api/public/auth.controller.ts apps/backend/src/api/public/auth.controller.spec.ts
git commit -m "refactor(identity): remove tenantId from handlers, controllers, specs"
```

---

## Task B2 — Cluster: people

**Files:**
- `apps/backend/src/modules/people/**/*.handler.ts` + specs
- `apps/backend/src/api/dashboard/people.controller.ts` + spec
- `apps/backend/src/api/mobile/client/profile.controller.ts` + spec
- `apps/backend/src/api/mobile/employee/clients.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
cd c:\pro\carekit/apps/backend
find src/modules/people -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5 to all listed handlers, controllers, specs**

Special attention: `Client` now has `phone String? @unique` and `email String?` (no unique). `Employee` has `email String? @unique`. Any `findUnique` using `tenantId_email` must become `findUnique({ where: { email } })`. For Client, if a handler used `tenantId_phone`, replace with `findUnique({ where: { phone } })`.

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/people src/api/dashboard/people src/api/mobile/client/profile src/api/mobile/employee/clients --runInBand
```

Expected: all pass.

- [ ] **Step 4: Cluster-scoped typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/people|src/api/.*people|profile\.controller|clients\.controller" | head -20
```

Expected: zero errors in listed files.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/people apps/backend/src/api/dashboard/people.controller.ts apps/backend/src/api/dashboard/people.controller.spec.ts apps/backend/src/api/mobile/client/profile.controller.ts apps/backend/src/api/mobile/client/profile.controller.spec.ts apps/backend/src/api/mobile/employee/clients.controller.ts apps/backend/src/api/mobile/employee/clients.controller.spec.ts
git commit -m "refactor(people): remove tenantId from handlers, controllers, specs"
```

---

## Task B3 — Cluster: org-config

**Files:**
- `apps/backend/src/modules/org-config/**/*.handler.ts` + specs
- `apps/backend/src/api/dashboard/organization-branches.controller.ts` + spec
- `apps/backend/src/api/dashboard/organization-departments.controller.ts` + spec
- `apps/backend/src/api/dashboard/organization-categories.controller.ts` + spec
- `apps/backend/src/api/dashboard/organization-hours.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
find src/modules/org-config -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

`Department.nameAr` is now globally `@unique`. Any `findUnique({ where: { tenantId_nameAr: {...} } })` becomes `findUnique({ where: { nameAr } })`. `BookingSettings` has `branchId String? @unique` — if a handler used `tenantId_branchId`, change to `where: { branchId }`.

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/org-config src/api/dashboard/organization-branches src/api/dashboard/organization-departments src/api/dashboard/organization-categories src/api/dashboard/organization-hours --runInBand
```

- [ ] **Step 4: Cluster-scoped typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/org-config|src/api/dashboard/organization-" | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/org-config apps/backend/src/api/dashboard/organization-branches.controller.ts apps/backend/src/api/dashboard/organization-branches.controller.spec.ts apps/backend/src/api/dashboard/organization-departments.controller.ts apps/backend/src/api/dashboard/organization-departments.controller.spec.ts apps/backend/src/api/dashboard/organization-categories.controller.ts apps/backend/src/api/dashboard/organization-categories.controller.spec.ts apps/backend/src/api/dashboard/organization-hours.controller.ts apps/backend/src/api/dashboard/organization-hours.controller.spec.ts
git commit -m "refactor(org-config): remove tenantId from branches, departments, categories, hours"
```

---

## Task B4 — Cluster: org-experience (non-singleton only)

**Files:**
- `apps/backend/src/modules/org-experience/intake-forms/**` + specs
- `apps/backend/src/modules/org-experience/ratings/**` + specs
- `apps/backend/src/modules/org-experience/services/**` + specs

**Explicitly NOT in scope:**
- `modules/org-experience/branding/**` — Plan D
- `modules/org-experience/org-settings/**` — Plan D

There is no dedicated controller file for these specific slices; they are served via the existing dashboard controllers touched elsewhere. But confirm with grep before committing.

- [ ] **Step 1: List files**

```bash
find src/modules/org-experience/intake-forms src/modules/org-experience/ratings src/modules/org-experience/services -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

- [ ] **Step 3: Check if any dashboard controllers reference these specific handlers**

```bash
grep -rln "IntakeFormHandler\|RatingHandler\|CreateServiceHandler\|UpdateServiceHandler\|ListServicesHandler" src/api/dashboard/ --include="*.ts"
```

If there's a dedicated `services.controller.ts` or similar, apply Pattern 4 there too. Otherwise, the endpoints live inside a larger controller already processed in B3 — verify it has no remaining `@TenantId()` for these endpoints.

- [ ] **Step 4: Run cluster tests**

```bash
npx jest src/modules/org-experience/intake-forms src/modules/org-experience/ratings src/modules/org-experience/services --runInBand
```

- [ ] **Step 5: Cluster-scoped typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/org-experience/(intake-forms|ratings|services)" | head -20
```

Expected: zero errors in these files. (Branding/org-settings errors exist and are expected — they'll be fixed in Plan D.)

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/org-experience/intake-forms apps/backend/src/modules/org-experience/ratings apps/backend/src/modules/org-experience/services
# Also add any dashboard controller modifications if step 3 found matches
git commit -m "refactor(org-experience): remove tenantId from intake-forms, ratings, services"
```

---

## Task B5 — Cluster: bookings (largest cluster)

**Files:**
- `apps/backend/src/modules/bookings/**/*.handler.ts` + specs (expect 20-30 files)
- `apps/backend/src/api/dashboard/bookings.controller.ts` + spec
- `apps/backend/src/api/mobile/client/bookings.controller.ts` + spec
- `apps/backend/src/api/mobile/employee/schedule.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
find src/modules/bookings -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

Watch for these specific patterns in bookings:
- `check-availability.handler.ts` — `where: { tenantId, employeeId, scheduledAt: {...} }` → drop `tenantId`, keep the rest; the composite index `@@index([employeeId, scheduledAt])` still covers it.
- `booking-settings` handlers — query by `branchId String? @unique` directly, not via compound key.
- Recurring, waitlist, group booking handlers — same mechanical removal.

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/bookings src/api/dashboard/bookings src/api/mobile/client/bookings src/api/mobile/employee/schedule --runInBand
```

Expected: all pass. Bookings has the most tests — expect 40-60 tests to run.

- [ ] **Step 4: Cluster-scoped typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/bookings|src/api/.*bookings|schedule\.controller" | head -30
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/bookings apps/backend/src/api/dashboard/bookings.controller.ts apps/backend/src/api/dashboard/bookings.controller.spec.ts apps/backend/src/api/mobile/client/bookings.controller.ts apps/backend/src/api/mobile/client/bookings.controller.spec.ts apps/backend/src/api/mobile/employee/schedule.controller.ts apps/backend/src/api/mobile/employee/schedule.controller.spec.ts
git commit -m "refactor(bookings): remove tenantId from handlers, controllers, specs"
```

---

## Task B6 — Final verification for Plan B

- [ ] **Step 1: Grep for tenantId across scope**

```bash
cd c:\pro\carekit
grep -rn "tenantId\|@TenantId()" apps/backend/src/modules/identity apps/backend/src/modules/people apps/backend/src/modules/org-config apps/backend/src/modules/org-experience/intake-forms apps/backend/src/modules/org-experience/ratings apps/backend/src/modules/org-experience/services apps/backend/src/modules/bookings --include="*.ts"
```

Expected: ZERO matches.

- [ ] **Step 2: Grep controllers in scope**

```bash
grep -n "@TenantId()" apps/backend/src/api/dashboard/identity.controller.ts apps/backend/src/api/dashboard/people.controller.ts apps/backend/src/api/dashboard/organization-branches.controller.ts apps/backend/src/api/dashboard/organization-departments.controller.ts apps/backend/src/api/dashboard/organization-categories.controller.ts apps/backend/src/api/dashboard/organization-hours.controller.ts apps/backend/src/api/dashboard/bookings.controller.ts apps/backend/src/api/public/auth.controller.ts apps/backend/src/api/mobile/client/profile.controller.ts apps/backend/src/api/mobile/client/bookings.controller.ts apps/backend/src/api/mobile/employee/clients.controller.ts apps/backend/src/api/mobile/employee/schedule.controller.ts
```

Expected: ZERO matches.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Mark Plan B complete**

```
✅ Plan B — Handler Cleanup Part 1 — DONE
```

---

## Rollback

If a cluster task fails and leaves the branch broken:

```bash
git reset --hard HEAD~1   # undo last commit
```

Restart that cluster's task from step 1.

If multiple cluster tasks are broken:

```bash
# Return to the last known-good state
git log --oneline | head -10
git reset --hard <sha-of-last-good-commit>
```
