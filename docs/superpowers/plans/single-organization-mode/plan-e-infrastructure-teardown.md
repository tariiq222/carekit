# Plan E — Infrastructure Teardown (Delete Tenant Folder + Middleware)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Delete the entire `apps/backend/src/common/tenant/` folder, slim down `RequestContext` to keep only `requestId`/`userId`, unwire `TenantMiddleware` from `app.module.ts`, and clean tenantId mentions from logging/filter/guard.

**Architecture:** One folder deleted (6+ files). One slim RequestContext created in `common/http/`. App module no longer wires any tenant middleware.

**Tech Stack:** NestJS 11.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Plans A, B, C, D must ALL be COMPLETE and merged to `feat/single-organization-mode`. Verify:
  ```bash
  grep -rn "@TenantId()" apps/backend/src/ --include="*.ts"
  # Must return ZERO matches
  grep -rn "tenantId" apps/backend/src/modules/ apps/backend/src/api/ --include="*.ts"
  # Must return ZERO matches
  ls apps/backend/prisma/migrations/
  # Must contain exactly one migration folder + migration_lock.toml
  ```
- If any check fails, STOP. Complete missing plans first.

**Parallel execution rule:**
- **Plan E MUST run alone** on the backend. It deletes a folder that anything could be importing.
- **Plan F (frontend) can continue to run in parallel** if it hasn't finished yet.
- **Do NOT start Plan G** until this plan is complete.

**Completion contract:**
- Plan E is DONE only when:
  1. `apps/backend/src/common/tenant/` folder does not exist.
  2. `apps/backend/src/common/http/request-context.ts` exists with slim interface.
  3. `app.module.ts` has no reference to `TenantMiddleware`.
  4. Logging interceptor + HTTP exception filter + JWT guard + current-user decorator have no tenantId.
  5. `npm run build` succeeds.
  6. `npm run test` (backend full suite) passes.
  7. All commits pushed.

---

## File Structure

### Files deleted
- `apps/backend/src/common/tenant/tenant.middleware.ts`
- `apps/backend/src/common/tenant/tenant.middleware.spec.ts`
- `apps/backend/src/common/tenant/tenant.decorator.ts`
- `apps/backend/src/common/tenant/request-context.ts`
- `apps/backend/src/common/tenant/request-context.spec.ts`
- `apps/backend/src/common/tenant/` folder

### Files created
- `apps/backend/src/common/http/request-context.ts` (slim)

### Files modified
- `apps/backend/src/app.module.ts` (remove middleware wiring)
- `apps/backend/src/common/interceptors/logging.interceptor.ts` (import + tenant removal)
- `apps/backend/src/common/filters/http-exception.filter.ts` (import + tenant removal)
- `apps/backend/src/common/guards/jwt.guard.ts` (stop injecting tenantId)
- `apps/backend/src/common/auth/current-user.decorator.ts` (drop tenantId from CurrentUser type)

---

## Task E1 — Create slim RequestContext in new location

**Files:**
- Create: `apps/backend/src/common/http/request-context.ts`

- [ ] **Step 1: Write the new file**

```typescript
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

- [ ] **Step 2: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/common/http/request-context.ts
git commit -m "feat(common): add slim RequestContext in common/http"
```

---

## Task E2 — Update interceptors, filters, guards, decorators

**Files:**
- `apps/backend/src/common/interceptors/logging.interceptor.ts`
- `apps/backend/src/common/filters/http-exception.filter.ts`
- `apps/backend/src/common/guards/jwt.guard.ts`
- `apps/backend/src/common/auth/current-user.decorator.ts`
- Their `*.spec.ts` counterparts if they exist

- [ ] **Step 1: logging.interceptor.ts**

Read file. Change import to:

```typescript
import { RequestContextStorage } from '../http/request-context';
```

Find the log line referring to tenant, e.g.:

```typescript
(context ? ` tenant=${context.tenantId} reqId=${context.requestId}` : '')
```

Change to:

```typescript
(context ? ` reqId=${context.requestId}` : '')
```

- [ ] **Step 2: http-exception.filter.ts**

Read file. Change import to `'../http/request-context'`. Remove any `tenantId` property from the error response payload.

- [ ] **Step 3: jwt.guard.ts**

Read file. If the guard reads `X-Tenant-ID` from the request or attaches `tenantId` to `req.user`, remove those lines. The guard should only attach `id`, `email`, `role` (whatever was there originally minus tenantId).

- [ ] **Step 4: current-user.decorator.ts**

Read file. In the `CurrentUser` interface, delete the line `tenantId: string;`.

- [ ] **Step 5: Update specs**

Each file above may have a `.spec.ts`. Remove any tenantId from mock data and expectations.

```bash
ls apps/backend/src/common/interceptors/*.spec.ts apps/backend/src/common/filters/*.spec.ts apps/backend/src/common/guards/*.spec.ts
```

- [ ] **Step 6: Run related tests**

```bash
cd c:\pro\carekit/apps/backend
npx jest src/common/interceptors src/common/filters src/common/guards src/common/auth --runInBand
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/common/
git commit -m "refactor(common): drop tenantId from logs, filters, guard, current-user"
```

---

## Task E3 — Remove TenantMiddleware from app.module.ts

**Files:**
- `apps/backend/src/app.module.ts`

- [ ] **Step 1: Read app.module.ts**

- [ ] **Step 2: Remove TenantMiddleware wiring**

Delete import:

```typescript
import { TenantMiddleware } from './common/tenant/tenant.middleware';
```

Delete entire `configure()` method if it only wires `TenantMiddleware`:

```typescript
configure(consumer: MiddlewareConsumer) {
  consumer.apply(TenantMiddleware).forRoutes('*');
}
```

If `configure()` wires other middleware too, only remove the `.apply(TenantMiddleware).forRoutes('*')` part. If no `configure()` method has any apply calls left, delete the whole method and `implements NestModule` (and the `MiddlewareConsumer` import).

- [ ] **Step 3: Typecheck**

```bash
cd c:\pro\carekit/apps/backend
npx tsc --noEmit src/app.module.ts
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/app.module.ts
git commit -m "refactor(backend): unwire TenantMiddleware from app.module"
```

---

## Task E4 — Delete the tenant folder

**Files:**
- Delete: `apps/backend/src/common/tenant/` (entire folder)

- [ ] **Step 1: Verify no remaining imports from the folder**

```bash
cd c:\pro\carekit
grep -rn "common/tenant" apps/backend/src/ --include="*.ts"
```

Expected: ZERO matches. If there are any, STOP and fix them first (relocate UserId properly in Plan A, or clean TenantId usage in Plans B/C).

- [ ] **Step 2: Delete the folder**

```bash
cd c:\pro\carekit/apps/backend
rm -rf src/common/tenant/
ls src/common/
```

Expected: no `tenant/` subfolder.

- [ ] **Step 3: Typecheck WHOLE backend**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run full backend test suite**

```bash
npm run test
```

Expected: all pass.

- [ ] **Step 5: Build backend**

```bash
npm run build
```

Expected: success.

- [ ] **Step 6: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/
git commit -m "refactor(common): delete tenant middleware + decorator + context folder"
```

---

## Task E5 — Final verification for Plan E

- [ ] **Step 1: Folder is gone**

```bash
ls apps/backend/src/common/tenant/ 2>&1
```

Expected: `No such file or directory`.

- [ ] **Step 2: Zero tenant imports across backend**

```bash
grep -rn "common/tenant\|TenantMiddleware\|@TenantId" apps/backend/src/ --include="*.ts"
```

Expected: ZERO.

- [ ] **Step 3: Build + test green**

```bash
cd c:\pro\carekit/apps/backend
npm run build
npm run test
```

Both must pass.

- [ ] **Step 4: Push**

```bash
cd c:\pro\carekit
git push
```

- [ ] **Step 5: Mark Plan E complete**

```
✅ Plan E — Infrastructure Teardown — DONE
```

---

## Rollback

If Task E4 deletion breaks something unexpected:

```bash
git reset --hard HEAD~1   # restore the folder
```

Then diagnose the leftover reference and fix it before re-attempting.

Full rollback to pre-Plan-E:
```bash
git log --oneline | head
git reset --hard <sha of last Plan D commit>
```
