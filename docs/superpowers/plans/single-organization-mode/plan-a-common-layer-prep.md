# Plan A — Common Layer Preparation

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Relocate the `@UserId` decorator out of `common/tenant/` into `common/auth/` and update all 28 controller files that import it. This un-entangles `@UserId` from the soon-to-be-deleted tenant folder.

**Architecture:** Mechanical import refactor. One new file, one deleted function, N import line edits.

**Tech Stack:** NestJS 11 · TypeScript.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Confirm you are on branch `feat/single-organization-mode`.
- Confirm Tasks 1-4 of the master plan are complete (check `git log --oneline | head`). You should see commits `2fdb874`, `c1f9c74`, `1c84931`, `c368de5`.
- If any are missing, STOP. Do not proceed. Fix the foundation first.

**While this plan is running:**
- **Do NOT start Plans B, C, D, or E in parallel.** This plan touches 28 controller files; parallel work will cause merge conflicts.
- Plan F (frontend) MAY run in parallel since it touches zero backend files.
- **If this session stops mid-way for any reason (context limit, interruption, error):**
  - STOP. Do not continue into Plan B in the same session.
  - The next session resumes from the unfinished step of this plan, on the same branch.
  - Do not start a new plan until this one reports ✅ in its final checkbox.

**Completion contract:**
- Plan A is DONE only when the final commit is pushed and `grep -rn "from '.*tenant/tenant.decorator'" apps/backend/src/` returns zero matches.
- Until that condition holds, no subsequent plan may start.

---

## File Structure

### Files created
- `apps/backend/src/common/auth/user-id.decorator.ts`

### Files modified
- 28 controllers that currently import from `common/tenant/tenant.decorator`:
  - `apps/backend/src/api/dashboard/ai.controller.ts`
  - `apps/backend/src/api/dashboard/bookings.controller.ts`
  - `apps/backend/src/api/dashboard/comms.controller.ts`
  - `apps/backend/src/api/dashboard/finance.controller.ts`
  - `apps/backend/src/api/dashboard/identity.controller.ts`
  - `apps/backend/src/api/dashboard/media.controller.ts`
  - `apps/backend/src/api/dashboard/ops.controller.ts`
  - `apps/backend/src/api/dashboard/organization-branches.controller.ts`
  - `apps/backend/src/api/dashboard/organization-categories.controller.ts`
  - `apps/backend/src/api/dashboard/organization-departments.controller.ts`
  - `apps/backend/src/api/dashboard/organization-hours.controller.ts`
  - `apps/backend/src/api/dashboard/organization-settings.controller.ts`
  - `apps/backend/src/api/dashboard/people.controller.ts`
  - `apps/backend/src/api/dashboard/platform.controller.ts`
  - `apps/backend/src/api/mobile/client/bookings.controller.ts`
  - `apps/backend/src/api/mobile/client/chat.controller.ts`
  - `apps/backend/src/api/mobile/client/notifications.controller.ts`
  - `apps/backend/src/api/mobile/client/payments.controller.ts`
  - `apps/backend/src/api/mobile/client/portal/home.controller.ts`
  - `apps/backend/src/api/mobile/client/portal/summary.controller.ts`
  - `apps/backend/src/api/mobile/client/portal/upcoming.controller.ts`
  - `apps/backend/src/api/mobile/client/profile.controller.ts`
  - `apps/backend/src/api/mobile/employee/clients.controller.ts`
  - `apps/backend/src/api/mobile/employee/earnings.controller.ts`
  - `apps/backend/src/api/mobile/employee/schedule.controller.ts`
  - `apps/backend/src/api/public/auth.controller.ts`
  - `apps/backend/src/common/guards/jwt.guard.ts` (if it imports @TenantId)

The implementer MUST re-run the discovery grep at step 1 and use THAT list, not this static one, since the exact count may differ slightly.

### Files NOT touched
- `apps/backend/src/common/tenant/tenant.decorator.ts` — stays for now (deleted in Plan E).
- Any handler file — those are touched in Plans B and C.
- Any `.prisma` file — schema is already done in Tasks 3-4.

---

## Task A1 — Create new UserId decorator location

**Files:**
- Create: `apps/backend/src/common/auth/user-id.decorator.ts`

- [ ] **Step 1: Verify preconditions**

```bash
cd c:\pro\carekit
git branch --show-current
git log --oneline | head -5
```

Expected: branch is `feat/single-organization-mode`. Last commits include `c368de5`, `1c84931`, `c1f9c74`, `2fdb874`. If not, STOP.

- [ ] **Step 2: Create the new decorator file**

Write this exact content to `apps/backend/src/common/auth/user-id.decorator.ts`:

```typescript
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

- [ ] **Step 3: Verify file compiles in isolation**

```bash
cd c:\pro\carekit/apps/backend
npx tsc --noEmit src/common/auth/user-id.decorator.ts
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/common/auth/user-id.decorator.ts
git commit -m "feat(common): add @UserId decorator in common/auth"
```

---

## Task A2 — Rewrite imports in every consumer

**Files:** All 28 controllers discovered by grep in step 1 below.

- [ ] **Step 1: Discover all files importing from the old location**

```bash
cd c:\pro\carekit
grep -rln "from '.*tenant/tenant.decorator'" apps/backend/src/ --include="*.ts"
```

Record the exact list. Expect ~28 files.

- [ ] **Step 2: For each file, apply the correct import edit**

The edit depends on what the file imports. Three variants:

**Variant A — file imports BOTH `TenantId` and `UserId`:**

```typescript
// BEFORE
import { TenantId, UserId } from '../../common/tenant/tenant.decorator';

// AFTER
import { TenantId } from '../../common/tenant/tenant.decorator';
import { UserId } from '../../common/auth/user-id.decorator';
```

Keep `TenantId` imported from the old location for now — Plan E deletes the old file, and by then all 172 `@TenantId()` call sites will be cleaned by Plans B/C. Do NOT remove `@TenantId()` usages in this plan.

**Variant B — file imports ONLY `UserId`:**

```typescript
// BEFORE
import { UserId } from '../../common/tenant/tenant.decorator';

// AFTER
import { UserId } from '../../common/auth/user-id.decorator';
```

**Variant C — file imports ONLY `TenantId`:**

No change needed. Skip the file.

**Path adjustment rule:** The relative path (`../../` vs `../../../`) depends on the file's location. Count directory depth from the file to `src/common/auth/`. Files under `src/api/dashboard/` need `../../common/auth/user-id.decorator`. Files under `src/api/mobile/client/` need `../../../common/auth/user-id.decorator`. Files under `src/api/mobile/client/portal/` need `../../../../common/auth/user-id.decorator`. Files under `src/common/guards/` need `../auth/user-id.decorator`.

- [ ] **Step 3: Verify by compile check on affected files**

```bash
cd c:\pro\carekit/apps/backend
npx tsc --noEmit 2>&1 | grep -E "(user-id|UserId|tenant.decorator)" | head -20
```

Expected: zero errors related to UserId imports. There WILL be unrelated errors from other clean-up tasks (handlers still using tenantId in queries) — ignore those; they belong to Plans B/C/D.

- [ ] **Step 4: Verify grep shows decreased usage of old path**

```bash
grep -rln "from '.*tenant/tenant.decorator'" apps/backend/src/ --include="*.ts"
```

Expected: the list is shorter than step 1's list. Every file in the new list should contain ONLY `TenantId` (Variant A's remainder or pure Variant C files). If any file in the list contains `UserId` still imported from tenant.decorator, re-apply the edit.

Double-check with:

```bash
grep -rn "UserId.*from.*tenant" apps/backend/src/ --include="*.ts"
```

Expected: zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/api/ apps/backend/src/common/guards/
git commit -m "refactor(common): migrate @UserId imports to common/auth"
```

---

## Task A3 — Final verification

- [ ] **Step 1: Confirm new location works at runtime (typecheck only — no runtime test yet)**

```bash
cd c:\pro\carekit/apps/backend
npx tsc --noEmit 2>&1 | grep -c "user-id.decorator"
```

Expected: `0` (no errors referencing the new file).

- [ ] **Step 2: Verify zero `UserId` references remain in the old decorator file's consumers**

```bash
grep -rn "UserId.*from.*tenant" apps/backend/src/ --include="*.ts"
```

Expected: zero.

- [ ] **Step 3: Push branch to remote**

```bash
cd c:\pro\carekit
git push
```

Expected: commits pushed successfully.

- [ ] **Step 4: Mark Plan A complete**

```
✅ Plan A — Common Layer Preparation — DONE
```

Next: Plan B and/or Plan C can start (see execution matrix in `README.md`).

---

## Rollback

If something goes wrong mid-plan:

```bash
git reset --hard HEAD~2   # undo both commits from this plan
```

Then restart from Task A1.

If only Task A2 partially completed, `git checkout -- apps/backend/src/api/` to revert controller edits, then restart Task A2.
