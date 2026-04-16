# Plan D — Singletons + Initial Migration

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Steps use `- [ ]` checkboxes.

**Goal:** Convert 4 config tables (BrandingConfig, OrganizationSettings, ChatbotConfig, ZatcaConfig) from tenant-scoped rows to singletons keyed by fixed id `"default"`. Rewrite their handlers accordingly. Then produce ONE clean initial migration covering all schema changes from Tasks 3-4 + singletons.

**Architecture:** Schema edits add `@default("default")` on singleton ids. Handlers use `upsert({ where: { id: "default" }, ... })`. Prisma migration is generated ONCE, replacing the 41 legacy ones.

**Tech Stack:** Prisma 7 · NestJS 11 · PostgreSQL.

---

## ⚠️ Prerequisites — session rules

**Before you start this plan:**
- Plans A, B, C must all be COMPLETE and merged to `feat/single-organization-mode`. Verify:
  ```bash
  git log --oneline | head -20
  # Expect commits from Plans A, B, C
  grep -rn "tenantId" apps/backend/src/modules/ --include="*.ts" | grep -v "chatbot-config"
  # Must return ZERO outside chatbot-config (which Plan D fixes)
  grep -rn "tenantId" apps/backend/src/modules/ai/chatbot-config/ --include="*.ts"
  # May still have some — this plan will remove them
  ```
- PostgreSQL must be running: `docker ps | grep postgres`. If not: `cd c:\pro\carekit && npm run docker:up`.

**Parallel execution rule:**
- **Plan D CANNOT run in parallel with any other plan** — it changes schema AND generates the initial migration. Everything must be serialized.
- **Plan F (frontend) CAN technically run in parallel** because it doesn't touch backend schema or handlers, but the author strongly recommends serialization: if anything goes wrong in Plan D, you want full attention on it.
- **Do NOT start Plan E until this plan is complete** — Plan E depends on singleton handlers working.

**Completion contract:**
- Plan D is DONE only when:
  1. Schema: 4 singleton models have `id String @id @default("default")`.
  2. Handlers: all 4 singleton modules use `upsert({ where: { id: "default" }, ... })` pattern.
  3. ONE migration folder exists at `apps/backend/prisma/migrations/<timestamp>_initial_single_organization/`.
  4. Migration applies cleanly to fresh DB: `npx prisma migrate reset --force --skip-seed && npx prisma migrate deploy`.
  5. Singleton cluster tests pass.
  6. All commits pushed.
- **If this session stops mid-task:** complete the current task. Do NOT leave schema edits without matching handler edits, and vice versa. If you stopped after schema edit but before handler edit, NEXT SESSION must finish handlers before generating migration.

---

## File Structure

### Files created
- `apps/backend/prisma/migrations/<timestamp>_initial_single_organization/migration.sql` (generated)

### Files modified
**Schema:**
- `apps/backend/prisma/schema/organization.prisma` (BrandingConfig, OrganizationSettings)
- `apps/backend/prisma/schema/ai.prisma` (ChatbotConfig)
- `apps/backend/prisma/schema/finance.prisma` (ZatcaConfig)

**Handlers:**
- `apps/backend/src/modules/org-experience/branding/get-branding.handler.ts` + spec
- `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts` + spec
- `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts` + spec
- `apps/backend/src/modules/org-experience/org-settings/get-org-settings.handler.ts`
- `apps/backend/src/modules/org-experience/org-settings/upsert-org-settings.handler.ts`
- `apps/backend/src/modules/ai/chatbot-config/*.handler.ts` + specs (exact names to discover)
- `apps/backend/src/modules/finance/zatca/*.handler.ts` + specs (config-specific ones)

**Controllers** (re-visit — Plans B/C removed `@TenantId()` already, but singleton handlers now take no args):
- `apps/backend/src/api/dashboard/organization-settings.controller.ts` (if exists) OR wherever branding/settings endpoints live
- `apps/backend/src/api/dashboard/ai.controller.ts` (chatbot-config endpoints)
- `apps/backend/src/api/dashboard/finance.controller.ts` (zatca config endpoints)

### Files NOT touched
- Any non-config handler (done in Plans B/C)
- `common/tenant/` (Plan E)

---

## Singleton Pattern (the template)

All 4 singleton handlers follow this shape. The constant `SINGLETON_ID = 'default'` is the id of the single row. Because the schema has `id String @id @default("default")`, `create` without id works; but we write `{ id: SINGLETON_ID, ... }` explicitly for clarity and to avoid double-inserts if someone manually inserts an alternate id.

### Template — get handler

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

const SINGLETON_ID = 'default';

@Injectable()
export class GetThingConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute() {
    return this.prisma.thingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, /* REQUIRED non-null fields with sensible defaults */ },
      update: {},
    });
  }
}
```

### Template — upsert handler

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertThingConfigDto } from './upsert-thing-config.dto';

const SINGLETON_ID = 'default';

@Injectable()
export class UpsertThingConfigHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: UpsertThingConfigDto) {
    return this.prisma.thingConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto },
      update: dto,
    });
  }
}
```

### Template — spec

```typescript
describe('GetThingConfigHandler', () => {
  it('returns the singleton row, creating it on first call', async () => {
    const mockPrisma = {
      thingConfig: {
        upsert: jest.fn().mockResolvedValue({ id: 'default', /* defaults */ }),
      },
    };
    const handler = new GetThingConfigHandler(mockPrisma as any);
    const result = await handler.execute();
    expect(mockPrisma.thingConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default' }),
      update: {},
    });
    expect(result.id).toBe('default');
  });
});
```

---

## Task D1 — Schema: add `@default("default")` to all 4 singleton ids

**Files:**
- `apps/backend/prisma/schema/organization.prisma`
- `apps/backend/prisma/schema/ai.prisma`
- `apps/backend/prisma/schema/finance.prisma`

- [ ] **Step 1: Read each file and locate the 4 models**

```bash
grep -n "model BrandingConfig\|model OrganizationSettings\|model ChatbotConfig\|model ZatcaConfig" apps/backend/prisma/schema/*.prisma
```

- [ ] **Step 2: Edit each model's `id` line**

For each of the 4 models, change:

```prisma
id String @id @default(uuid())
```

to:

```prisma
id String @id @default("default")
```

If the current line is already just `id String @id` (no default), change to `id String @id @default("default")`.

**Special note for ChatbotConfig:** it may NOT be a true singleton. Re-read it. If it has a `key String @unique` (multi-row key-value store), then it is NOT a singleton — DO NOT add `@default("default")`. Leave the id as `@default(uuid())` or whatever it is, and this table is out of Plan D's singleton scope.

Check:

```bash
grep -A 15 "model ChatbotConfig" apps/backend/prisma/schema/ai.prisma
```

If ChatbotConfig has `key String @unique` and relates to multiple config rows, SKIP it for Task D1. Document this in the commit message. (Plan D will still clean its handlers of tenantId in Task D4.)

- [ ] **Step 3: Validate schema**

```bash
cd c:\pro\carekit/apps/backend
npx prisma format
npx prisma validate
```

Expected: both succeed.

- [ ] **Step 4: Regenerate client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit (schema-only)**

```bash
cd c:\pro\carekit
git add apps/backend/prisma/schema/organization.prisma apps/backend/prisma/schema/ai.prisma apps/backend/prisma/schema/finance.prisma
git commit -m "refactor(schema): singleton ids default to 'default' for config tables"
```

---

## Task D2 — Singleton handlers: BrandingConfig

**Files:**
- `apps/backend/src/modules/org-experience/branding/get-branding.handler.ts`
- `apps/backend/src/modules/org-experience/branding/upsert-branding.handler.ts`
- `apps/backend/src/modules/org-experience/branding/upload-logo/upload-logo.handler.ts`
- All matching `.spec.ts` files

- [ ] **Step 1: Rewrite get-branding.handler.ts**

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
      create: {
        id: SINGLETON_ID,
        clinicNameAr: 'منظمتي',
      },
      update: {},
    });
  }
}
```

- [ ] **Step 2: Rewrite upsert-branding.handler.ts**

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

- [ ] **Step 3: Rewrite upload-logo.handler.ts**

The original likely fetches by tenantId and updates `logoUrl`. Replace with:

```typescript
await this.prisma.brandingConfig.upsert({
  where: { id: 'default' },
  create: { id: 'default', clinicNameAr: 'منظمتي', logoUrl: url },
  update: { logoUrl: url },
});
```

Remove any tenantId from the Command type and method signature.

- [ ] **Step 4: Update specs**

Rewrite branding.handler.spec.ts and upload-logo.handler.spec.ts using the Template above. Remove all tenantId references.

- [ ] **Step 5: Locate and update controllers calling these handlers**

```bash
grep -rln "GetBrandingHandler\|UpsertBrandingHandler\|UploadLogoHandler" apps/backend/src/api/ --include="*.ts"
```

For each matched controller file: ensure the handler call passes NO args to `getBranding.execute()` and only `dto` to `upsertBranding.execute(dto)`.

- [ ] **Step 6: Run branding tests**

```bash
cd c:\pro\carekit/apps/backend
npx jest src/modules/org-experience/branding --runInBand
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/src/modules/org-experience/branding apps/backend/src/api/
git commit -m "refactor(branding): convert to singleton with id='default'"
```

---

## Task D3 — Singleton handlers: OrganizationSettings

**Files:**
- `apps/backend/src/modules/org-experience/org-settings/get-org-settings.handler.ts`
- `apps/backend/src/modules/org-experience/org-settings/upsert-org-settings.handler.ts`
- All matching `.spec.ts` (if exist)
- `apps/backend/src/api/dashboard/organization-settings.controller.ts` + spec

- [ ] **Step 1: Rewrite get-org-settings.handler.ts**

Apply the Get Template. `create:` must include all non-nullable fields from the schema. Read `organization.prisma` → `model OrganizationSettings` to see which fields are non-null and have no `@default`; supply sensible defaults for those.

- [ ] **Step 2: Rewrite upsert-org-settings.handler.ts**

Apply the Upsert Template.

- [ ] **Step 3: Update controller**

```bash
grep -rln "GetOrgSettingsHandler\|UpsertOrgSettingsHandler" apps/backend/src/api/ --include="*.ts"
```

Ensure `.execute()` is called with no args on get, `(dto)` on upsert.

- [ ] **Step 4: Update specs**

- [ ] **Step 5: Run tests**

```bash
npx jest src/modules/org-experience/org-settings src/api/dashboard/organization-settings --runInBand
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/org-experience/org-settings apps/backend/src/api/dashboard/organization-settings.controller.ts apps/backend/src/api/dashboard/organization-settings.controller.spec.ts
git commit -m "refactor(org-settings): convert to singleton with id='default'"
```

---

## Task D4 — ChatbotConfig handlers (strip tenantId; may or may not be singleton)

**Files:**
- `apps/backend/src/modules/ai/chatbot-config/*.handler.ts` + specs
- `apps/backend/src/api/dashboard/ai.controller.ts` (chatbot-config endpoints)

- [ ] **Step 1: List files and inspect schema semantics**

```bash
find apps/backend/src/modules/ai/chatbot-config -name "*.handler.ts" -o -name "*.handler.spec.ts"
grep -A 20 "model ChatbotConfig" apps/backend/prisma/schema/ai.prisma
```

- [ ] **Step 2: Apply the right pattern**

**If ChatbotConfig has `key String @unique` (multi-row key-value store):** use `upsert({ where: { key: entry.key }, create: { key: entry.key, ...entry }, update: entry })` for each config entry. This is NOT a singleton — it's a key-value table.

**If ChatbotConfig has only `id` as unique (true singleton):** use the Upsert Template with `SINGLETON_ID = 'default'`.

- [ ] **Step 3: Update ai.controller.ts chatbot-config endpoints**

Ensure they pass correct args (DTO only, no tenantId).

- [ ] **Step 4: Un-skip the chatbot-config specs that Plan C skipped**

Remove `.skip` from `describe.skip(...)` and rewrite the test bodies using the correct pattern (key-value or singleton per Step 2).

- [ ] **Step 5: Run tests**

```bash
npx jest src/modules/ai/chatbot-config src/api/dashboard/ai --runInBand
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/ai/chatbot-config apps/backend/src/api/dashboard/ai.controller.ts apps/backend/src/api/dashboard/ai.controller.spec.ts
git commit -m "refactor(ai): rewire chatbot-config handlers to key-based or singleton pattern"
```

---

## Task D5 — ZatcaConfig singleton handlers

**Files:**
- `apps/backend/src/modules/finance/zatca/*config*.handler.ts` (config-specific) + specs
- `apps/backend/src/api/dashboard/finance.controller.ts` (zatca config endpoints)

- [ ] **Step 1: Find config handlers**

```bash
find apps/backend/src/modules/finance/zatca -name "*config*.handler.ts"
```

- [ ] **Step 2: Rewrite each using the Get/Upsert Templates**

`SINGLETON_ID = 'default'`. `create` must include non-null fields. Check the schema for required fields.

- [ ] **Step 3: Update finance.controller.ts zatca endpoints**

Ensure they call handlers with the right args.

- [ ] **Step 4: Un-skip zatca config specs that Plan C skipped**

Rewrite using the Singleton Template.

- [ ] **Step 5: Run tests**

```bash
npx jest src/modules/finance/zatca src/api/dashboard/finance --runInBand
```

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/modules/finance/zatca apps/backend/src/api/dashboard/finance.controller.ts apps/backend/src/api/dashboard/finance.controller.spec.ts
git commit -m "refactor(zatca): convert config handlers to singleton with id='default'"
```

---

## Task D6 — Generate the single initial migration

**Files:**
- Create: `apps/backend/prisma/migrations/<timestamp>_initial_single_organization/migration.sql` (generated)

- [ ] **Step 1: Confirm DB is running**

```bash
docker ps | grep postgres
```

If not running: `cd c:\pro\carekit && npm run docker:up`.

- [ ] **Step 2: Delete any previous attempted migration**

```bash
cd c:\pro\carekit/apps/backend
find prisma/migrations -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
ls prisma/migrations/
```

Expected: only `migration_lock.toml`.

- [ ] **Step 3: Reset DB and generate migration in one go**

```bash
npx prisma migrate reset --force --skip-seed
npx prisma migrate dev --name initial_single_organization
```

Expected: migration generated AND applied. New folder under `prisma/migrations/` with SQL inside.

- [ ] **Step 4: Verify SQL contains no tenant references**

```bash
ls prisma/migrations/
grep -i "tenant" prisma/migrations/*initial_single_organization*/migration.sql
```

Expected: zero grep matches.

- [ ] **Step 5: Verify singleton defaults in SQL**

```bash
grep -A 2 "branding_config\|organization_settings\|zatca_config\|chatbot_config" prisma/migrations/*initial_single_organization*/migration.sql | head -40
```

Expected: see `DEFAULT 'default'` on `id` columns for BrandingConfig, OrganizationSettings, ZatcaConfig (and ChatbotConfig if it's a true singleton).

- [ ] **Step 6: Commit**

```bash
cd c:\pro\carekit
git add apps/backend/prisma/migrations/
git commit -m "feat(schema): initial migration for single-organization mode"
```

---

## Task D7 — Final verification for Plan D

- [ ] **Step 1: Grep for tenantId in all handlers (full backend scope)**

```bash
cd c:\pro\carekit
grep -rn "tenantId\|@TenantId()" apps/backend/src/modules/ apps/backend/src/api/ --include="*.ts"
```

Expected: ZERO matches across the entire backend modules + api tree. (Some may remain in `common/tenant/` — that's Plan E's job.)

- [ ] **Step 2: Run the full backend test suite**

```bash
cd c:\pro\carekit/apps/backend
npm run test
```

Expected: all pass. This is the first time since Plan B started that the full backend test suite should be green.

- [ ] **Step 3: Typecheck the WHOLE backend**

```bash
npx tsc --noEmit
```

Expected: zero errors. Again, this is the first time since Task 4 that full backend typecheck should be green (except imports still pointing to `common/tenant/tenant.decorator` — those are Plan E).

```bash
npx tsc --noEmit 2>&1 | grep -vE "tenant.decorator" | grep "error TS"
```

Expected: zero (after filtering tenant.decorator noise).

- [ ] **Step 4: Push**

```bash
git push
```

- [ ] **Step 5: Mark Plan D complete**

```
✅ Plan D — Singletons + Initial Migration — DONE
```

---

## Rollback

If Task D1 (schema) passes but Task D2-D5 fails:
```bash
git reset --hard HEAD~1   # undo most recent handler commit
```
Restart that specific task.

If Task D6 (migration) fails:
```bash
rm -rf apps/backend/prisma/migrations/*_initial_single_organization
# Fix the schema/handler issue causing failure
# Re-run migration generation
```

Full rollback to pre-Plan-D state:
```bash
git log --oneline | head -15
git reset --hard <sha of last Plan C commit>
```
