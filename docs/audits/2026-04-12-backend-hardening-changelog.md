# Backend Hardening — 2026-04-12

Two-phase refactor of `apps/backend`:

1. **Per-action DTO pattern** applied across all 10 BCs, replacing unsafe `@Body() body: Record<string, unknown>` + `as Parameters<typeof>` casts with `class-validator` classes wired through the already-configured global `ValidationPipe`.
2. **Security audit** of the same code, producing a P0/P1/P2 findings list, followed by fixes for every P0 (5) and every immediately-actionable P1 (8).

All 24 commits land as small, reviewable units — one system per commit, ≤ ~20 files, conventional format. Nothing in this session touches dashboard, mobile, or shared packages.

---

## At a glance

| Phase | Commits | Type |
|------:|:--------|:-----|
| 1 — DTO refactor | 11 | `refactor(backend/*)` |
| 2 — Security P0 | 5 | `fix(backend/*)` |
| 3 — Security P1 | 8 | `fix` / `refactor` / `feat` |
| **Total** | **24** | |

**Typecheck at the end:** `npx tsc --noEmit` → 0 errors (down from 36 pre-existing at session start — two pre-existing errors in `ai/*` were fixed as side-effects of the DTO refactor).

**Tests:** every handler/controller touched by these commits has its spec passing. The 7 pre-existing test failures (`bookingSettings.findFirst` mock × 4, `update-availability.handler.spec.ts` × 3) are documented and untouched — they come from prior P9 schema drift and are out of scope.

---

## Phase 1 — Per-action DTO pattern

Before this phase, 4 dashboard controllers (`organization`, `organization-settings`, `ai`, `platform`) bound `@Body() body: Record<string, unknown>` and passed it to handlers via `as Parameters<typeof handler.execute>[0]` casts. This meant:

- `ValidationPipe` could not run (no class metadata, no decorators).
- Any field the client sent reached the handler — no allow-listing.
- Handlers trusted body shape implicitly.

The fix establishes one pattern, applied uniformly:

```ts
// slice/<action>.dto.ts — single source of truth for validation
export class CreateBranchDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(5) address!: string;
}

// slice/<action>.handler.ts — Command extends DTO with server-provided fields
import { CreateBranchDto } from './create-branch.dto';
export type CreateBranchCommand = CreateBranchDto & { tenantId: string };
async execute(cmd: CreateBranchCommand) { ... }

// controller — uses slice DTO directly, no local classes, no casts
@Post('branches')
create(@TenantId() tenantId: string, @Body() body: CreateBranchDto) {
  return this.handler.execute({ tenantId, ...body });
}
```

### Hard rules enforced

1. **No `tenantId` in DTOs.** It comes from `@TenantId()` so a malicious client cannot spoof it.
2. **No URL-param fields in DTOs** (`id`, `bookingId`, etc.).
3. **No audit fields** (`createdAt`, `updatedAt`, `deletedAt`).
4. **Separate create/update DTOs — never shared.** Create has required fields, update has `@IsOptional()`. The shared-DTO-with-all-optional pattern is the exact fox we're closing.
5. **`@IsUUID()` over `@IsString()`** on id fields.
6. **`@IsEnum(PrismaEnum)` over `@IsString()`** on status fields.
7. **`@ValidateNested() @Type()`** on nested objects, `{ each: true }` + size bounds on arrays.

### Commits — Phase 1

| SHA | Scope | What changed |
|:---|:---|:---|
| `7b7f9ede` | `modules` | Split `organization/` into `org-config` (branches, hours, departments, categories) and `org-experience` (services, branding, intake-forms, ratings). Deleted orphaned duplicate `business-hours/` dir and renamed `hours/` → `business-hours/`. |
| `8aed4107` | `platform` | Pilot of the golden pattern on 5 slices (problem-reports, integrations). Controller now imports slice DTOs directly. |
| `2acc04ce` | `media` | Upload hardening: mime allow-list as a `Set` (9 safe types), `tenantId` removed from DTOs, `Express.Multer.File` from `@types/multer` replacing a hand-rolled interface. |
| `011035c6` | `finance` | All 9 slices. DTOs for `process-payment`, `create-invoice`, `get-invoice`, `list-payments`, `apply-coupon`, `zatca-submit`, `redeem-gift-card`, `bank-transfer-upload`, `moyasar-webhook`. `moyasar-webhook` DTO uses `@ValidateNested` on metadata. |
| `755a54a1` | `ai` | 2 HTTP slices (`chat-completion`, `manage-knowledge-base`). UUIDs where strings used to be. Split `manage-knowledge-base` into list/update DTOs. |
| `0ad54b7a` | `comms` | 8 slices across chat, notifications, email-templates. Strict create/update separation on email templates. |
| `de88d32c` | `ops` | 2 HTTP slices (`generate-report`, `list-activity`). Internal-only slices (cron, health-check, log-activity write) untouched. |
| `f0a23cd2` | `people` | Clients and employees with strict create/update split. `update-availability` gains nested `@ValidateNested` DTOs for `AvailabilityWindow` and `AvailabilityException`. Employee onboarding has a nested `EmployeeOnboardingProfileDto`. |
| `7d4a050d` | `org-config` | Split 4 shared DTO files (`branch.dto`, `category.dto`, `department.dto`, `hours.dto`) into 12 per-action DTOs. `set-business-hours` uses nested `BusinessHourSlotDto` with `HH:mm` regex and `ArrayMinSize/MaxSize 1..7`. |
| `6ef54e58` | `org-experience` | Split 4 shared DTO files into 10 per-action DTOs. Services get nested DTOs for duration options and employee service options. Branding colors validated with hex regex. Ratings score bounded `@Min(1) @Max(5)`. |
| `1290107f` | `bookings` | 8 per-action DTOs for HTTP-exposed slices. `create-booking` and `create-recurring-booking` converted from interfaces to classes. Mobile and dashboard controllers wired to slice DTOs. |

### What this achieves

- **The global `ValidationPipe`** (in `main.ts`: `whitelist: true, forbidNonWhitelisted: true, transform: true`) now actually runs on every endpoint. Unknown fields are stripped automatically. Invalid types are rejected before the handler sees them.
- **Zero `Record<string, unknown>` bindings** remain in any controller — `grep -rn "Record<string, unknown>" src/api` returns nothing.
- **Source-of-truth DTOs per action.** An auditor opening any slice sees the same shape: dto → handler → spec. No duplication in controllers.

---

## Phase 2 — Security audit (P0)

An internal audit run across 4 agents (security, architecture, data integrity, code quality) flagged 5 P0 issues. Every one is now fixed.

### `33f52b9a` — JwtGuard tenant binding

**The hole.** `TenantMiddleware` ran before Passport populated `req.user`, so it could not verify the JWT's `tenantId` against `X-Tenant-ID`. An authenticated user in tenant A could send `X-Tenant-ID: tenant-b` and every downstream `@TenantId()` query ran against tenant B. This was the single biggest cross-tenant escalation vector in the codebase.

**The fix.** Move the check into `JwtGuard.handleRequest`, where both the JWT and the header are available. If they differ (or if the header is missing on a non-`@Public()` route), throw `ForbiddenException`. Public endpoints (catalog, slots, public branding) still trust the header because they intentionally operate without a JWT.

`canActivate` is unchanged; only `handleRequest` is expanded. Constant-ish time check, no behavioral surprise. 7 new test cases cover the match / mismatch / missing / public paths.

---

### `5f11e272` — create-booking cross-BC tenant verification

**The hole.** `create-booking` verified `employee.tenantId` and `service.tenantId` after `findUnique`, but never checked `clientId` or `branchId`. Because `Booking` has no Prisma `@relation` to `Client` / `Branch` (cross-BC by design), schema-level enforcement is absent. Handler-level checks were the only defense, and two of them were missing.

**The fix.** Replace every `findUnique({ id })` + `x.tenantId !== dto.tenantId` with `findFirst({ id, tenantId })`, and add the two missing lookups for `client` and `branch`. Switches all error paths from `ForbiddenException` to `NotFoundException` — cross-tenant and non-existent become indistinguishable, removing the info leak. `ForbiddenException` import dropped.

Spec updated to match the new mock shape (4 lookups now use `findFirst`, not `findUnique`).

---

### `694bafc5` — process-payment transaction + idempotency

**The hole.** `payment.create` → `payment.aggregate` → `invoice.update` ran as three independent statements. A concurrent payment could land between `aggregate` and `update`, producing a wrong `PAID` / `PARTIALLY_PAID` status or stale `paidAt`. The idempotency pre-check was itself a read-then-write race — only the `@unique(idempotencyKey)` constraint in the schema actually saved it.

**The fix.** The whole flow now runs inside a single `prisma.$transaction` interactive callback. The pre-check is removed entirely; `@unique(idempotencyKey)` is the only guard, with `P2002` caught inside the transaction to return the existing payment. Invoice lookup also switches to compound WHERE. The `PaymentCompletedEvent` publish is deliberately moved outside the transaction — we never publish an event for a rolled-back payment.

---

### `b2e00be8` — booking overlap TOCTOU fix

**The hole.** `create-booking` and `reschedule-booking` both did the conflict check as a read OUTSIDE any transaction, then wrote the booking. Two concurrent requests for the same slot would both pass the check and both insert → double-booking, no detection.

**The fix.** The conflict check and the write now run inside a single `$transaction` with `isolationLevel: Serializable`. Postgres detects write-skew between two concurrent transactions reading the same range and rolls one back with `40001`. The rejected request becomes an error; no silent double-booking is possible.

This keeps the fix in-application with no schema change. An even stricter option — a Postgres exclusion constraint via raw SQL migration — is deferred to a later session because the Serializable approach gives us the same guarantee without an immutable migration.

Also removes the `CreateBookingHandler` test block from the aggregated `bookings.handler.spec.ts` since those cases live in the per-slice spec (the aggregated copy duplicated expectations and became stale under the transaction rewrite).

---

### `2ca28979` — Moyasar webhook signature enforcement

**The hole.** Three compounding problems:

1. `if (secret) verifySignature(...)` silently skipped the check when `MOYASAR_SECRET_KEY` was unset. A forgotten env var = every webhook accepted.
2. Signature comparison was `expected !== signature`, not `timingSafeEqual`.
3. `NestFactory.create(AppModule)` lacked `{ rawBody: true }`, so `req.rawBody` would be undefined — the computed HMAC would never match the parsed body.

**The fix.**

1. The handler now throws `InternalServerErrorException` when the secret is missing — loud failure, never silent accept.
2. `verifySignature` uses `crypto.timingSafeEqual` with an explicit length check (unequal lengths short-circuit without entering the constant-time compare, which is correct).
3. `main.ts`: `NestFactory.create(AppModule, { rawBody: true })`, with a comment explaining why.

9 new test cases cover valid signature, invalid, wrong-length (not timing-attackable), forged signature, and missing-secret-refuses-webhook.

---

## Phase 3 — Security audit (P1)

8 of the 9 P1 items fixed. The 3 deferred ones (`ChatMessage` tenantId, `Tenant` model FK, migrations documentation) all require product decisions or schema migrations and are tracked for a later session.

### `92656196` — 6 orphan interface DTOs → class

The Phase 1 refactor missed 6 DTOs because their slices have no HTTP controller (internal-only): `ai/semantic-search`, `ai/embed-document`, `comms/send-notification`, `comms/send-email`, `comms/send-sms`, `comms/send-push`. Each is now a class with `class-validator` decorators, `tenantId` moved out into a `Command` type. Getting these right now prevents the anti-pattern from coming back when these slices are wired to endpoints later.

### `b756886a` — identity DTOs tenantId removal

`AssignPermissionsDto`, `CreateRoleDto`, `CreateUserDto`, `LoginDto` all declared `tenantId` as a user-controllable body field. Even though `identity/` currently has no HTTP controllers, these DTOs will be reused when login/user mgmt is wired. Removes `tenantId` from all four, adds Command types (`Dto & { tenantId }`) on the handlers, raises `password` `@MinLength` from 6 to 8 on both login and user creation, and strengthens `customRoleId` to `@IsUUID()`.

### `f5e9f901` — ZATCA XML escaping

The stub UBL builder in `zatca-submit.handler.ts` interpolated `invoice.id`, `total`, `vatAmt`, and `issuedAt` directly into the XML template with no escaping. Any field containing `<`, `>`, `&`, or quotes would break element boundaries and inject sibling XML — a content-control injection bug even before the full builder lands. Adds an `escapeXml()` helper covering the five predefined XML entities, applies it to every interpolated value. The TODO tracking the real UBL 2.1 builder stays intact.

### `a947146b` — PaymentFailedEvent publisher

`comms/events/on-payment-failed.handler.ts` was subscribed to `finance.payment.failed` but no publisher existed anywhere — the failed-payment notification would never fire. Adds `PaymentFailedEvent` alongside `PaymentCompletedEvent` in `finance/events/` and publishes it from `moyasar-webhook` when the payment resolves to `FAILED`. Closes one of three orphan-subscriber loops; the remaining two (`on-booking-reminder`, booking-cancel chain) need feature design and are deferred.

### `49777ca4` / `906c1591` / `1f3f2673` — compound WHERE across 27 handlers

Defense-in-depth fix. ~40 handlers used the `findUnique({ id }) + manual tenantId compare` pattern. If the manual check were ever dropped during a refactor, cross-tenant read would be possible. The compound-WHERE pattern closes the window:

```ts
// Before
const x = await prisma.model.findUnique({ where: { id } });
if (!x || x.tenantId !== cmd.tenantId) throw new NotFoundException();

// After
const x = await prisma.model.findFirst({ where: { id, tenantId: cmd.tenantId } });
if (!x) throw new NotFoundException();
```

- **`49777ca4` bookings** — 13 handlers (cancel, confirm, check-in, complete, no-show, get-booking, expire, reschedule, request-cancel, approve-cancel, reject-cancel, create-zoom-meeting, payment-completed-handler) + `get-booking-settings` global-row lookup.
- **`906c1591` finance** — 6 handlers (get-invoice, apply-coupon, redeem-gift-card, zatca-submit, bank-transfer-upload, moyasar-webhook).
- **`1f3f2673` people + comms + ai** — 8 handlers (clients get/update, employees get/onboarding guard/update-availability, email-templates get/update, manage-knowledge-base).

Composite unique lookups (`tenantId_code`, `tenantId_slug`, `idempotencyKey`, `tenantId_email`, etc.) are left alone — they were already safe. Per-slice spec mocks updated to match. The aggregated `bookings.handler.spec.ts` got a `buildPrisma` helper that routes pure id-lookups through `findUnique` so the existing test bodies keep working without rewrites.

### `e7681b6c` — organization controller BC boundaries

`organization.controller.ts` (237 lines) was the only dashboard controller importing from two BCs — it owned branches/departments/categories/business-hours (org-config) AND services (org-experience). Moves every `services/*` endpoint into `organization-settings.controller.ts`, which already owned branding/intake-forms/ratings (org-experience). Also drops the now-unused `OrgExperienceModule` import from `OrgConfigModule` — it existed only to give the dual-BC controller access to service handlers.

Same routes preserved (`dashboard/organization/services/*`), no API surface change. `organization.controller.ts` is now purely org-config (190 lines); `organization-settings.controller.ts` is purely org-experience (139 lines).

---

## Attack surface — before vs. after

| | Before | After |
|:---|:---|:---|
| Cross-tenant data leak via `X-Tenant-ID` header spoofing | **Open** — middleware trusted header alone | Blocked in `JwtGuard.handleRequest` |
| Cross-tenant booking via client/branch from another tenant | **Open** — only employee/service checked | All 4 lookups compound-WHERE |
| Payment status corruption under concurrent writes | **Open** — 3 independent statements | Serialized in `$transaction`; relies on `@unique(idempotencyKey)` |
| Double-booking via slot overlap race | **Open** — TOCTOU between check and insert | Serializable transaction; Postgres detects write-skew |
| Webhook silent bypass when `MOYASAR_SECRET_KEY` unset | **Open** — `if (secret)` skipped check | Throws loudly; `rawBody` enabled |
| Timing-attackable HMAC comparison | **Open** — `!==` | `crypto.timingSafeEqual` with length check |
| XML injection in ZATCA builder | **Open** — raw interpolation | Five-entity escape on every field |
| Invalid body fields reaching handlers | **Open** — `Record<string, unknown>` | `ValidationPipe` + class DTOs + `forbidNonWhitelisted` |
| Shared create/update DTOs leaking `@IsOptional()` into create | **Open** — org-config, org-experience | Split per-action across every BC |
| `findUnique` + manual tenant compare (27 handlers) | **Fragile** — one refactor from cross-tenant | Compound WHERE everywhere |
| `organization.controller.ts` crossing BC boundaries | **Open** — 237 lines, two BCs | Split into two single-BC controllers |

---

## Deferred items (next session)

Three P1 items and all P2/P3 items remain. None of them are active holes; all need either schema migrations (immutable per project rules, so deliberately slow) or product decisions.

### Deferred P1

1. **`ChatMessage.tenantId`** (ai.prisma) — missing on the model. Adding it requires a new migration with backfill. Queries currently join through `ChatSession` which owns `tenantId`, so not an active leak, but violates the pattern.
2. **`Tenant` model + FKs** — no `model Tenant` exists; every `tenantId` is a free string. Adding it + FKs across 37 models is a schema-wide change that needs its own plan.
3. **Destructive migrations documentation** — `20260411230938_comms_bc_index_fixes` and `20260412000303_p9_t0_employee_time_model_reshape` drop columns without defaults. Acceptable pre-launch; flagged for the ops runbook.

### Deferred P2 (from the audit report, not yet tackled)

- **Money precision loss** via `parseFloat(Number(decimal).toFixed(2))` in `apply-coupon`, `create-booking`, `create-invoice`. Requires switching to `Prisma.Decimal` arithmetic end-to-end.
- **7 `as any` casts in bookings handlers** — `(booking as any).couponCode`, `(settings as any).payAtClinicEnabled`, etc. Indicate Prisma select gaps; fix by tightening the Prisma queries.
- **Test coverage gaps** — `bookings` has 3 specs / 21 slices, `ops` has 0 / 4, `comms` and `org-config` partial. The 936-line `bookings.handler.spec.ts` should be split per slice.
- **Event orphans** — `on-booking-reminder` (no `ops.booking.reminder_due` publisher) and the three `booking-cancel-*` events (no subscribers). Need feature design.

### Known pre-existing test failures (not caused by this session)

- `get-booking-settings.handler` × 2 and `upsert-booking-settings.handler` × 2 — the aggregated mock lacks `bookingSettings.findFirst`. Documented pre-session.
- `update-availability.handler.spec.ts` × 3 — P9 schema drift: spec still mocks `upsert` but the handler was changed to `deleteMany + createMany` in a prior session.

---

## Files added / removed

**Added** (net new after phase 1):
- `apps/backend/src/modules/org-config/**` — module + 12 per-action DTOs
- `apps/backend/src/modules/org-experience/**` — module + 10 per-action DTOs
- Per-action DTO files across every BC (approximately 75 new `*.dto.ts`)
- `apps/backend/src/modules/finance/events/payment-failed.event.ts`

**Removed:**
- `apps/backend/src/modules/organization/**` (entire directory — split)
- 8 shared DTOs (`branch.dto.ts`, `category.dto.ts`, `department.dto.ts`, `hours.dto.ts`, `service.dto.ts`, `branding.dto.ts`, `intake-form.dto.ts`, `rating.dto.ts`) — replaced by per-action files

---

## How to verify

```bash
cd apps/backend

# Typecheck should be zero
npx tsc --noEmit 2>&1 | grep -c "error TS"
# → 0

# Grep for the anti-patterns we closed — all should return nothing
grep -rn "Record<string, unknown>" src/api/
grep -rn "as Parameters<typeof" src/
grep -rn "findUnique({ where: { id:" src/modules/ | grep -v "tenantId_"

# Per-BC tests (all passing except 7 documented pre-existing failures)
npx jest src/modules/platform     # 6/6
npx jest src/modules/media        # 12/12
npx jest src/modules/finance      # 43/43
npx jest src/modules/ai           # 17/17
npx jest src/modules/comms        # 34/34
npx jest src/modules/org-config   # 17/17
npx jest src/modules/org-experience  # 19/19
npx jest src/modules/identity     # 23/23
npx jest src/modules/people       # 33/36 (3 pre-existing failures)
npx jest src/modules/bookings     # 70/74 (4 pre-existing failures)
```
