# Plan F — Clients + Packages Cleanup (Dashboard, Mobile, Shared Packages)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Remove `X-Tenant-ID` header from all HTTP clients (dashboard + mobile + packages), delete `NEXT_PUBLIC_TENANT_ID` env variable, remove `tenantId` fields from dashboard types and tests, and simplify the public `/public/branding/:tenantId` route to `/public/branding`.

**Architecture:** Frontend-only and shared-package refactor. No backend handler changes; backend route change is minimal (remove `:tenantId` URL param).

**Tech Stack:** Next.js 15 · React 19 · React Native 0.83 (Expo) · Vitest · npm workspaces.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Tasks 1-4 of master plan must be complete (schemas are clean).
- No backend plan prerequisites are strictly required — Plan F touches frontend + shared packages + ONE backend controller file (public branding).

**Parallel execution rule:**
- **Plan F CAN run in parallel with Plans A, B, C, D, E** because it touches frontend / packages / one isolated controller file that no other plan edits.
- **Plan F MUST NOT run in parallel with Plan G** because Plan G needs the full stack consistent for E2E verification.
- If running in parallel with any backend plan, use a separate sub-branch:
  - `git checkout -b feat/single-org-F-frontend feat/single-organization-mode`
- After the backend plan finishes, merge F into `feat/single-organization-mode` sequentially.
- If running alone: stay on `feat/single-organization-mode`.

**Completion contract:**
- Plan F is DONE only when:
  1. No `X-Tenant-ID` header in any HTTP request across dashboard, mobile, packages.
  2. `NEXT_PUBLIC_TENANT_ID` removed from dashboard env.
  3. Dashboard types and tests have no `tenantId` fields.
  4. Public branding route: URL is `/public/branding` (no `:tenantId` param).
  5. Dashboard `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all pass.
  6. Packages build.
  7. Mobile typecheck passes.
  8. `grep -n "tenantId\|@TenantId" apps/backend/src/api/public/` returns zero.
  9. All commits pushed.
- **If this session stops mid-task:** next session resumes the specific task from its first uncompleted step.

---

## File Structure

### Files modified — Dashboard
- `apps/dashboard/lib/api.ts` (remove `TENANT_ID` constant + header injection)
- `apps/dashboard/.env.example`
- `apps/dashboard/.env` (local — remove `NEXT_PUBLIC_TENANT_ID` if present)
- `apps/dashboard/lib/types/service.ts` (remove `tenantId` field)
- `apps/dashboard/lib/types/user.ts` (remove `tenantId` field)
- `apps/dashboard/lib/types/zatca.ts` (remove `tenantId` field)
- `apps/dashboard/lib/api/problem-reports.ts` (remove any tenant references)
- `apps/dashboard/lib/api/ratings.ts` (remove any tenant references)
- `apps/dashboard/lib/api/media.ts` (remove any tenant references)
- `apps/dashboard/test/unit/hooks/use-ratings.spec.tsx`
- `apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx`
- `apps/dashboard/test/unit/hooks/use-media.spec.tsx`

### Files modified — Mobile
- `apps/mobile/services/*.ts` (axios clients — remove X-Tenant-ID interceptor)
- `apps/mobile/.env.example` (if has `TENANT_ID` / `EXPO_PUBLIC_TENANT_ID`)
- `apps/mobile/stores/*.ts` (if any redux slice persists tenant state — remove)
- `apps/mobile/app.config.ts` or similar (if reads TENANT_ID from env)

### Files modified — Packages
- `packages/api-client/**` (remove X-Tenant-ID injection if present)
- `packages/shared/**` (remove `TenantId` type if exists)

### Files modified — Backend (3 files)
- `apps/backend/src/api/public/branding.controller.ts` + spec — change route from `@Get('branding/:tenantId')` to `@Get('branding')` (no param)
- `apps/backend/src/api/public/catalog.controller.ts` + spec
- `apps/backend/src/api/public/slots.controller.ts` + spec
- `apps/backend/src/api/public/public.module.ts` (if registration needs adjustment — usually no change)

### Files NOT touched
- Any backend handler or non-public controller
- Any schema / migration
- Backend `common/tenant/` (Plan E)

---

## Task F1 — Dashboard api.ts + env cleanup

**Files:**
- `apps/dashboard/lib/api.ts`
- `apps/dashboard/.env.example`
- `apps/dashboard/.env` (if exists)

- [ ] **Step 1: Read apps/dashboard/lib/api.ts**

Locate:

```typescript
const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ""
```

And two places that inject the header:

```typescript
...(TENANT_ID ? { "X-Tenant-ID": TENANT_ID } : {}),
```

Once in `tryRefreshToken()` and once in `request()`.

- [ ] **Step 2: Delete the constant and both header injections**

Use Edit tool to remove the constant line and both injection spreads. The resulting `headers` in both places should look like:

```typescript
const headers: HeadersInit = {
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...options.headers,
}
```

- [ ] **Step 3: Edit apps/dashboard/.env.example**

Remove these lines:

```
# Tenant ID for this dashboard instance — must match a tenant in the database
NEXT_PUBLIC_TENANT_ID=
```

- [ ] **Step 4: Edit local .env if exists**

```bash
if [ -f c:\pro\carekit/apps/dashboard/.env ]; then
  sed -i.bak '/^NEXT_PUBLIC_TENANT_ID/d' c:\pro\carekit/apps/dashboard/.env && rm c:\pro\carekit/apps/dashboard/.env.bak
fi
```

- [ ] **Step 5: Commit**

```bash
cd c:\pro\carekit
git add apps/dashboard/lib/api.ts apps/dashboard/.env.example
# .env is gitignored — don't add it
git commit -m "refactor(dashboard): remove X-Tenant-ID header + NEXT_PUBLIC_TENANT_ID env"
```

---

## Task F2 — Dashboard types cleanup

**Files:**
- `apps/dashboard/lib/types/service.ts`
- `apps/dashboard/lib/types/user.ts`
- `apps/dashboard/lib/types/zatca.ts`

- [ ] **Step 1: For each file, find `tenantId` field and remove it**

```bash
grep -n "tenantId" apps/dashboard/lib/types/service.ts apps/dashboard/lib/types/user.ts apps/dashboard/lib/types/zatca.ts
```

For each match, open the file and delete the line containing `tenantId: string` or `tenantId?: string`.

- [ ] **Step 2: Verify no more tenantId in types**

```bash
grep -rn "tenantId" apps/dashboard/lib/types/ --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/types/
git commit -m "refactor(dashboard): remove tenantId field from service/user/zatca types"
```

---

## Task F3 — Dashboard api/ functions + test fixtures

**Files:**
- `apps/dashboard/lib/api/problem-reports.ts`
- `apps/dashboard/lib/api/ratings.ts`
- `apps/dashboard/lib/api/media.ts`
- `apps/dashboard/test/unit/hooks/use-ratings.spec.tsx`
- `apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx`
- `apps/dashboard/test/unit/hooks/use-media.spec.tsx`

- [ ] **Step 1: Find tenantId mentions in api files**

```bash
grep -n "tenantId" apps/dashboard/lib/api/problem-reports.ts apps/dashboard/lib/api/ratings.ts apps/dashboard/lib/api/media.ts
```

For each: usually type imports reference deleted `tenantId` fields. Remove references. If a fetch call serializes `tenantId` in body or query, remove it.

- [ ] **Step 2: Find tenantId mentions in test specs**

```bash
grep -n "tenantId" apps/dashboard/test/unit/hooks/use-ratings.spec.tsx apps/dashboard/test/unit/hooks/use-problem-reports.spec.tsx apps/dashboard/test/unit/hooks/use-media.spec.tsx
```

Remove from mock fixtures.

- [ ] **Step 3: Verify**

```bash
grep -rn "tenantId" apps/dashboard/lib/ apps/dashboard/test/ --include="*.ts" --include="*.tsx"
```

Expected: zero.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/api/ apps/dashboard/test/
git commit -m "refactor(dashboard): strip tenantId from api functions + test fixtures"
```

---

## Task F4 — Dashboard full verification

- [ ] **Step 1: Typecheck**

```bash
cd c:\pro\carekit/apps/dashboard
npm run typecheck
```

Expected: 0 errors. If errors appear about missing `tenantId`, grep and fix them.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Unit tests**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 5: Commit any fixes discovered**

If typecheck/lint/tests revealed more tenantId usages, fix them and commit:

```bash
cd c:\pro\carekit
git add apps/dashboard/
git commit -m "fix(dashboard): remove lingering tenantId references found during verification"
```

Otherwise skip this step.

---

## Task F5 — Mobile cleanup

**Files:**
- `apps/mobile/services/*.ts`
- `apps/mobile/.env.example` (if exists)
- `apps/mobile/stores/*.ts`
- `apps/mobile/app.config.ts` or equivalent

- [ ] **Step 1: Find tenant references**

```bash
cd c:\pro\carekit
grep -rln "tenant\|TENANT_ID\|X-Tenant-ID" apps/mobile/ --include="*.ts" --include="*.tsx" --include="*.json"
```

- [ ] **Step 2: For each axios client, remove tenant header**

Typical pattern:

```typescript
// BEFORE
instance.interceptors.request.use((config) => {
  config.headers['X-Tenant-ID'] = TENANT_ID;
  return config;
});

// AFTER (delete the whole line if that's all it did; otherwise remove only the tenant line)
```

- [ ] **Step 3: Remove TENANT_ID env var**

If `.env.example` has `TENANT_ID` or `EXPO_PUBLIC_TENANT_ID`: delete the line. Update `app.config.ts` / `expo-constants` consumers accordingly.

- [ ] **Step 4: Remove tenant from Redux state**

If `stores/` has a `tenantSlice.ts` or tenant fields in a slice: delete the slice or remove the fields. Update selectors.

- [ ] **Step 5: Typecheck mobile**

```bash
cd c:\pro\carekit/apps/mobile
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run mobile tests (if configured)**

```bash
npm run test 2>&1 | tail -10
```

If no test script, skip this step.

- [ ] **Step 7: Commit**

```bash
cd c:\pro\carekit
git add apps/mobile/
git commit -m "refactor(mobile): remove tenant header + env + redux state"
```

---

## Task F6 — Packages cleanup

**Files:**
- `packages/api-client/**`
- `packages/shared/**`

- [ ] **Step 1: Find tenant references in packages**

```bash
cd c:\pro\carekit
grep -rln "tenant\|TENANT_ID\|X-Tenant-ID" packages/ --include="*.ts"
```

- [ ] **Step 2: Clean api-client**

If `api-client` has a base fetch wrapper injecting `X-Tenant-ID`, remove it. If type definitions include `tenantId` in response types, remove those fields.

- [ ] **Step 3: Clean shared**

If `packages/shared/src/types/` has a `TenantId` branded type or `Tenant` interface, delete it. Remove any re-exports from `index.ts`.

- [ ] **Step 4: Build packages**

```bash
cd c:\pro\carekit
npm run build -- --filter=@carekit/api-client --filter=@carekit/shared 2>&1 | tail -15
```

Expected: both build successfully.

- [ ] **Step 5: Commit**

```bash
git add packages/
git commit -m "refactor(packages): remove tenant from api-client + shared"
```

---

## Task F7 — Simplify public branding route (backend)

**Files:**
- `apps/backend/src/api/public/branding.controller.ts`
- `apps/backend/src/api/public/branding.controller.spec.ts`
- `apps/backend/src/api/public/public.module.ts` (usually no change)

- [ ] **Step 1: Read current branding.controller.ts**

Confirm it has a route like `@Get('branding/:tenantId')` that extracts `tenantId` from the URL.

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

Depending on the project's naming, the class name may be `BrandingController` or `PublicBrandingController` — preserve whatever name is in place.

- [ ] **Step 3: Update spec**

Remove any test that passes `:tenantId` parameter. Test now calls `GET /public/branding` with no params.

- [ ] **Step 4: Ensure GetBrandingHandler takes no args**

This is Plan D's responsibility, but confirm: `this.getBranding.execute()` compiles. If it requires an arg, Plan D is not complete and Plan F must block on it. Options:
- If Plan D is complete: proceed.
- If Plan D is not complete: skip Task F7 for now, finish F1-F6, and come back to F7 after Plan D completes.

- [ ] **Step 5: Run tests**

```bash
cd c:\pro\carekit/apps/backend
npx jest src/api/public/branding --runInBand
```

- [ ] **Step 6: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/api/public/branding.controller.ts apps/backend/src/api/public/branding.controller.spec.ts apps/backend/src/api/public/public.module.ts
git commit -m "refactor(public): simplify branding route — drop :tenantId param"
```

---

## Task F7.5 — Clean public catalog + slots controllers

**Files:**
- `apps/backend/src/api/public/catalog.controller.ts` + spec
- `apps/backend/src/api/public/slots.controller.ts` + spec

**Background:** Discovered after Plan D — these public controllers still embed `tenantId` in URL params, query DTOs, and Prisma where clauses. In single-organization mode, public clients (mobile apps, embeddable widgets) hit one deployment = one organization, so no tenant scoping is needed.

- [ ] **Step 1: catalog.controller.ts**

Replace route `@Get(':tenantId')` with `@Get()`. Remove `@Param('tenantId')`. Drop `tenantId` from all three Prisma `where` clauses (services, departments, employees) — keep `isActive: true` and `archivedAt: null` filters.

- [ ] **Step 2: catalog.controller.spec.ts**

Remove tenantId from all test fixtures and route assertions. Test now hits `GET /public/catalog` with no params.

- [ ] **Step 3: slots.controller.ts**

Remove `@IsUUID() tenantId!: string;` from the query DTO. Remove `tenantId: q.tenantId` from the handler call. Verify the underlying slots handler signature already dropped tenantId in Plan B (bookings cluster) — it should have. If not, that is a regression and must be fixed first.

- [ ] **Step 4: slots.controller.spec.ts**

Same cleanup pattern — remove tenantId from fixtures and assertions.

- [ ] **Step 5: Run tests**

```bash
cd c:/pro/carekit/apps/backend
npx jest src/api/public/catalog src/api/public/slots --runInBand
```

Expected: all pass.

- [ ] **Step 6: Verify zero tenant references**

```bash
grep -n "tenantId\|@TenantId" apps/backend/src/api/public/catalog.controller.ts apps/backend/src/api/public/slots.controller.ts
```

Expected: ZERO matches.

- [ ] **Step 7: Commit**

```bash
cd c:/pro/carekit
git add apps/backend/src/api/public/catalog.controller.ts apps/backend/src/api/public/catalog.controller.spec.ts apps/backend/src/api/public/slots.controller.ts apps/backend/src/api/public/slots.controller.spec.ts
git commit -m "refactor(public): drop tenantId from catalog + slots controllers"
```

---

## Task F8 — Final verification for Plan F

- [ ] **Step 1: Zero tenant references in clients**

```bash
cd c:\pro\carekit
grep -rn "tenantId\|TENANT_ID\|X-Tenant-ID" apps/dashboard/ apps/mobile/ packages/ --include="*.ts" --include="*.tsx"
```

Expected: ZERO. (Some `.next/` build artifacts might have legacy references; those regenerate on next build.)

- [ ] **Step 2: Zero in dashboard .env.example**

```bash
grep -E "TENANT_ID" apps/dashboard/.env.example
```

Expected: zero matches.

- [ ] **Step 3: Public branding route is simplified**

```bash
grep -n "@Get" apps/backend/src/api/public/branding.controller.ts
```

Expected: shows `@Get()` with no param (not `@Get('branding/:tenantId')` or similar).

- [ ] **Step 4: Dashboard full verify (repeat from F4)**

```bash
cd c:\pro\carekit/apps/dashboard
npm run typecheck && npm run lint && npm run test && npm run build
```

All pass.

- [ ] **Step 5: Push**

```bash
cd c:\pro\carekit
git push
```

- [ ] **Step 6: Mark Plan F complete**

```
✅ Plan F — Clients + Packages Cleanup — DONE
```

---

## Rollback

Per-task rollback: `git reset --hard HEAD~1`. Re-attempt the task from step 1.

Full rollback of Plan F:
```bash
git log --oneline | head -15
git reset --hard <sha of last commit before Plan F started>
```
