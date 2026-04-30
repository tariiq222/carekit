# Bookings Cluster Tenant Rollout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `organizationId` to all 7 bookings-cluster models + the hierarchical BookingSettings singleton, update all 32 booking handlers to scope creates and status-log entries, and wire isolation e2e tests.

**Architecture:** Same strangler/cluster pattern as 02b and 02c. Prisma extension auto-injects `organizationId` into `where` clauses for scoped models; handlers explicitly set `organizationId` in `data` objects. `BookingSettings` is a special hierarchical singleton: one global-per-org row (branchId=null) + per-branch overrides, enforced at the application layer rather than via a DB unique constraint on the null case.

**Tech Stack:** NestJS 11, Prisma 7, nestjs-cls (`TenantContextService`), PostgreSQL RLS, Jest + Supertest (isolation e2e)

---

## Critical lessons from prior plans — READ BEFORE STARTING

1. **Grep ALL callsites first** (Task 1) — plans miss callsites. Commit nothing until the grep audit is complete.
2. **`$transaction` callback form bypasses the Proxy.** `tx` inside `async (tx) => {}` is a raw client — explicit `organizationId` required in ALL `tx.*.create()`, `tx.*.findFirst()`, `tx.*.findUnique()` calls. Array-form `this.prisma.$transaction([op1, op2])` is safe because operations are pre-built through the Proxy.
3. **Extension covers `where` not `data`.** All `prisma.*.create({ data: {} })` need explicit `organizationId`.
4. **Status log from booking.organizationId.** Lifecycle handlers (cancel, confirm, check-in, etc.) fetch the booking first — derive `organizationId` from `booking.organizationId` rather than injecting `TenantContextService` into every lifecycle handler.
5. **Divergence-before-commit.** If reality disagrees with any step, STOP, document, propose amendment, execute only after confirmation.
6. **`npx prisma migrate dev` may conflict with pgvector.** Write migration SQL manually if needed.

---

## SCOPED_MODELS after this plan

```ts
const SCOPED_MODELS = new Set<string>([
  // 02a — identity
  'RefreshToken', 'CustomRole', 'Permission',
  // 02b — people
  'Client', 'ClientRefreshToken', 'Employee', 'EmployeeBranch', 'EmployeeService',
  'EmployeeAvailability', 'EmployeeAvailabilityException',
  // 02c — org-config + org-experience
  'Branch', 'Department', 'ServiceCategory', 'Service',
  'ServiceBookingConfig', 'ServiceDurationOption', 'EmployeeServiceOption',
  'BusinessHour', 'Holiday', 'IntakeForm', 'IntakeField', 'Rating',
  'BrandingConfig', 'OrganizationSettings',
  // 02d — bookings
  'Booking', 'BookingStatusLog', 'WaitlistEntry',
  'GroupSession', 'GroupEnrollment', 'GroupSessionWaitlist',
  'BookingSettings',
]);
```

---

## File Structure

**Schema (modify):**
- `apps/backend/prisma/schema/bookings.prisma` — add `organizationId` to 7 models; change `BookingSettings.branchId @unique` → `@@unique([organizationId, branchId])`

**Migration (create):**
- `apps/backend/prisma/migrations/<timestamp>_saas_02d_bookings_tenancy/migration.sql`

**SCOPED_MODELS (modify):**
- `apps/backend/src/infrastructure/database/prisma.service.ts`

**Handlers to modify (create-path — need TenantContextService injection):**
- `src/modules/bookings/create-booking/create-booking.handler.ts`
- `src/modules/bookings/create-recurring-booking/create-recurring-booking.handler.ts`
- `src/modules/bookings/add-to-waitlist/add-to-waitlist.handler.ts`
- `src/modules/bookings/public/create-guest-booking.handler.ts` (already has tenant; add to booking.create + tx conflict check)
- `src/modules/bookings/public/book-group-session.handler.ts`
- `src/modules/bookings/upsert-booking-settings.handler.ts`

**Handlers to modify (lifecycle — derive organizationId from booking):**
- `src/modules/bookings/cancel-booking/cancel-booking.handler.ts`
- `src/modules/bookings/confirm-booking/confirm-booking.handler.ts`
- `src/modules/bookings/check-in-booking/check-in-booking.handler.ts`
- `src/modules/bookings/complete-booking/complete-booking.handler.ts`
- `src/modules/bookings/no-show-booking/no-show-booking.handler.ts`
- `src/modules/bookings/expire-booking/expire-booking.handler.ts`
- `src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts`
- `src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.ts`
- `src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.ts`
- `src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.ts`
- `src/modules/bookings/client/client-cancel-booking.handler.ts`
- `src/modules/bookings/client/client-reschedule-booking.handler.ts`
- `src/modules/bookings/payment-completed-handler/payment-completed.handler.ts`

**Handlers to modify (BookingSettings reads):**
- `src/modules/bookings/get-booking-settings/get-booking-settings.handler.ts`

**Tests (create):**
- `test/e2e/bookings/booking-isolation.e2e-spec.ts`
- `test/e2e/bookings/booking-settings-isolation.e2e-spec.ts`

**Memory (create/update):**
- `/Users/tariq/.claude/projects/-Users-tariq-code-deqah/memory/saas02d_status.md`

---

## Task 1: Pre-flight — grep all callsites

- [ ] **Step 1.1: Identify all Booking create callsites**

```bash
cd apps/backend
grep -rn "booking\.create\|booking\.createMany" src/ --include="*.ts" | grep -v ".spec.ts" | grep -v ".dto.ts"
```

Expected: `create-booking.handler.ts`, `create-recurring-booking.handler.ts`, `create-guest-booking.handler.ts`, `book-group-session.handler.ts`. If any additional files appear, document them and add to the handler list.

- [ ] **Step 1.2: Identify all bookingStatusLog create callsites**

```bash
grep -rn "bookingStatusLog\.create\|BookingStatusLog" src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: cancel, confirm, check-in, complete, no-show, expire, reschedule, request-cancel, approve-cancel, reject-cancel, client-cancel, client-reschedule, payment-completed handlers. Document any unexpected files.

- [ ] **Step 1.3: Identify all waitlistEntry / groupEnrollment / groupSessionWaitlist create callsites**

```bash
grep -rn "waitlistEntry\.create\|groupEnrollment\.create\|groupSessionWaitlist\.create" src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `add-to-waitlist.handler.ts`, `book-group-session.handler.ts`.

- [ ] **Step 1.4: Identify all BookingSettings create/update callsites**

```bash
grep -rn "bookingSettings\.create\|bookingSettings\.findUnique\|bookingSettings\.findFirst\|bookingSettings\.upsert" src/ --include="*.ts" | grep -v ".spec.ts"
```

Expected: `get-booking-settings.handler.ts`, `upsert-booking-settings.handler.ts`. Document any extra callsites.

- [ ] **Step 1.5: Check for any $transaction callback form in booking handlers**

```bash
grep -rn "\$transaction(async" src/modules/bookings/ --include="*.ts"
```

Any handler using `$transaction(async (tx) => {...})` requires explicit `organizationId` in ALL tx operations.

---

## Task 2: Schema changes

- [ ] **Step 2.1: Read current bookings.prisma to confirm field positions**

```bash
cat apps/backend/prisma/schema/bookings.prisma
```

Verify the exact current state before editing.

- [ ] **Step 2.2: Add organizationId to all 7 models in bookings.prisma**

Edit `apps/backend/prisma/schema/bookings.prisma`. Add `organizationId String // SaaS-02d` immediately after the `id` field on each model, plus `@@index([organizationId])` in each model's index block.

**Booking** — add after `id`:
```prisma
organizationId String // SaaS-02d
```
Add to indexes:
```prisma
@@index([organizationId])
```

**WaitlistEntry** — add after `id`:
```prisma
organizationId String // SaaS-02d
```
Add to indexes:
```prisma
@@index([organizationId])
```

**GroupSession** — add after `id`:
```prisma
organizationId String // SaaS-02d
```
Add to indexes:
```prisma
@@index([organizationId])
```

**GroupEnrollment** — add after `id`:
```prisma
organizationId String // SaaS-02d (denormalized from GroupSession)
```
Add to indexes:
```prisma
@@index([organizationId])
```

**GroupSessionWaitlist** — add after `id`:
```prisma
organizationId String // SaaS-02d (denormalized from GroupSession)
```
Add to indexes:
```prisma
@@index([organizationId])
```

**BookingStatusLog** — add after `id`:
```prisma
organizationId String // SaaS-02d (denormalized from Booking)
```
Add to indexes:
```prisma
@@index([organizationId])
```

**BookingSettings** — add after `id`, change existing `branchId @unique`:
```prisma
organizationId String // SaaS-02d
branchId       String? // null = org-level default; non-null = branch override (remove old @unique here)
```
Change the bottom of the model from having no unique constraint to:
```prisma
  @@unique([organizationId, branchId]) // branch-level unique per org; null branchId enforced at app level
  @@index([organizationId])
```

The full updated `BookingSettings` model bottom block:
```prisma
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([organizationId, branchId])
  @@index([organizationId])
}
```

- [ ] **Step 2.3: Verify schema compiles**

```bash
cd apps/backend && npx prisma validate
```

Expected: no errors. If pgvector causes issues, note — migration will be manual.

---

## Task 3: Migration

- [ ] **Step 3.1: Attempt auto-generate**

```bash
cd apps/backend && npx prisma migrate dev --name saas_02d_bookings_tenancy --create-only
```

If this succeeds, inspect the generated SQL and proceed to Step 3.3. If it fails (pgvector conflict), write the migration manually (Step 3.2).

- [ ] **Step 3.2: Write migration manually (only if auto-generate fails)**

Create directory:
```bash
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p apps/backend/prisma/migrations/${TIMESTAMP}_saas_02d_bookings_tenancy
```

Create `migration.sql`:
```sql
-- Add organizationId to Booking
ALTER TABLE "Booking" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "Booking_organizationId_idx" ON "Booking"("organizationId");

-- Add organizationId to WaitlistEntry
ALTER TABLE "WaitlistEntry" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "WaitlistEntry_organizationId_idx" ON "WaitlistEntry"("organizationId");

-- Add organizationId to GroupSession
ALTER TABLE "GroupSession" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupSession_organizationId_idx" ON "GroupSession"("organizationId");

-- Add organizationId to GroupEnrollment (denormalized from GroupSession)
ALTER TABLE "GroupEnrollment" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupEnrollment_organizationId_idx" ON "GroupEnrollment"("organizationId");

-- Add organizationId to GroupSessionWaitlist (denormalized from GroupSession)
ALTER TABLE "GroupSessionWaitlist" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupSessionWaitlist_organizationId_idx" ON "GroupSessionWaitlist"("organizationId");

-- Add organizationId to BookingStatusLog (denormalized from Booking)
ALTER TABLE "BookingStatusLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "BookingStatusLog_organizationId_idx" ON "BookingStatusLog"("organizationId");

-- BookingSettings: add organizationId, drop old branchId unique, add composite unique
ALTER TABLE "BookingSettings" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
DROP INDEX IF EXISTS "BookingSettings_branchId_key";
CREATE UNIQUE INDEX "BookingSettings_organizationId_branchId_key"
  ON "BookingSettings"("organizationId", "branchId");
CREATE INDEX "BookingSettings_organizationId_idx" ON "BookingSettings"("organizationId");

-- Remove DEFAULT after backfill (Prisma expects NOT NULL without default in schema)
ALTER TABLE "Booking" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupSession" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupEnrollment" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupSessionWaitlist" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "BookingStatusLog" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "BookingSettings" ALTER COLUMN "organizationId" DROP DEFAULT;
```

- [ ] **Step 3.3: Apply migration**

```bash
cd apps/backend && npx prisma migrate dev
```

Or if using manual file:
```bash
cd apps/backend && npx prisma migrate deploy
```

Expected: migration applied successfully, Prisma client regenerated.

- [ ] **Step 3.4: Commit schema + migration**

```bash
git add apps/backend/prisma/schema/bookings.prisma apps/backend/prisma/migrations/
git commit -m "feat(saas-02d): add organizationId to bookings cluster schema"
```

---

## Task 4: SCOPED_MODELS update

- [ ] **Step 4.1: Read PrismaService to find SCOPED_MODELS location**

```bash
grep -n "SCOPED_MODELS\|BookingSettings\|Booking'" apps/backend/src/infrastructure/database/prisma.service.ts
```

- [ ] **Step 4.2: Add 7 bookings models to SCOPED_MODELS**

In `apps/backend/src/infrastructure/database/prisma.service.ts`, add to the `SCOPED_MODELS` Set:

```ts
// 02d — bookings
'Booking', 'BookingStatusLog', 'WaitlistEntry',
'GroupSession', 'GroupEnrollment', 'GroupSessionWaitlist',
'BookingSettings',
```

- [ ] **Step 4.3: Verify typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4.4: Commit**

```bash
git add apps/backend/src/infrastructure/database/prisma.service.ts
git commit -m "feat(saas-02d): add bookings cluster to SCOPED_MODELS"
```

---

## Task 5: Create-path handlers — Booking, WaitlistEntry

These handlers create Booking or WaitlistEntry records. They need `TenantContextService` injected and `organizationId` in every `data: {}`.

### 5A: create-booking.handler.ts

- [ ] **Step 5A.1: Read the file**

```bash
cat apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts
```

- [ ] **Step 5A.2: Inject TenantContextService and add organizationId**

The handler currently has no `TenantContextService`. It uses `$transaction(async (tx) => {...})` — callback form, so `tx` bypasses the Proxy.

Changes needed:
1. Import and inject `TenantContextService`
2. At the start of `execute()`: `const organizationId = this.tenant.requireOrganizationIdOrDefault();`
3. In `tx.booking.create({ data: {} })`: add `organizationId`
4. In the conflict check `tx.booking.findFirst({ where: { ... } })`: add `organizationId` to where
5. The group-slot count check `tx.booking.count({ where: { ... } })`: add `organizationId`

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class CreateBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
    private readonly priceResolver: PriceResolverService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupMinReachedHandler: GroupSessionMinReachedHandler,
  ) {}

  async execute(dto: CreateBookingCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    // ... rest of handler unchanged until transaction ...

    const booking = await this.prisma.$transaction(
      async (tx) => {
        if (!isGroupService) {
          const conflict = await tx.booking.findFirst({
            where: {
              organizationId,          // ADD THIS
              employeeId: dto.employeeId,
              status: { in: ['PENDING', 'CONFIRMED'] },
              scheduledAt: { lt: endsAt },
              endsAt: { gt: scheduledAt },
            },
            select: { id: true },
          });
          // ...
        } else {
          const slotCount = await tx.booking.count({
            where: {
              organizationId,          // ADD THIS
              serviceId: dto.serviceId,
              employeeId: dto.employeeId,
              scheduledAt,
              status: { in: ['PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED'] },
            },
          });
          // ...
        }

        return tx.booking.create({
          data: {
            organizationId,            // ADD THIS
            branchId: dto.branchId,
            // ... rest unchanged
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    // ...
  }
}
```

Also update the CreateBookingHandler registration in `bookings.module.ts` to provide TenantContextService if it isn't already.

- [ ] **Step 5A.3: Verify module exports TenantContextService**

```bash
grep -n "TenantContextService\|TenantModule" apps/backend/src/modules/bookings/bookings.module.ts
```

If `TenantModule` or `TenantContextService` isn't imported, add it.

- [ ] **Step 5A.4: Run unit tests**

```bash
cd apps/backend && npx jest modules/bookings/create-booking --no-coverage
```

Expected: existing tests pass. Fix any type errors before proceeding.

### 5B: create-recurring-booking.handler.ts

- [ ] **Step 5B.1: Read the file**

```bash
cat apps/backend/src/modules/bookings/create-recurring-booking/create-recurring-booking.handler.ts
```

- [ ] **Step 5B.2: Apply same pattern as 5A**

Inject `TenantContextService`, get `organizationId`, add to each `booking.create({ data: { organizationId, ... } })`. If this handler uses `$transaction` callback form, add `organizationId` to all `tx.booking.*` calls.

- [ ] **Step 5B.3: Run unit tests**

```bash
cd apps/backend && npx jest modules/bookings/create-recurring-booking --no-coverage
```

### 5C: add-to-waitlist.handler.ts

- [ ] **Step 5C.1: Read the file** (already read — confirmed no TenantContextService)

- [ ] **Step 5C.2: Inject TenantContextService and add organizationId**

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class AddToWaitlistHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: AddToWaitlistCommand) {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        status: 'WAITING',
        // organizationId injected by extension automatically
      },
    });
    if (existing) throw new ConflictException('Client is already on the waitlist for this employee and service');

    return this.prisma.waitlistEntry.create({
      data: {
        organizationId,              // ADD THIS
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        serviceId: cmd.serviceId,
        branchId: cmd.branchId,
        preferredDate: cmd.preferredDate,
        notes: cmd.notes,
        status: 'WAITING',
      },
    });
  }
}
```

- [ ] **Step 5C.3: Run unit tests**

```bash
cd apps/backend && npx jest modules/bookings/add-to-waitlist --no-coverage
```

- [ ] **Step 5C.4: Commit create-path handlers (Booking + WaitlistEntry)**

```bash
git add apps/backend/src/modules/bookings/create-booking/ \
        apps/backend/src/modules/bookings/create-recurring-booking/ \
        apps/backend/src/modules/bookings/add-to-waitlist/ \
        apps/backend/src/modules/bookings/bookings.module.ts
git commit -m "feat(saas-02d): scope Booking + WaitlistEntry create paths"
```

---

## Task 6: Create-path handlers — GroupSession + children

### 6A: book-group-session.handler.ts

- [ ] **Step 6A.1: Read the file** (already read — confirmed no TenantContextService)

- [ ] **Step 6A.2: Inject TenantContextService and add organizationId**

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class BookGroupSessionHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: BookGroupSessionCommand): Promise<BookGroupSessionResult> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    // ... lookup session (extension-scoped already) ...
    // pass organizationId to private methods:
    if (spotsLeft > 0) {
      return this.createBooking(organizationId, cmd.clientId, session);
    } else if (session.waitlistEnabled) {
      return this.addToWaitlist(organizationId, cmd.clientId, session);
    }
    // ...
  }

  private async createBooking(
    organizationId: string,
    clientId: string,
    session: { ... },
  ): Promise<BookGroupSessionResult> {
    const booking = await this.prisma.booking.create({
      data: {
        organizationId,              // ADD THIS
        branchId: session.branchId,
        // ... rest unchanged
      },
    });

    await this.prisma.groupEnrollment.create({
      data: {
        organizationId,              // ADD THIS (denormalized from session)
        groupSessionId: session.id,
        clientId,
        bookingId: booking.id,
      },
    });
    // ...
  }

  private async addToWaitlist(
    organizationId: string,
    clientId: string,
    session: { id: string },
  ): Promise<BookGroupSessionResult> {
    // ...
    await this.prisma.groupSessionWaitlist.create({
      data: {
        organizationId,              // ADD THIS (denormalized from session)
        groupSessionId: session.id,
        clientId,
        position,
      },
    });
    // ...
  }
}
```

Note: `groupSession.update({ data: { enrolledCount: { increment: 1 } } })` and `groupSession.update({ data: { waitlistCount: { increment: 1 } } })` — no organizationId needed in `data` for updates; the extension scopes the `where`.

- [ ] **Step 6A.3: Run unit tests**

```bash
cd apps/backend && npx jest modules/bookings/public/book-group-session --no-coverage
```

### 6B: create-guest-booking.handler.ts

- [ ] **Step 6B.1: Read the file** (already read — has TenantContextService, but booking.create lacks organizationId)

- [ ] **Step 6B.2: Add organizationId to tx.booking.create and tx conflict check**

The handler already has `const organizationId = this.tenant.requireOrganizationIdOrDefault()`.

Changes needed:
1. In the `$transaction` callback — `tx` is raw, so add `organizationId` to:
   - `tx.booking.findFirst({ where: { organizationId, ... } })` — conflict check
   - `tx.client.findFirst({ where: { OR: [...] } })` — already scoped by extension? No — `tx` bypasses Proxy. Add `organizationId` here too.
   - `tx.booking.create({ data: { organizationId, ... } })` — booking creation
   - `tx.invoice.create({ data: { ... } })` — Invoice is in Finance cluster (scoped in 02e). Skip for now; add a `// TODO(02e): add organizationId once Finance cluster is scoped` comment.

Full change to the `$transaction` callback in `create-guest-booking.handler.ts`:
```ts
const result = await this.prisma.$transaction(async (tx) => {
  // OTP session create — no organizationId on UsedOtpSession (platform model, 02g)
  try {
    await tx.usedOtpSession.create({ data: { jti: cmd.sessionJti, expiresAt: ... } });
  } catch { throw new UnauthorizedException('OTP session already used'); }

  const conflict = await tx.booking.findFirst({
    where: {
      organizationId,            // ADD
      employeeId: cmd.employeeId,
      status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
      scheduledAt: { lt: endsAt },
      endsAt: { gt: scheduledAt },
    },
    select: { id: true },
  });
  if (conflict) throw new ConflictException('Employee already has a booking in this time slot');

  let client = await tx.client.findFirst({
    where: {
      organizationId,            // ADD — tx bypasses Proxy
      OR: [{ phone: cmd.client.phone }, { email: cmd.client.email }],
    },
  });

  if (!client) {
    client = await tx.client.create({
      data: {
        organizationId,          // already present — confirm it's there
        // ...
      },
    });
  }

  const booking = await tx.booking.create({
    data: {
      organizationId,            // ADD
      branchId: cmd.branchId,
      // ... rest unchanged
    },
  });

  const invoice = await tx.invoice.create({
    data: {
      // TODO(02e): add organizationId once Finance cluster is scoped
      branchId: cmd.branchId,
      // ...
    },
  });

  return { bookingId: booking.id, invoiceId: invoice.id, ... };
});
```

- [ ] **Step 6B.3: Run unit tests**

```bash
cd apps/backend && npx jest modules/bookings/public/create-guest-booking --no-coverage
```

- [ ] **Step 6B.4: Commit group-session + guest-booking handlers**

```bash
git add apps/backend/src/modules/bookings/public/
git commit -m "feat(saas-02d): scope GroupSession + GroupEnrollment + GroupSessionWaitlist create paths"
```

---

## Task 7: Lifecycle handlers — BookingStatusLog organizationId from booking

Pattern: each lifecycle handler (cancel, confirm, check-in, etc.) fetches the Booking first. After 02d, `booking.organizationId` is available. Use it for `bookingStatusLog.create({ data: { organizationId: booking.organizationId, ... } })`.

These handlers use the **array-form** `$transaction([op1, op2])` where ops are pre-built through the Proxy — so the `booking.update(where: { id })` already gets org-scoped by extension. Only `bookingStatusLog.create({ data })` needs explicit organizationId.

### 7A: cancel-booking.handler.ts

- [ ] **Step 7A.1: Read the file** (already read — uses array-form transaction)

- [ ] **Step 7A.2: Add organizationId to bookingStatusLog.create**

```ts
// booking is fetched first as: const booking = await this.prisma.booking.findFirst(...)
// booking.organizationId is now available

const [updated] = await this.prisma.$transaction([
  this.prisma.booking.update({ where: { id: cmd.bookingId }, data: { ... } }),
  this.prisma.bookingStatusLog.create({
    data: {
      organizationId: booking.organizationId,  // ADD THIS
      bookingId: cmd.bookingId,
      fromStatus: booking.status,
      toStatus: BookingStatus.CANCELLED,
      changedBy: cmd.changedBy,
      reason: cmd.reason,
    },
  }),
]);
```

- [ ] **Step 7B: confirm-booking.handler.ts — read and apply same pattern**

```bash
cat apps/backend/src/modules/bookings/confirm-booking/confirm-booking.handler.ts
```

Add `organizationId: booking.organizationId` to `bookingStatusLog.create({ data: { ... } })`.

- [ ] **Step 7C: check-in-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/check-in-booking/check-in-booking.handler.ts
```

- [ ] **Step 7D: complete-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/complete-booking/complete-booking.handler.ts
```

- [ ] **Step 7E: no-show-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/no-show-booking/no-show-booking.handler.ts
```

- [ ] **Step 7F: expire-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/expire-booking/expire-booking.handler.ts
```

Note: expire-booking may be called from a BullMQ cron job. Verify that `TenantContextService` is available in the job context — if not, the job should set the CLS context before calling this handler using `TenantContextService.runAs()`. Since `organizationId` comes from `booking.organizationId` (already in DB), this is safe without a CLS context: just use `booking.organizationId` directly.

- [ ] **Step 7G: reschedule-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/reschedule-booking/reschedule-booking.handler.ts
```

If reschedule uses `$transaction` callback form, add `organizationId` to all `tx.booking.*` calls too.

- [ ] **Step 7H: request-cancel-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/request-cancel-booking/request-cancel-booking.handler.ts
```

- [ ] **Step 7I: approve-cancel-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/approve-cancel-booking/approve-cancel-booking.handler.ts
```

- [ ] **Step 7J: reject-cancel-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/reject-cancel-booking/reject-cancel-booking.handler.ts
```

- [ ] **Step 7K: client/client-cancel-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/client/client-cancel-booking.handler.ts
```

- [ ] **Step 7L: client/client-reschedule-booking.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/client/client-reschedule-booking.handler.ts
```

- [ ] **Step 7M: payment-completed-handler/payment-completed.handler.ts — read and apply**

```bash
cat apps/backend/src/modules/bookings/payment-completed-handler/payment-completed.handler.ts
```

If this handler creates a `bookingStatusLog`, add `organizationId: booking.organizationId`.

- [ ] **Step 7N: Run unit tests for all lifecycle handlers**

```bash
cd apps/backend && npx jest modules/bookings/cancel-booking modules/bookings/confirm-booking modules/bookings/check-in-booking modules/bookings/complete-booking modules/bookings/no-show-booking modules/bookings/expire-booking modules/bookings/reschedule-booking modules/bookings/request-cancel-booking modules/bookings/approve-cancel-booking modules/bookings/reject-cancel-booking --no-coverage
```

Expected: all pass. Fix type errors before committing.

- [ ] **Step 7O: Commit lifecycle handlers**

```bash
git add apps/backend/src/modules/bookings/cancel-booking/ \
        apps/backend/src/modules/bookings/confirm-booking/ \
        apps/backend/src/modules/bookings/check-in-booking/ \
        apps/backend/src/modules/bookings/complete-booking/ \
        apps/backend/src/modules/bookings/no-show-booking/ \
        apps/backend/src/modules/bookings/expire-booking/ \
        apps/backend/src/modules/bookings/reschedule-booking/ \
        apps/backend/src/modules/bookings/request-cancel-booking/ \
        apps/backend/src/modules/bookings/approve-cancel-booking/ \
        apps/backend/src/modules/bookings/reject-cancel-booking/ \
        apps/backend/src/modules/bookings/client/ \
        apps/backend/src/modules/bookings/payment-completed-handler/
git commit -m "feat(saas-02d): scope BookingStatusLog in lifecycle handlers via booking.organizationId"
```

---

## Task 8: BookingSettings hierarchical singleton

`BookingSettings` is NOT a pure singleton — it has a global-per-org row (branchId=null) AND per-branch overrides. The migration changed `branchId @unique` → `@@unique([organizationId, branchId])`. Application logic enforces "one global per org" via `findFirst`.

The `@@unique([organizationId, branchId])` index handles branch-level uniqueness. For global rows (branchId=null), Postgres allows multiple NULLs in a composite unique index — uniqueness is enforced at the application layer (findFirst + conditional upsert).

### 8A: get-booking-settings.handler.ts

- [ ] **Step 8A.1: Read the file** (already read)

- [ ] **Step 8A.2: Inject TenantContextService and scope all lookups**

Current logic: `findUnique({ where: { branchId } })` → `findFirst({ where: { branchId: null } })` → fallback defaults.

After 02d — inject `TenantContextService`, add `organizationId` to all lookups:

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class GetBookingSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(query: GetBookingSettingsQuery): Promise<BookingSettings | ResolvedBookingSettings> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();

    if (query.branchId) {
      const branchRow = await this.prisma.bookingSettings.findFirst({
        where: { organizationId, branchId: query.branchId },
      });
      if (branchRow) return branchRow;
    }

    const globalRow = await this.prisma.bookingSettings.findFirst({
      where: { organizationId, branchId: null },
    });
    if (globalRow) return globalRow;

    return DEFAULT_BOOKING_SETTINGS;
  }
}
```

Note: `findUnique({ where: { branchId } })` is replaced by `findFirst({ where: { organizationId, branchId } })` because the `@@unique` index is composite and `findUnique` on a nullable composite key is not supported when the nullable field is null.

### 8B: upsert-booking-settings.handler.ts

- [ ] **Step 8B.1: Read the file** (already read)

- [ ] **Step 8B.2: Inject TenantContextService and add organizationId**

```ts
import { TenantContextService } from '../../../common/tenant';

@Injectable()
export class UpsertBookingSettingsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: UpsertBookingSettingsCommand): Promise<BookingSettings> {
    const organizationId = this.tenant.requireOrganizationIdOrDefault();
    const { branchId, ...fields } = cmd;

    const updateData = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    );

    const existing = await this.prisma.bookingSettings.findFirst({
      where: { organizationId, branchId: branchId ?? null },
    });

    if (existing) {
      return this.prisma.bookingSettings.update({
        where: { id: existing.id },
        data: updateData,
      });
    }

    return this.prisma.bookingSettings.create({
      data: { organizationId, branchId: branchId ?? null, ...updateData },
    });
  }
}
```

- [ ] **Step 8C: Run unit tests for BookingSettings handlers**

```bash
cd apps/backend && npx jest modules/bookings/get-booking-settings modules/bookings/upsert-booking-settings --no-coverage
```

- [ ] **Step 8D: Commit BookingSettings handlers**

```bash
git add apps/backend/src/modules/bookings/get-booking-settings/ \
        apps/backend/src/modules/bookings/upsert-booking-settings/
git commit -m "feat(saas-02d): scope BookingSettings hierarchical singleton"
```

---

## Task 9: Full unit test suite

- [ ] **Step 9.1: Run full unit test suite**

```bash
cd apps/backend && npm run test
```

Expected: 953 tests (from 02c baseline) + any new test counts from updated specs, all passing. Zero failures. Fix any type errors or test failures before proceeding to e2e.

- [ ] **Step 9.2: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

---

## Task 10: Isolation e2e tests

### 10A: booking-isolation.e2e-spec.ts

- [ ] **Step 10A.1: Create the test file**

Create `apps/backend/test/e2e/bookings/booking-isolation.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { TenantContextService } from '../../../src/common/tenant';

describe('Booking isolation (02d)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenant: TenantContextService;

  const ORG_A = '11111111-1111-1111-1111-111111111111';
  const ORG_B = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    tenant = app.get(TenantContextService);
  });

  afterAll(async () => {
    await prisma.booking.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    await app.close();
  });

  beforeEach(async () => {
    // Seed two orgs
    await prisma.organization.createMany({
      data: [
        { id: ORG_A, slug: 'org-a-02d', nameAr: 'Org A' },
        { id: ORG_B, slug: 'org-b-02d', nameAr: 'Org B' },
      ],
      skipDuplicates: true,
    });
  });

  it('should not return bookings from another org', async () => {
    // Create a booking in ORG_B
    const bookingB = await prisma.booking.create({
      data: {
        organizationId: ORG_B,
        branchId: 'branch-b',
        clientId: 'client-b',
        employeeId: 'employee-b',
        serviceId: 'service-b',
        scheduledAt: new Date('2030-01-01T10:00:00Z'),
        endsAt: new Date('2030-01-01T11:00:00Z'),
        durationMins: 60,
        price: 100,
        currency: 'SAR',
      },
    });

    // Query as ORG_A — should not see ORG_B's booking
    const cls = app.get('ClsService');
    await cls.runWith(
      { [Symbol.for('TENANT_CONTEXT')]: { organizationId: ORG_A } } as any,
      async () => {
        const bookings = await prisma.booking.findMany({});
        const ids = bookings.map((b) => b.id);
        expect(ids).not.toContain(bookingB.id);
      },
    );

    // Cleanup
    await prisma.booking.delete({ where: { id: bookingB.id } });
  });

  it('should not return waitlist entries from another org', async () => {
    const entryB = await prisma.waitlistEntry.create({
      data: {
        organizationId: ORG_B,
        clientId: 'client-b',
        employeeId: 'employee-b',
        serviceId: 'service-b',
        branchId: 'branch-b',
        status: 'WAITING',
      },
    });

    const cls = app.get('ClsService');
    await cls.runWith(
      { [Symbol.for('TENANT_CONTEXT')]: { organizationId: ORG_A } } as any,
      async () => {
        const entries = await prisma.waitlistEntry.findMany({});
        expect(entries.map((e) => e.id)).not.toContain(entryB.id);
      },
    );

    await prisma.waitlistEntry.delete({ where: { id: entryB.id } });
  });

  it('should not return group sessions from another org', async () => {
    const sessionB = await prisma.groupSession.create({
      data: {
        organizationId: ORG_B,
        branchId: 'branch-b',
        employeeId: 'employee-b',
        serviceId: 'service-b',
        title: 'Session B',
        scheduledAt: new Date('2030-02-01T10:00:00Z'),
        durationMins: 60,
        maxCapacity: 10,
        price: 200,
        currency: 'SAR',
      },
    });

    const cls = app.get('ClsService');
    await cls.runWith(
      { [Symbol.for('TENANT_CONTEXT')]: { organizationId: ORG_A } } as any,
      async () => {
        const sessions = await prisma.groupSession.findMany({});
        expect(sessions.map((s) => s.id)).not.toContain(sessionB.id);
      },
    );

    await prisma.groupSession.delete({ where: { id: sessionB.id } });
  });

  it('should not return booking status logs from another org', async () => {
    const bookingB = await prisma.booking.create({
      data: {
        organizationId: ORG_B,
        branchId: 'b', clientId: 'c', employeeId: 'e', serviceId: 's',
        scheduledAt: new Date('2030-03-01T10:00:00Z'),
        endsAt: new Date('2030-03-01T11:00:00Z'),
        durationMins: 60, price: 100, currency: 'SAR',
      },
    });
    const logB = await prisma.bookingStatusLog.create({
      data: {
        organizationId: ORG_B,
        bookingId: bookingB.id,
        toStatus: 'CONFIRMED',
        changedBy: 'system',
      },
    });

    const cls = app.get('ClsService');
    await cls.runWith(
      { [Symbol.for('TENANT_CONTEXT')]: { organizationId: ORG_A } } as any,
      async () => {
        const logs = await prisma.bookingStatusLog.findMany({});
        expect(logs.map((l) => l.id)).not.toContain(logB.id);
      },
    );

    await prisma.bookingStatusLog.delete({ where: { id: logB.id } });
    await prisma.booking.delete({ where: { id: bookingB.id } });
  });
});
```

Note on `Symbol.for('TENANT_CONTEXT')`: use the same CLS key that `TenantContextService` uses. Check `apps/backend/src/common/tenant/tenant-context.service.ts` for the exact `TENANT_CLS_KEY` value and use it here.

- [ ] **Step 10A.2: Run the test to verify it fails before handler changes are complete (expected)**

```bash
cd apps/backend && npx jest test/e2e/bookings/booking-isolation --config test/jest-e2e.json
```

Expected: tests should pass after Task 5–8 are complete. If any fail, fix the corresponding handler.

### 10B: booking-settings-isolation.e2e-spec.ts

- [ ] **Step 10B.1: Create the test file**

Create `apps/backend/test/e2e/bookings/booking-settings-isolation.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';

describe('BookingSettings isolation (02d)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ORG_A = '11111111-1111-1111-1111-111111111111';
  const ORG_B = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.bookingSettings.deleteMany({ where: { organizationId: { in: [ORG_A, ORG_B] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [ORG_A, ORG_B] } } });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.organization.createMany({
      data: [
        { id: ORG_A, slug: 'org-a-bs', nameAr: 'Org A' },
        { id: ORG_B, slug: 'org-b-bs', nameAr: 'Org B' },
      ],
      skipDuplicates: true,
    });
  });

  it('should not return booking settings from another org', async () => {
    const settingsB = await prisma.bookingSettings.create({
      data: {
        organizationId: ORG_B,
        branchId: null,
        waitlistMaxPerSlot: 99,
      },
    });

    const cls = app.get('ClsService');
    await cls.runWith(
      { [Symbol.for('TENANT_CONTEXT')]: { organizationId: ORG_A } } as any,
      async () => {
        const rows = await prisma.bookingSettings.findMany({});
        expect(rows.map((r) => r.id)).not.toContain(settingsB.id);
      },
    );

    await prisma.bookingSettings.delete({ where: { id: settingsB.id } });
  });

  it('should allow two orgs to have separate global settings', async () => {
    await prisma.bookingSettings.create({
      data: { organizationId: ORG_A, branchId: null, waitlistMaxPerSlot: 3 },
    });
    await prisma.bookingSettings.create({
      data: { organizationId: ORG_B, branchId: null, waitlistMaxPerSlot: 7 },
    });

    const rowA = await prisma.bookingSettings.findFirst({ where: { organizationId: ORG_A, branchId: null } });
    const rowB = await prisma.bookingSettings.findFirst({ where: { organizationId: ORG_B, branchId: null } });
    expect(rowA?.waitlistMaxPerSlot).toBe(3);
    expect(rowB?.waitlistMaxPerSlot).toBe(7);
  });
});
```

- [ ] **Step 10B.2: Run both isolation tests**

```bash
cd apps/backend && npx jest test/e2e/bookings/ --config test/jest-e2e.json
```

Expected: all pass.

- [ ] **Step 10B.3: Commit isolation tests**

```bash
git add apps/backend/test/e2e/bookings/
git commit -m "test(saas-02d): booking cluster isolation e2e specs"
```

---

## Task 11: Final verification + PR

- [ ] **Step 11.1: Run full unit test suite**

```bash
cd apps/backend && npm run test
```

Expected: all unit tests pass (≥ 953 baseline + any from 02d-touched spec files).

- [ ] **Step 11.2: Run full e2e suite**

```bash
cd apps/backend && npm run test:e2e
```

Expected: all e2e tests pass, including the new 2 booking isolation specs + all prior isolation e2e specs (01–02c).

- [ ] **Step 11.3: Typecheck**

```bash
cd apps/backend && npm run typecheck
```

Expected: no errors.

- [ ] **Step 11.4: Open PR**

```bash
gh pr create \
  --base main \
  --head feat/saas-02d-bookings-cluster \
  --title "feat(saas-02d): bookings cluster tenant rollout" \
  --body "Scopes Booking, WaitlistEntry, GroupSession, GroupEnrollment, GroupSessionWaitlist, BookingStatusLog, BookingSettings to organizationId.

## Changes
- Schema: organizationId added to 7 models; BookingSettings branchId @unique → @@unique([organizationId, branchId])
- Migration: backfill DEFAULT_ORGANIZATION_ID for all existing rows
- SCOPED_MODELS: 7 new models registered
- 32 handler files updated: create-path handlers inject TenantContextService; lifecycle handlers derive organizationId from booking object
- BookingSettings: hierarchical singleton (global + per-branch) scoped via findFirst with organizationId
- Isolation e2e: 2 new spec files

## Lessons applied
- \$transaction callback form bypasses Proxy — explicit organizationId in all tx.*.create + tx.*.findFirst
- Lifecycle handlers use booking.organizationId instead of TenantContextService injection
- BookingSettings uses findFirst (not findUnique) for nullable composite unique key"
```

- [ ] **Step 11.5: Update memory file**

Create `memory/saas02d_status.md`:

```
---
name: SaaS-02d status
description: Plan 02d (bookings cluster tenant rollout) — status and key facts
type: project
---
**Status:** [fill in: PR number, test count, any divergences]

**Scope delivered:** Booking, BookingStatusLog, WaitlistEntry, GroupSession, GroupEnrollment, GroupSessionWaitlist, BookingSettings scoped with organizationId.

**Key patterns:**
- Lifecycle handlers use booking.organizationId for status log (no TenantContextService injection)
- BookingSettings hierarchical: findFirst by (organizationId, branchId) — DB unique handles non-null branchId; null branchId enforced at app level
- $transaction callback form: explicit organizationId in all tx.* calls

**Next:** Plan 02e (Finance cluster, owner-review required)
```

---

## Amendments applied during execution

> _This section is empty until execution. If reality diverges from any step, stop, document here, and await confirmation before continuing._
