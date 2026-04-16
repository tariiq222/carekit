# Plan C — Handler Cleanup Part 2 (finance, comms, ai non-singleton, ops, media, platform)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Remove `tenantId` from the remaining 6 backend clusters' handlers, controllers, and specs. Additionally, DELETE the entire `platform/license/` folder.

**Architecture:** Same mechanical refactor as Plan B, plus one folder deletion.

**Tech Stack:** NestJS 11 · Prisma 7 · Jest.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Plan A must be COMPLETE.
- You must be on branch `feat/single-organization-mode` OR a sub-branch from it.

**Parallel execution rule:**
- **Plan B and Plan C CAN run in parallel** ONLY if each session uses its OWN sub-branch:
  - Plan C session: `git checkout -b feat/single-org-C-part2 feat/single-organization-mode`
- After BOTH plans finish, merge back to `feat/single-organization-mode` sequentially (B first, then C).
- **If you are running Plan C alone (no Plan B in parallel)**: stay on `feat/single-organization-mode`.
- **Do NOT run Plan D, E, or G while this plan is active.**
- **Plan F (frontend) CAN run in parallel** — separate file trees.

**Completion contract:**
- Plan C is DONE only when:
  1. All 6 clusters have ZERO `tenantId` in handler `.ts` files.
  2. `modules/platform/license/` folder no longer exists.
  3. `platform.module.ts` no longer imports or provides license services.
  4. Cluster-scoped Jest runs pass for each.
  5. All commits pushed.
- **If this session stops mid-cluster:** resume the same cluster in the next session. Do not skip.

---

## Scope — In vs Out

### ✅ In scope

1. **finance (non-zatca-config)** — `modules/finance/**` EXCEPT `modules/finance/zatca/` config handlers + `api/dashboard/finance.controller.ts` + `api/mobile/client/payments.controller.ts`
2. **comms** — `modules/comms/**` + `api/dashboard/comms.controller.ts` + `api/mobile/client/chat.controller.ts` + `api/mobile/client/notifications.controller.ts`
3. **ai (non-chatbot-config)** — `modules/ai/**` EXCEPT `modules/ai/chatbot-config/**` + `api/dashboard/ai.controller.ts` (chatbot-config endpoints NOT touched here)
4. **ops** — `modules/ops/**` + `api/dashboard/ops.controller.ts`
5. **media** — `modules/media/**` + `api/dashboard/media.controller.ts`
6. **platform** — `modules/platform/**` (DELETE `license/` folder; clean feature-flags, integrations, problem-reports) + `api/dashboard/platform.controller.ts`

### ❌ Out of scope

- `modules/ai/chatbot-config/**` → Plan D singleton
- `modules/finance/zatca/` config-specific handlers (e.g., `get-zatca-config.handler.ts`, `upsert-zatca-config.handler.ts`) → Plan D singleton. But `modules/finance/zatca/` handlers for INVOICE submission/generation are in scope here.
- Schema changes → done in Tasks 3-4
- `common/tenant/` deletion → Plan E

---

## Mechanical Pattern

Same as Plan B. See Patterns 1-5 in `plan-b-handler-cleanup-part1.md`. Do not re-read — apply from memory.

---

## Task C1 — Cluster: finance (non-zatca-config)

**Files:**
- `apps/backend/src/modules/finance/**/*.handler.ts` + specs (payments, invoices, coupons, refunds, moyasar-webhook)
- `apps/backend/src/modules/finance/zatca/*.handler.ts` + specs — **ONLY invoice submission/generation**, NOT config (see Step 2 rule below)
- `apps/backend/src/api/dashboard/finance.controller.ts` + spec — remove `@TenantId()` from ALL endpoints including zatca config endpoints (the controller can hand empty args to config handlers which Plan D rewires to singletons)
- `apps/backend/src/api/mobile/client/payments.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
cd c:\pro\carekit/apps/backend
find src/modules/finance -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Identify zatca config handlers to SKIP**

```bash
find src/modules/finance/zatca -name "*.handler.ts"
grep -l "ZatcaConfig\|zatcaConfig" src/modules/finance/zatca/*.handler.ts 2>/dev/null
```

Any handler that touches `prisma.zatcaConfig` in its body is a CONFIG handler → SKIP it (Plan D). Any handler that submits invoices or generates ZATCA XML → CLEAN it now.

- [ ] **Step 3: Apply Patterns 1-5 to in-scope handlers and specs**

- [ ] **Step 4: Apply Pattern 4 to finance.controller.ts**

Remove `@TenantId()` from ALL endpoints. For zatca config endpoints (e.g., `GET /zatca/config`, `POST /zatca/config`), the controller will call `handler.execute()` with no tenantId — this WILL type-error until Plan D rewires those handlers to be parameterless singletons. That's expected. Leave it. It'll resolve in Plan D.

- [ ] **Step 5: Apply Pattern 5 to specs**

For zatca config specs, either skip them with `.skip` and a comment `// Re-enabled after Plan D`, OR delete the tenantId parts and let them fail temporarily. The Plan D subagent will un-skip / rewrite them.

- [ ] **Step 6: Run cluster tests (excluding zatca config specs if skipped)**

```bash
npx jest src/modules/finance src/api/dashboard/finance src/api/mobile/client/payments --runInBand
```

Expected: all pass, except potentially zatca config specs (which should be `.skip`'d).

- [ ] **Step 7: Cluster-scoped typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/finance|src/api/.*finance|payments\.controller" | head -30
```

Expected: errors only in zatca config handlers (Plan D fixes them). Zero in other files.

- [ ] **Step 8: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/modules/finance apps/backend/src/api/dashboard/finance.controller.ts apps/backend/src/api/dashboard/finance.controller.spec.ts apps/backend/src/api/mobile/client/payments.controller.ts apps/backend/src/api/mobile/client/payments.controller.spec.ts
git commit -m "refactor(finance): remove tenantId from payments, invoices, coupons, refunds, zatca (non-config)"
```

---

## Task C2 — Cluster: comms

**Files:**
- `apps/backend/src/modules/comms/**/*.handler.ts` + specs
- `apps/backend/src/api/dashboard/comms.controller.ts` + spec
- `apps/backend/src/api/mobile/client/chat.controller.ts` + spec
- `apps/backend/src/api/mobile/client/notifications.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
find src/modules/comms -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

Special: `EmailTemplate.slug` is now `@unique`. Any `findUnique({ where: { tenantId_slug: {...} } })` → `findUnique({ where: { slug } })`.

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/comms src/api/dashboard/comms src/api/mobile/client/chat src/api/mobile/client/notifications --runInBand
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/comms|src/api/.*(comms|chat|notifications)" | head -20
```

Expected: zero errors in these files.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/comms apps/backend/src/api/dashboard/comms.controller.ts apps/backend/src/api/dashboard/comms.controller.spec.ts apps/backend/src/api/mobile/client/chat.controller.ts apps/backend/src/api/mobile/client/chat.controller.spec.ts apps/backend/src/api/mobile/client/notifications.controller.ts apps/backend/src/api/mobile/client/notifications.controller.spec.ts
git commit -m "refactor(comms): remove tenantId from notifications, email, chat"
```

---

## Task C3 — Cluster: ai (non-chatbot-config)

**Files:**
- `apps/backend/src/modules/ai/chat-completion/**` + specs
- `apps/backend/src/modules/ai/embed-document/**` + specs
- `apps/backend/src/modules/ai/manage-knowledge-base/**` + specs
- `apps/backend/src/modules/ai/semantic-search/**` + specs
- `apps/backend/src/api/dashboard/ai.controller.ts` + spec — touch ALL endpoints including chatbot-config ones (same reasoning as finance: Plan D will fix chatbot-config handlers)

**Explicitly skip:**
- `modules/ai/chatbot-config/**` → Plan D

- [ ] **Step 1: List files**

```bash
find src/modules/ai -name "*.handler.ts" -o -name "*.handler.spec.ts" | grep -v "chatbot-config"
```

- [ ] **Step 2: Apply Patterns 1-5**

Special: `KnowledgeDocument.key` (if it exists and has @unique in the schema) — use single-field where. Check the current schema to confirm.

- [ ] **Step 3: Apply Pattern 4 to ai.controller.ts**

Remove ALL `@TenantId()` including from chatbot-config endpoints. Expect type errors in chatbot-config endpoints (Plan D fixes).

- [ ] **Step 4: Skip chatbot-config specs**

```bash
ls src/modules/ai/chatbot-config/*.spec.ts
```

For each, add `.skip` at the top `describe.skip(...)` with a comment `// Re-enabled after Plan D singleton conversion`.

- [ ] **Step 5: Run cluster tests (excluding chatbot-config)**

```bash
npx jest src/modules/ai --testPathIgnorePatterns="chatbot-config" --runInBand
npx jest src/api/dashboard/ai --runInBand
```

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/ai" | grep -v "chatbot-config" | head -20
```

Expected: zero errors outside chatbot-config.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/modules/ai apps/backend/src/api/dashboard/ai.controller.ts apps/backend/src/api/dashboard/ai.controller.spec.ts
git commit -m "refactor(ai): remove tenantId from chat, embeddings, kb, search"
```

---

## Task C4 — Cluster: ops

**Files:**
- `apps/backend/src/modules/ops/**/*.handler.ts` + specs (generate-report, log-activity, health-check, cron-tasks)
- `apps/backend/src/api/dashboard/ops.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
find src/modules/ops -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/ops src/api/dashboard/ops --runInBand
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/ops|src/api/.*ops" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/ops apps/backend/src/api/dashboard/ops.controller.ts apps/backend/src/api/dashboard/ops.controller.spec.ts
git commit -m "refactor(ops): remove tenantId from reports, activity-log, cron"
```

---

## Task C5 — Cluster: media

**Files:**
- `apps/backend/src/modules/media/**/*.handler.ts` + specs
- `apps/backend/src/api/dashboard/media.controller.ts` + spec

- [ ] **Step 1: List files**

```bash
find src/modules/media -name "*.handler.ts" -o -name "*.handler.spec.ts"
```

- [ ] **Step 2: Apply Patterns 1-5**

`File.storageKey` is now `@unique`. `findUnique({ where: { tenantId_storageKey: {...} } })` → `findUnique({ where: { storageKey } })`.

- [ ] **Step 3: Run cluster tests**

```bash
npx jest src/modules/media src/api/dashboard/media --runInBand
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/media|src/api/.*media" | head -20
```

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/modules/media apps/backend/src/api/dashboard/media.controller.ts apps/backend/src/api/dashboard/media.controller.spec.ts
git commit -m "refactor(media): remove tenantId from file handlers"
```

---

## Task C6 — Cluster: platform (delete license + clean rest)

**Files:**
- **DELETE**: `apps/backend/src/modules/platform/license/` entire folder (4 files)
- Modify: `apps/backend/src/modules/platform/feature-flags/**`
- Modify: `apps/backend/src/modules/platform/integrations/**`
- Modify: `apps/backend/src/modules/platform/problem-reports/**`
- Modify: `apps/backend/src/modules/platform/platform.module.ts`
- Modify: `apps/backend/src/modules/platform/platform.module.spec.ts`
- Modify: `apps/backend/src/api/dashboard/platform.controller.ts` + spec
- Modify: `apps/backend/.env.example`

- [ ] **Step 1: Delete the license folder**

```bash
cd c:\pro\carekit/apps/backend
rm -rf src/modules/platform/license/
ls src/modules/platform/
```

Expected: no `license/` subfolder.

- [ ] **Step 2: Clean platform.module.ts**

Read the file. Remove these import lines:

```typescript
import { ValidateLicenseService } from './license/validate-license.service';
import { CheckFeatureHandler } from './license/check-feature.handler';
```

Remove `ValidateLicenseService` and `CheckFeatureHandler` from `providers:` AND `exports:` arrays.

- [ ] **Step 3: Clean platform.module.spec.ts**

Remove any test that references `ValidateLicenseService` or `CheckFeatureHandler`. Either delete those `it()` blocks entirely or rewrite them against remaining providers.

- [ ] **Step 4: Apply Patterns 1-5 to feature-flags handlers**

- `list-feature-flags.handler.ts`: `findMany({ orderBy: { key: 'asc' } })` — no where, no tenantId.
- `get-feature-flag-map.handler.ts`: same — no where.
- `update-feature-flag.handler.ts`: `where: { key: dto.key }` (key is now globally unique).

- [ ] **Step 5: Apply Patterns 1-5 to integrations handlers**

- `list-integrations.handler.ts`: `findMany()` — no where.
- `upsert-integration.handler.ts`: `upsert({ where: { provider: dto.provider }, ... })`.

- [ ] **Step 6: Apply Patterns 1-5 to problem-reports handlers**

Strip tenantId from create/list/update-status.

- [ ] **Step 7: Clean platform.controller.ts**

Remove all `@TenantId()` params. DELETE any endpoint that was checking license features (e.g., `GET /features/check/:key` if it existed) — it no longer has a handler to call. Remove related imports.

- [ ] **Step 8: Clean .env.example**

Edit `apps/backend/.env.example`. Delete these lines:

```
# License Server (Platform BC)
LICENSE_SERVER_URL=
LICENSE_KEY=
```

- [ ] **Step 9: Update specs**

Apply Pattern 5 to platform specs (feature-flags, integrations, problem-reports, platform.module, platform.controller).

- [ ] **Step 10: Run tests**

```bash
npx jest src/modules/platform src/api/dashboard/platform --runInBand
```

Expected: all pass.

- [ ] **Step 11: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "src/modules/platform|src/api/.*platform|license" | head -20
```

Expected: zero errors.

- [ ] **Step 12: Commit**

```bash
git add apps/backend/src/modules/platform apps/backend/src/api/dashboard/platform.controller.ts apps/backend/src/api/dashboard/platform.controller.spec.ts apps/backend/.env.example
git commit -m "refactor(platform): delete license module + strip tenantId from feature-flags, integrations, problem-reports"
```

---

## Task C7 — Final verification for Plan C

- [ ] **Step 1: Grep for tenantId across scope**

```bash
cd c:\pro\carekit
grep -rn "tenantId\|@TenantId()" apps/backend/src/modules/finance apps/backend/src/modules/comms apps/backend/src/modules/ops apps/backend/src/modules/media apps/backend/src/modules/platform --include="*.ts"
grep -rn "tenantId\|@TenantId()" apps/backend/src/modules/ai --include="*.ts" | grep -v "chatbot-config"
```

Expected: ZERO matches (chatbot-config excluded; Plan D will fix).

- [ ] **Step 2: License folder must be gone**

```bash
ls apps/backend/src/modules/platform/license/ 2>&1
```

Expected: `No such file or directory`.

- [ ] **Step 3: Env vars gone**

```bash
grep -E "LICENSE_SERVER_URL|LICENSE_KEY" apps/backend/.env.example
```

Expected: zero matches.

- [ ] **Step 4: Push**

```bash
git push
```

- [ ] **Step 5: Mark Plan C complete**

```
✅ Plan C — Handler Cleanup Part 2 — DONE
```

---

## Rollback

Same pattern as Plan B. `git reset --hard HEAD~1` per failed cluster task, or restore the entire license folder with `git checkout HEAD -- apps/backend/src/modules/platform/license/` (only works if not yet committed).
