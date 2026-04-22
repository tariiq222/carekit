# SaaS-03 Verticals System — Resume Runbook

**For:** tariq (manual executor)
**Branch:** `feat/saas-03-verticals-system`
**Dev DB:** clean, 35 migrations applied, seeded ✅
**PR:** [#25 DRAFT](https://github.com/tariiq222/carekit/pull/25)

## Current state

| What | Status |
|---|---|
| Task 1 — pre-flight audit | ✅ done |
| Task 2 — terminology packs (4 JSON × 19 keys) | ✅ committed (`dc393104`) |
| Task 3 — schema (`Vertical` + 3 seed models + `Organization.verticalId` FK) | ✅ committed (`83060d6d`) |
| Task 4 — migrations (DDL + seed SQL) | ✅ applied to dev + test DBs |
| Task 5 onwards | ⚪ TODO |

## What's left (11 tasks)

The plan file is at `docs/superpowers/plans/2026-04-21-saas-03-verticals-system.md`. The sections below translate it into a mechanical checklist. Each step = one commit.

---

## Task 5: `SuperAdminGuard` stub

**Why stub:** Plan 05b will replace the implementation later. Task 5 just puts the guard in place so the vertical CRUD controllers have something to attach to.

**File:** `apps/backend/src/common/guards/super-admin.guard.ts`

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.isSuperAdmin) {
      throw new ForbiddenException('Super-admin privilege required');
    }
    return true;
  }
}
```

**Spec:** `super-admin.guard.spec.ts` — 2 cases (pass when `isSuperAdmin=true`, throw 403 otherwise).

**Commit:**
```bash
git add apps/backend/src/common/guards/super-admin.guard.ts apps/backend/src/common/guards/super-admin.guard.spec.ts
git commit -m "feat(saas-03): SuperAdminGuard stub (Plan 05b replaces implementation)"
```

---

## Task 6: Platform verticals module — public handlers

**Files:** `apps/backend/src/modules/platform/verticals/`
- `list-verticals.handler.ts` + `.spec.ts`
- `get-vertical.handler.ts` + `.spec.ts`
- `get-terminology.handler.ts` + `.spec.ts`
- `verticals.module.ts`

### `list-verticals.handler.ts`
Public endpoint. Returns all active verticals ordered by `sortOrder`.
```ts
@Injectable()
export class ListVerticalsHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute() {
    return this.prisma.vertical.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
```

### `get-vertical.handler.ts`
By slug. Public.
```ts
async execute(cmd: { slug: string }) {
  const vertical = await this.prisma.vertical.findFirst({
    where: { slug: cmd.slug, isActive: true },
    include: {
      seedDepartments: { orderBy: { sortOrder: 'asc' } },
      seedServiceCategories: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!vertical) throw new NotFoundException(`Vertical '${cmd.slug}' not found`);
  return vertical;
}
```

### `get-terminology.handler.ts`
Merges base family pack with vertical-specific overrides.
```ts
import medicalPack from '@carekit/shared/terminology/medical.json';
import consultingPack from '@carekit/shared/terminology/consulting.json';
import salonPack from '@carekit/shared/terminology/salon.json';
import fitnessPack from '@carekit/shared/terminology/fitness.json';

const PACKS = {
  MEDICAL: medicalPack,
  CONSULTING: consultingPack,
  SALON: salonPack,
  FITNESS: fitnessPack,
};

@Injectable()
export class GetTerminologyHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute(cmd: { verticalSlug: string }) {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug: cmd.verticalSlug },
      include: { terminologyOverrides: true },
    });
    if (!vertical) throw new NotFoundException();
    const basePack = PACKS[vertical.templateFamily];
    // Apply overrides
    const overrides: Record<string, { ar: string; en: string }> = {};
    for (const o of vertical.terminologyOverrides) {
      overrides[o.tokenKey] = { ar: o.valueAr, en: o.valueEn };
    }
    return { ...basePack, ...overrides };
  }
}
```

**Commit after all three handlers:**
```bash
git add apps/backend/src/modules/platform/verticals
git commit -m "feat(saas-03): public verticals handlers (list + get + terminology merge)"
```

---

## Task 7: Super-admin verticals CRUD handlers

Per plan, these go in the same `modules/platform/verticals/` folder:
- `create-vertical.handler.ts`
- `update-vertical.handler.ts`
- `delete-vertical.handler.ts`
- `upsert-terminology-override.handler.ts`
- `upsert-seed-department.handler.ts`
- `upsert-seed-service-category.handler.ts`

Each uses direct `prisma.vertical.*` / `prisma.verticalSeedDepartment.*` (platform-level, no tenant scoping). All need `@UseGuards(SuperAdminGuard)`.

**Skeleton for `create-vertical.handler.ts`:**
```ts
@Injectable()
export class CreateVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}
  async execute(cmd: CreateVerticalCommand) {
    return this.prisma.vertical.create({
      data: {
        slug: cmd.slug,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        templateFamily: cmd.templateFamily,
        description: cmd.description,
        iconUrl: cmd.iconUrl,
        isActive: cmd.isActive ?? true,
        sortOrder: cmd.sortOrder ?? 0,
      },
    });
  }
}
```

**Commit:**
```bash
git add apps/backend/src/modules/platform/verticals
git commit -m "feat(saas-03): super-admin verticals CRUD + seed/override handlers"
```

---

## Task 8: `seed-organization-from-vertical.handler.ts`

The critical cross-cluster handler. Called during org creation (Plan 07 signup wizard will invoke it). Copies seed departments + seed service categories into the new org's scope.

**⚠️ Lesson 11:** inside `$transaction(async (tx) => {...})`, `tx` bypasses the Proxy. Explicit `organizationId` on every `tx.department.create` + `tx.serviceCategory.create`.

**File:** `apps/backend/src/modules/platform/verticals/seed-organization-from-vertical.handler.ts`

```ts
@Injectable()
export class SeedOrganizationFromVerticalHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: { organizationId: string; verticalSlug: string }) {
    const vertical = await this.prisma.vertical.findFirst({
      where: { slug: cmd.verticalSlug, isActive: true },
      include: {
        seedDepartments: true,
        seedServiceCategories: true,
      },
    });
    if (!vertical) throw new NotFoundException(`Vertical '${cmd.verticalSlug}' not found`);

    // Idempotency: if the org already has departments, skip seeding.
    const existingDepartments = await this.prisma.department.count({
      where: { organizationId: cmd.organizationId },
    });
    if (existingDepartments > 0) {
      return { skipped: true, reason: 'already-seeded' };
    }

    return this.prisma.$transaction(async (tx) => {
      for (const seed of vertical.seedDepartments) {
        await tx.department.create({
          data: {
            organizationId: cmd.organizationId, // Lesson 11 — explicit
            nameAr: seed.nameAr,
            nameEn: seed.nameEn,
            sortOrder: seed.sortOrder,
          },
        });
      }
      for (const seed of vertical.seedServiceCategories) {
        await tx.serviceCategory.create({
          data: {
            organizationId: cmd.organizationId, // Lesson 11 — explicit
            nameAr: seed.nameAr,
            nameEn: seed.nameEn,
            sortOrder: seed.sortOrder,
          },
        });
      }
      // Set verticalId on org
      await tx.organization.update({
        where: { id: cmd.organizationId },
        data: { verticalId: vertical.id },
      });
      return {
        verticalId: vertical.id,
        seededDepartments: vertical.seedDepartments.length,
        seededCategories: vertical.seedServiceCategories.length,
      };
    });
  }
}
```

**Commit:**
```bash
git add apps/backend/src/modules/platform/verticals/seed-organization-from-vertical.handler.ts apps/backend/src/modules/platform/verticals/seed-organization-from-vertical.handler.spec.ts
git commit -m "feat(saas-03): seed-organization-from-vertical — idempotent tx-scoped copy"
```

---

## Task 9: Controllers

**Public controller:** `apps/backend/src/api/public/verticals.controller.ts`
```ts
@ApiTags('Public / Platform')
@Controller('public/verticals')
export class PublicVerticalsController {
  constructor(
    private readonly listHandler: ListVerticalsHandler,
    private readonly getHandler: GetVerticalHandler,
    private readonly getTerminology: GetTerminologyHandler,
  ) {}

  @Get() list() { return this.listHandler.execute(); }
  @Get(':slug') get(@Param('slug') slug: string) { return this.getHandler.execute({ slug }); }
  @Get(':slug/terminology') terminology(@Param('slug') slug: string) {
    return this.getTerminology.execute({ verticalSlug: slug });
  }
}
```

**Super-admin controller:** `apps/backend/src/api/admin/verticals.controller.ts`
```ts
@ApiTags('Admin / Platform')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/verticals')
export class AdminVerticalsController {
  constructor(
    private readonly create: CreateVerticalHandler,
    private readonly update: UpdateVerticalHandler,
    private readonly del: DeleteVerticalHandler,
    private readonly upsertTerm: UpsertTerminologyOverrideHandler,
    private readonly upsertDept: UpsertSeedDepartmentHandler,
    private readonly upsertCat: UpsertSeedServiceCategoryHandler,
  ) {}

  @Post() createOne(@Body() dto: CreateVerticalDto) { return this.create.execute(dto); }
  @Patch(':id') updateOne(@Param('id') id: string, @Body() dto: UpdateVerticalDto) {
    return this.update.execute({ id, ...dto });
  }
  @Delete(':id') deleteOne(@Param('id') id: string) { return this.del.execute({ id }); }

  @Put(':id/terminology/:key')
  upsertOverride(@Param('id') id: string, @Param('key') key: string, @Body() dto: { valueAr: string; valueEn: string }) {
    return this.upsertTerm.execute({ verticalId: id, tokenKey: key, ...dto });
  }

  // Similar for seed-dept and seed-category
}
```

**Commit:**
```bash
git add apps/backend/src/api
git commit -m "feat(saas-03): public + admin verticals controllers"
```

---

## Task 10: Wire `VerticalsModule` + register in AppModule

`apps/backend/src/modules/platform/verticals/verticals.module.ts`:
```ts
@Module({
  imports: [PrismaModule],
  controllers: [PublicVerticalsController, AdminVerticalsController],
  providers: [
    ListVerticalsHandler, GetVerticalHandler, GetTerminologyHandler,
    CreateVerticalHandler, UpdateVerticalHandler, DeleteVerticalHandler,
    UpsertTerminologyOverrideHandler, UpsertSeedDepartmentHandler, UpsertSeedServiceCategoryHandler,
    SeedOrganizationFromVerticalHandler,
    SuperAdminGuard,
  ],
  exports: [SeedOrganizationFromVerticalHandler], // Plan 07 will consume this
})
export class VerticalsModule {}
```

Add to `app.module.ts` imports list.

**Commit:**
```bash
git add apps/backend/src/modules/platform/verticals/verticals.module.ts apps/backend/src/app.module.ts
git commit -m "feat(saas-03): wire VerticalsModule"
```

---

## Task 11: Dashboard `useTerminology()` hook

**File:** `apps/dashboard/hooks/use-terminology.ts`
```ts
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useSession } from '@/hooks/use-session';

type TerminologyPack = Record<string, { ar: string; en: string }>;

export function useTerminology() {
  const { data: session } = useSession();
  const verticalSlug = session?.organization?.vertical?.slug;

  const query = useQuery<TerminologyPack>({
    queryKey: ['terminology', verticalSlug],
    queryFn: async () => {
      if (!verticalSlug) return {};
      return apiClient.get(`/public/verticals/${verticalSlug}/terminology`).json();
    },
    enabled: !!verticalSlug,
    staleTime: 30 * 60 * 1000, // 30 min — vertical terminology rarely changes
  });

  const locale = session?.locale ?? 'ar';
  const t = (key: string): string => {
    const token = query.data?.[key];
    if (!token) return key; // Fallback: return key itself
    return token[locale as 'ar' | 'en'] ?? token.ar ?? key;
  };

  return { t, isLoading: query.isLoading, pack: query.data };
}
```

**Spec:** `use-terminology.spec.tsx` with `@testing-library/react-hooks` — mock session + query, assert override-vs-fallback behavior.

**Commit:**
```bash
git add apps/dashboard/hooks/use-terminology.ts apps/dashboard/hooks/use-terminology.spec.tsx
git commit -m "feat(saas-03): dashboard useTerminology hook + test"
```

---

## Task 12: DTOs + validation

Per plan, create these DTOs under `modules/platform/verticals/dto/`:
- `create-vertical.dto.ts`
- `update-vertical.dto.ts`
- `upsert-terminology-override.dto.ts`
- `upsert-seed-department.dto.ts`
- `upsert-seed-service-category.dto.ts`

Use `class-validator` + `@ApiProperty` per backend CLAUDE.md API Documentation Standard.

**Commit:**
```bash
git add apps/backend/src/modules/platform/verticals/dto
git commit -m "feat(saas-03): verticals DTOs + swagger annotations"
```

---

## Task 13: E2E isolation + correctness specs

**Files under `apps/backend/test/e2e/platform/verticals/`:**
- `verticals-public.e2e-spec.ts` — anonymous list/get works, terminology merge returns correct family
- `verticals-admin-authz.e2e-spec.ts` — non-super-admin gets 403 on every admin route
- `seed-organization-from-vertical.e2e-spec.ts` — idempotent, cross-org departments don't leak (leverages 02c SCOPED_MODELS)

Use the isolation harness from `test/e2e/helpers/isolation-harness.ts`.

**Commit:**
```bash
git add apps/backend/test/e2e/platform/verticals
git commit -m "test(saas-03): verticals public + admin + seed-org e2e (3 suites)"
```

---

## Task 14: Run the test gates

```bash
cd apps/backend
npm run typecheck   # must be clean
npm run test        # all unit green
npm run test:e2e -- --testPathPattern=verticals   # all platform e2e green
cd ../dashboard
npm run test -- use-terminology   # frontend spec green
```

If any fails: stop, read the error, fix the failing handler/test, recommit on the same task's branch.

---

## Task 15: Memory + index update

**Create** `/Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas03_status.md`:

```markdown
---
name: SaaS-03 status
description: Plan 03 (Verticals System) delivered YYYY-MM-DD as PR #25 — platform Vertical primitive + 11 seeded verticals + 4 terminology packs + useTerminology hook
type: project
---
**Status:** PR #25 merged.

**Scope delivered:** 4 platform-level models (not in SCOPED_MODELS) — Vertical, VerticalSeedDepartment, VerticalSeedServiceCategory, VerticalTerminologyOverride. Organization.verticalId FK added (nullable, backfilled DEFAULT_ORG → dental). 11 verticals seeded across 4 template families (MEDICAL / CONSULTING / SALON / FITNESS). 19 terminology tokens × 4 packs.

**Why:** Drives vertical-aware clinic setup — new orgs get seed departments + categories + default terminology for their clinic type. Plan 06 (dashboard i18n) refactors existing strings to use `useTerminology()`. Plan 07 (signup) lets clients pick a vertical in the wizard.

**Key decisions:**
- `SuperAdminGuard` is a stub (simple `req.user.isSuperAdmin` check) — Plan 05b will replace with runtime-enforced CLS-gated version without changing call sites.
- `seed-organization-from-vertical` uses `$transaction` callback form (Lesson 11) — explicit `organizationId` on every `tx.*.create` for Department + ServiceCategory (both in SCOPED_MODELS from 02c).
- Terminology merge is base-family + overrides (not inheritance) — keeps overrides additive.
- `useTerminology()` hook uses TanStack Query with 30 min staleTime (terminology rarely changes).

**Test evidence:** N unit + 3 verticals e2e suites + 1 dashboard hook spec.

**Next:** Plan 06 (dashboard terminology refactor) consumes `useTerminology()`. Plan 07 (signup) consumes `list-verticals` + `seed-organization-from-vertical`.
```

**Append to `MEMORY.md`:**
```markdown
- [SaaS-03 status](saas03_status.md) — Plan 03 delivered YYYY-MM-DD PR #25; Verticals System + 11 seeds + 4 terminology packs + useTerminology hook
```

**Update transformation index** `docs/superpowers/plans/2026-04-21-saas-transformation-index.md`:
- Status block: Phase 03 → ✅ MERGED
- Phase map row: status → ✅ DONE, PR link
- Progress log: new row

**Final commit:**
```bash
git add /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/saas03_status.md \
        /Users/tariq/.claude/projects/-Users-tariq-code-carekit/memory/MEMORY.md \
        docs/superpowers/plans/2026-04-21-saas-transformation-index.md
git commit -m "docs(saas-03): memory + index — verticals system delivered"
```

---

## Task 16: Mark PR #25 ready + prepare for merge

```bash
git push origin feat/saas-03-verticals-system
gh pr ready 25
gh pr view 25 --web   # Edit title/body to remove [WIP] and add test counts
```

When you're satisfied: `gh pr merge 25 --squash --delete-branch --admin`.

---

# 🔜 Next after Plan 03 merges

**Sequential chain** (each waits for previous to merge so dev DB state stays linear):

1. **02g** — AI + media + ops + platform cluster rollout (plan ready, 1027 lines). Non-owner-gated. Can use subagent.
2. **02g-sms** — per-tenant SMS provider refactor (plan ready, new file). Non-owner-gated. Blocks Plan 04.
3. **02h** — strict mode + penetration tests ⚠️ owner-gated (canary + per-module rollback; owner approval required in PR body).
4. **04** — Billing & Subscriptions ⚠️ owner-gated Task 1 (Moyasar subscription charging). Blocks 05b.
5. **05b** — Super-admin app ⚠️ owner-gated Task 0 (impersonation design sign-off). Blocks 06.
6. **06** — Dashboard i18n + terminology refactor. Consumes Plan 03's `useTerminology()`.
7. **07** — Marketing + signup. ⚠️ owner-gated Task 0 (`organizationSlug` JWT claim).
8. **08** — Website multi-tenant themes. Consumes Plan 02g's SiteSetting singleton.
9. **09** — Custom domain + Caddy. ⚠️ owner-gated Nginx→Caddy cutover.
10. **10** — Hardening + launch.

**Parallel-safe pairs** (when you want to save time):
- 02g + 02g-sms (different files — comms SMS vs. AI/media/ops) can run sequentially back-to-back
- 05b + 06 need 04 first but 06 also needs 03 — 06 is likely the larger effort

## Dev DB hygiene between plans

Each time you switch to a new feature branch with new migrations:
```bash
git checkout <new-branch>
cd apps/backend
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="[YOUR CONSENT TEXT]" \
  DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_dev" \
  npx prisma migrate reset --force
DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_dev" npm run seed
```

This prevents drift accumulation.

---

## If you hit a snag

- **"relation does not exist" on e2e** — the test DB doesn't have the new migration. Apply with:
  `TEST_DATABASE_URL="postgresql://carekit:carekit_dev_password@localhost:5999/carekit_test" DATABASE_URL=... npx prisma migrate deploy`
- **Typecheck fails after schema change** — run `npx prisma generate` to regenerate the client types.
- **Lesson 11 violation** (`tx.*.create` missing `organizationId`) — check the `$transaction(async (tx) => {...})` bodies in any handler the plan touches.
- **OpenAPI snapshot drift** — `cd apps/backend && npm run openapi:build-and-snapshot` then commit `apps/backend/openapi.json` in the same commit as the controller change.
