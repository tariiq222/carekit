# p9 — Bookings BC: Critical Fixes — Design Spec

**Date**: 2026-04-12
**Phase**: p9 — Bookings BC Critical Fixes
**Scope**: Fix three critical gaps in the Bookings bounded context discovered by comparison with the old system. Expands to a fourth (schema migration) because the real employee time model does not fit the current schema.

## Background

During the rebuild (p1–p8), the Bookings BC was implemented quickly with a simplified employee time model. Comparing against the old `refactor/monorepo-structure` branch surfaced three critical gaps:

1. `CheckAvailabilityHandler` ignores `EmployeeAvailability`, `EmployeeAvailabilityException`, and `Holiday` entirely — it only checks `BusinessHour`. An employee on annual leave would still appear available.
2. `CreateBookingHandler` accepts `price` and `durationMins` directly from the DTO — a commercial vulnerability. A malicious caller could book a 60-minute service for 1 SAR.
3. `CreateBookingHandler` does not verify that the employee actually provides the requested service, nor that `employeeId`, `serviceId`, `branchId`, and `clientId` belong to the same `tenantId` — a tenancy isolation gap.

While designing the fix for gap #1, we discovered the current schema cannot represent the real employee time model used in clinics:

- **Split-shift days** — an employee works 9:00–13:00, breaks, then returns 16:00–21:00. A break is the gap between two shifts, not a first-class entity.
- **Weekly off day** — a specific `dayOfWeek` on which the employee does not work (e.g. every Friday).
- **Annual leave** — a continuous date range where the employee is off (e.g. 2026-07-01 to 2026-07-14).

The current `EmployeeAvailability` has `@@unique([employeeId, dayOfWeek])`, which blocks split shifts. `EmployeeAvailabilityException` stores a single `date`, which makes representing a two-week annual leave require fourteen rows. Both models need reshaping before the handler fix can land.

## Scope

Four atomic tasks, each landing as a separate commit on the same branch:

- **p9-t0** (schema) — Reshape `EmployeeAvailability` + `EmployeeAvailabilityException`.
  Commit: `feat(people): support split shifts and date-range exceptions`
- **p9-t1** (backend) — `CheckAvailabilityHandler`: multi-shift + exception range + holiday support.
  Commit: `fix(bookings): honor employee availability, exceptions, and holidays`
- **p9-t2** (backend) — `CreateBookingHandler`: stop accepting `price`/`durationMins` from DTO.
  Commit: `fix(bookings): derive price and duration from Service, not DTO`
- **p9-t3** (backend) — `CreateBookingHandler`: verify `EmployeeService` + tenant isolation.
  Commit: `fix(bookings): verify employee provides service and tenant match`

**Dependency graph**: t0 must land first. t1 depends on t0. t2 and t3 are independent of t0/t1 and of each other — they can land in any order.

**Branch**: `fix/bookings-p9`. One branch, four commits, single PR at the end.

## Out of Scope

- `PriceResolver` (p11-t5) — the proper fix for price derivation that handles coupons, gift cards, memberships, and dynamic pricing. p9-t2 is a minimal intermediate fix.
- Reschedule handler — suffers the same `EmployeeService` + tenant gap as create. Addressed later in p11 alongside the full PriceResolver.
- Walk-in bookings (`BookingType.WALK_IN`) — they bypass availability checks by design. No changes needed.
- Group session enrollment flow — governed by `GroupSession.enrolledCount < maxCapacity`, not by employee availability. No changes needed.

## Task 1 — p9-t0: Schema Migration

### Goal

Reshape `EmployeeAvailability` to allow multiple shifts per day, and reshape `EmployeeAvailabilityException` to store a date range instead of a single date.

### Files Changed

- [apps/backend/prisma/schema/people.prisma](apps/backend/prisma/schema/people.prisma)
- New migration under `apps/backend/prisma/migrations/` named `<timestamp>_employee_time_model_reshape`.

### `EmployeeAvailability` — After

```prisma
model EmployeeAvailability {
  id         String   @id @default(uuid())
  tenantId   String
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  dayOfWeek  Int      // 0=Sunday .. 6=Saturday
  startTime  String   // "HH:mm"
  endTime    String   // "HH:mm"
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([tenantId])
  @@index([employeeId, dayOfWeek])
}
```

**Diff**: remove `@@unique([employeeId, dayOfWeek])`. Replace the existing `@@index([employeeId])` with `@@index([employeeId, dayOfWeek])` since every availability query is already filtered by both columns.

**Semantic rule** (enforced by admin UI, not the schema): multiple rows for the same `(employeeId, dayOfWeek)` represent disjoint shifts sorted by `startTime`. Overlap is considered a data-entry bug. The handler processes each shift row independently without merging overlaps — if shifts overlap, the overlapping slots are generated twice but the existing-bookings conflict check deduplicates naturally. A future admin UI should prevent overlap at entry time.

### `EmployeeAvailabilityException` — After

```prisma
model EmployeeAvailabilityException {
  id         String   @id @default(uuid())
  tenantId   String
  employeeId String
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  startDate  DateTime @db.Date
  endDate    DateTime @db.Date
  reason     String?
  createdAt  DateTime @default(now())

  @@index([tenantId])
  @@index([employeeId, startDate, endDate])
}
```

**Removed fields**:

- `date: DateTime` → replaced by `startDate` + `endDate`.
- `isOff: Boolean` → every exception is a full-day off, so the flag is meaningless. If we ever need partial-day availability overrides, that is a new concept (handled by editing `EmployeeAvailability`, not exceptions).
- `startTime: String?` / `endTime: String?` → deleted. The "override part of a day" use case does not exist in the real clinic model.

**Single-day leave** = `startDate == endDate`. **Annual leave** = a date range spanning days/weeks. No overlap constraint in schema (handler is tolerant).

### Migration Strategy

Since p9 lands before the rebuild is deployed (no production data exists yet in the rebuilt schema), the migration is a clean drop-and-recreate:

1. `DROP TABLE "EmployeeAvailabilityException"` and recreate with the new columns.
2. `ALTER TABLE "EmployeeAvailability" DROP CONSTRAINT IF EXISTS "EmployeeAvailability_employeeId_dayOfWeek_key"`.
3. `DROP INDEX "EmployeeAvailability_employeeId_idx"`.
4. `CREATE INDEX "EmployeeAvailability_employeeId_dayOfWeek_idx" ON "EmployeeAvailability" ("employeeId", "dayOfWeek")`.

No data preservation needed. Seed data in `prisma/seed.ts` will need updating — a grep confirms whether any seeder currently writes to either model (verify before commit; update in the same commit as the schema change so seed and migration ship together).

### Tests (t0)

No unit tests for the schema itself. Downstream tests land in p9-t1.

## Task 2 — p9-t1: `CheckAvailabilityHandler` Rewrite

### Goal (t1)

Generate availability slots that respect: branch business hours, branch holidays, employee weekly shifts (possibly multiple per day), and employee date-range exceptions.

### File Changed (t1)

[apps/backend/src/modules/bookings/check-availability/check-availability.handler.ts](apps/backend/src/modules/bookings/check-availability/check-availability.handler.ts) — full rewrite while preserving the query interface (`CheckAvailabilityQuery`, `AvailableSlot`, `SLOT_INTERVAL_MINS = 30`).

### Algorithm

```text
execute(query):
  dateOnly = normalize query.date to 00:00 local time
  dayOfWeek = dateOnly.getDay()

  fetch in parallel (Promise.all):
    businessHour       = prisma.businessHour.findUnique({branchId, dayOfWeek})
    holiday            = prisma.holiday.findFirst({branchId, date: dateOnly})
    shifts             = prisma.employeeAvailability.findMany({
                           employeeId, dayOfWeek, isActive: true
                         }) sorted by startTime asc
    exception          = prisma.employeeAvailabilityException.findFirst({
                           employeeId,
                           startDate: { lte: dateOnly },
                           endDate:   { gte: dateOnly }
                         })

  short-circuit returns []:
    - businessHour missing or !isOpen
    - holiday exists
    - exception exists
    - shifts.length === 0  (weekly off day)

  branchWindow = [businessHour.startTime, businessHour.endTime] parsed to Date on dateOnly

  windows = []
  for shift in shifts:
    shiftWindow = [shift.startTime, shift.endTime] parsed to Date on dateOnly
    intersected = intersect(shiftWindow, branchWindow)
    if intersected not empty: windows.push(intersected)

  if windows empty: return []

  existingBookings = prisma.booking.findMany({
    tenantId, employeeId,
    status: { in: [PENDING, CONFIRMED] },
    scheduledAt: { gte: earliest-window-start, lt: latest-window-end }
  }) sorted by scheduledAt asc

  slots = []
  now = new Date()
  for window in windows:
    cursor = window.start
    while cursor + durationMins*60000 <= window.end:
      slotEnd = cursor + durationMins*60000
      hasConflict = existingBookings.some(b =>
        b.scheduledAt < slotEnd && b.endsAt > cursor)
      if !hasConflict and cursor > now:
        slots.push({ startTime: cursor, endTime: slotEnd })
      cursor += SLOT_INTERVAL_MINS * 60000

  return slots
```

### Helper Functions

Two pure helpers live at the top of the file (not exported, not a new module — YAGNI):

- `parseHHmm(hhmm: string, anchorDate: Date): Date` — builds a `Date` at `anchorDate`'s local-date with hours/minutes from the string.
- `intersectWindows(a: [Date, Date], b: [Date, Date]): [Date, Date] | null` — returns the overlap or `null`.

### Break Handling

The break between shifts falls out naturally: if shifts are `09:00–13:00` and `16:00–21:00`, the slot loop runs over each window independently. No slot is generated in `13:00–16:00` because no window covers it. No break model is needed.

### Tests (t1)

Update [apps/backend/src/modules/bookings/bookings.handler.spec.ts](apps/backend/src/modules/bookings/bookings.handler.spec.ts) `CheckAvailabilityHandler` section:

- Extend `buildPrisma()` with `employeeAvailability.findMany`, `employeeAvailabilityException.findFirst`, and `holiday.findFirst` mocks. Default: one full-day shift (09:00–17:00), no exception, no holiday.
- Existing tests (`returns available slots`, `returns empty when branch is closed`) keep passing with minimal mock updates.

**New tests**:

1. Returns empty when employee has no shifts for this day (weekly off).
2. Returns empty when a holiday exists for the branch on that date.
3. Returns empty when an exception covers that date (`startDate <= date <= endDate`).
4. Returns slots from both windows when employee has a split shift, with no slot in the gap between them.
5. Shift window is clamped by branch hours (shift 08:00–18:00, branch 09:00–17:00 → slots only inside 09:00–17:00).

## Task 3 — p9-t2: Remove `price`/`durationMins` from `CreateBookingDto`

### Goal (t2)

Prevent callers from dictating price or duration. Derive both from the `Service` row.

### Files Changed (t2)

- [apps/backend/src/modules/bookings/create-booking/create-booking.dto.ts](apps/backend/src/modules/bookings/create-booking/create-booking.dto.ts)
- [apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts](apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts)
- [apps/backend/src/modules/bookings/bookings.handler.spec.ts](apps/backend/src/modules/bookings/bookings.handler.spec.ts)
- [apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts](apps/backend/src/modules/bookings/create-booking/create-booking.handler.spec.ts) (if it exists — will verify)

### DTO — After

```typescript
import { BookingType } from '@prisma/client';

export interface CreateBookingDto {
  tenantId: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: Date;
  currency?: string;
  bookingType?: BookingType;
  notes?: string;
  expiresAt?: Date;
  groupSessionId?: string;
}
```

Removed: `durationMins: number`, `price: number`.

### Handler Changes

At the top of `execute`:

```typescript
const service = await this.prisma.service.findUnique({
  where: { id: dto.serviceId },
});
if (!service) throw new NotFoundException('Service not found');
if (service.tenantId !== dto.tenantId) {
  throw new ForbiddenException('Service does not belong to tenant');
}

const durationMins = service.durationMins;
const price = service.price; // Decimal
const currency = dto.currency ?? service.currency;
```

Use these derived values for `endsAt`, the conflict query, and the `booking.create` call. Remove `dto.durationMins` and `dto.price` references.

### Tests (t2)

- Update `buildPrisma()` to add `service.findUnique` returning `{ id: 'svc-1', tenantId: 'tenant-1', durationMins: 60, price: 200, currency: 'SAR' }`.
- Strip `price` and `durationMins` from `CreateBookingHandler` test calls.
- New test: service not found → `NotFoundException`.
- New test: service belongs to different tenant → `ForbiddenException`.

## Task 4 — p9-t3: Verify `EmployeeService` + Tenant Match

### Goal (t3)

Reject bookings where the employee does not offer the service, or where the employee belongs to a different tenant than the request.

### File Changed (t3)

[apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts](apps/backend/src/modules/bookings/create-booking/create-booking.handler.ts) — extend the validation block added in p9-t2.

### Handler Additions

After the `Service` fetch from p9-t2, before the conflict check:

```typescript
const employee = await this.prisma.employee.findUnique({
  where: { id: dto.employeeId },
});
if (!employee) throw new NotFoundException('Employee not found');
if (employee.tenantId !== dto.tenantId) {
  throw new ForbiddenException('Employee does not belong to tenant');
}

const employeeService = await this.prisma.employeeService.findUnique({
  where: {
    employeeId_serviceId: {
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
    },
  },
});
if (!employeeService) {
  throw new BadRequestException('Employee does not provide this service');
}
```

### What We Do Not Check

- `Branch.tenantId` — assumed valid because the tenant middleware already rejects cross-tenant branch IDs at the route layer.
- `Client.tenantId` — same reason.

If future audit reveals leakage, add those checks in a follow-up commit. Not adding them now because they are not in the task scope and would bloat the commit.

### Tests (t3)

Update `buildPrisma()` mocks:

- Add `employee.findUnique` returning `{ id: 'emp-1', tenantId: 'tenant-1' }`.
- Add `employeeService.findUnique` returning `{ id: 'es-1', employeeId: 'emp-1', serviceId: 'svc-1' }`.

New tests:

1. Employee not found → `NotFoundException`.
2. Employee belongs to different tenant → `ForbiddenException`.
3. Employee does not provide the service (`employeeService.findUnique` returns null) → `BadRequestException`.

## Commit Plan

One branch `fix/bookings-p9`, four sequential commits:

```text
1. feat(people): support split shifts and date-range exceptions
   - prisma/schema/people.prisma
   - prisma/migrations/<ts>_employee_time_model_reshape/

2. fix(bookings): honor employee availability, exceptions, and holidays
   - src/modules/bookings/check-availability/check-availability.handler.ts
   - src/modules/bookings/bookings.handler.spec.ts (CheckAvailability section)

3. fix(bookings): derive price and duration from Service, not DTO
   - src/modules/bookings/create-booking/create-booking.dto.ts
   - src/modules/bookings/create-booking/create-booking.handler.ts
   - src/modules/bookings/bookings.handler.spec.ts (CreateBooking section)

4. fix(bookings): verify employee provides service and tenant match
   - src/modules/bookings/create-booking/create-booking.handler.ts
   - src/modules/bookings/bookings.handler.spec.ts (CreateBooking section)
```

Each commit must pass `npm run test -w apps/backend` before the next is created.

## Risks and Mitigations

- **Seeder references removed fields on `EmployeeAvailabilityException`** → grep seeder in p9-t0; fix in same commit.
- **`CheckAvailabilityHandler` slot generation off-by-one on shift boundaries** → boundary tests in the new test cases (last slot ends exactly at window end).
- **Existing reschedule handler still accepts `durationMins`/`price`** → out of scope; flag as follow-up, track in p11 notes.
- **Prisma `Service` returns `Decimal` but old code passed `number`** → use `Decimal` directly in `booking.create`; Prisma accepts it natively for `@db.Decimal` columns.
- **Tests depend on previous mock shape** → update mock defaults in a single pass at the top of the spec file.

## Verification Checklist

Before opening the PR:

- [ ] `npm run test -w apps/backend` green after each commit
- [ ] `npm run lint -w apps/backend` clean
- [ ] `npm run build -w apps/backend` clean (Prisma client regenerated)
- [ ] `prisma migrate status` shows the new migration applied
- [ ] Grep confirms no lingering `dto.price` or `dto.durationMins` reads in create-booking
- [ ] Grep confirms no references to removed `EmployeeAvailabilityException.date`/`startTime`/`endTime`/`isOff`
