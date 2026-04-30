# Practitioners Module — Audit & Test Coverage Design

**Date:** 2026-03-28
**Scope:** `backend/src/modules/practitioners/`
**Goal:** Fix all discovered bugs + complete unit and E2E test coverage
**Approach:** Parallel audit (3 agents) → phased fix + test execution

---

## Context

The practitioners module is the most complex in Deqah — 8 services, 8 DTOs, 13+ Prisma models. A three-agent parallel audit was conducted covering:

- Agent 1: CRUD + Onboarding + Ratings
- Agent 2: Availability + Vacations + Breaks (time logic)
- Agent 3: PractitionerService + Favorites (complex relations)

---

## Phase 1 — Critical & High Bug Fixes

**Files touched:** `practitioners.service.ts`, `practitioner-onboarding.service.ts`, `practitioner-vacation.service.ts`, `practitioner-service.service.ts`, `favorite-practitioners.service.ts`, `availability-helpers.ts`, `dto/update-practitioner.dto.ts`

### C1 — Race condition in `create()` (practitioners.service.ts:167)

**Problem:** `findFirst` + `create` are two separate DB operations. Concurrent requests can both pass the `findFirst` check and both attempt `create`, causing a raw DB unique constraint error instead of a clean `ConflictException`.

**Fix:** Catch Prisma error code `P2002` on the `create` call and convert it to `ConflictException('PRACTITIONER_EXISTS')`. Remove the pre-check `findFirst` for the duplicate guard — rely on the DB constraint + error handling.

```ts
try {
  practitioner = await this.prisma.practitioner.create({ ... });
} catch (e) {
  if (e?.code === 'P2002') throw new ConflictException({ ... error: 'PRACTITIONER_EXISTS' });
  throw e;
}
```

### C2 — Race condition in `assignService()` (practitioner-service.service.ts:39)

**Problem:** Same check-then-act pattern. `findUnique` + `create` are not atomic.

**Fix:** Same pattern — remove the pre-check, catch `P2002` from `create` and throw `ConflictException('SERVICE_ALREADY_ASSIGNED')`.

### C3 — Race condition in `addFavorite()` (favorite-practitioners.service.ts:28)

**Problem:** Same pattern for `(patientId, practitionerId)` unique pair.

**Fix:** Remove pre-check `findUnique`. Catch `P2002` on `create` and return silently (idempotent) or throw `ConflictException`. Behavior: since the endpoint is meant to be idempotent, swallow `P2002` and return the existing record instead.

### C4 — `replaceServiceTypes` is not atomic (practitioner-service.service.ts:216)

**Problem:** `deleteMany` succeeds, then `createServiceTypes` fails → data loss. The two operations are not wrapped in a transaction.

**Fix:** Wrap `deleteMany` + all subsequent `create` calls in `prisma.$transaction(async (tx) => { ... })`. Pass `tx` down to `createServiceTypes` as a parameter instead of `this.prisma`.

### C5 — `update()` accepts `userId` as `practitionerId` in the URL (practitioners.service.ts:217)

**Problem:** The service tries `id` as `practitionerId`, then falls back to `userId` if not found. This opens an undocumented route: `PATCH /practitioners/{userId}` works silently, bypassing intent.

**Fix:** Remove the `userId` fallback entirely. The URL param is always `practitionerId`. If a caller needs to look up by `userId`, that is a separate internal method.

```ts
// REMOVE:
const byUserId = await this.prisma.practitioner.findFirst({ where: { userId: id } });

// KEEP only:
const practitioner = await this.prisma.practitioner.findFirst({ where: { id, deletedAt: null } });
if (!practitioner) throw new NotFoundException({ ... });
```

### C6 — `specialtyId` missing from `UpdatePractitionerDto` and not written in `update()` (update.dto.ts + service.ts:233)

**Problem:** `specialtyId` cannot be updated via API despite being a core field. The old `service.spec.ts` tests this but `update-practitioner.dto.ts` never had the field.

**Fix — DTO:**
```ts
@IsOptional()
@IsUUID()
specialtyId?: string | null; // null = detach from specialty
```

**Fix — Service `update()`:**
```ts
// In the data object:
...(dto.specialtyId !== undefined && { specialtyId: dto.specialtyId }),
```

### C7 — `onboard()` creates a dangling account if OTP/email fails after commit (practitioner-onboarding.service.ts:110)

**Problem:** The transaction commits successfully (user + practitioner created), then `generateOtp` or `sendPractitionerWelcome` is called outside the transaction. If either throws, the account exists but has no OTP and no welcome email — permanently broken.

**Fix:** Wrap OTP generation inside the transaction (it's a DB write). Move `sendPractitionerWelcome` to a fire-and-forget pattern with error logging — email failure should never block account creation, but should be logged:

```ts
// Inside $transaction: generate OTP
await this.authService.generateOtp(createdUser.id, tx);

// Outside transaction: fire-and-forget email
this.emailService.sendPractitionerWelcome(...).catch((err) => {
  this.logger.error('Failed to send welcome email', { userId: createdUser.id, err });
});
```

### C8 — `getNowMinutesRiyadh()` uses `hour12: false` which may return `'24'` (availability-helpers.ts:14)

**Problem:** In some Node.js/ICU builds, `hour12: false` with `hour: '2-digit'` returns `'24:00'` at midnight instead of `'00:00'`. This makes `h = 24`, returning `1440+` minutes — causing all today's slots to be rejected as "in the past".

**Fix:** Replace `hour12: false` with `hourCycle: 'h23'`:

```ts
const riyadhTime = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
}).format(now);
```

### C9 — Single-day vacation (`startDate === endDate`) rejected incorrectly (practitioner-vacation.service.ts:43)

**Problem:** `if (startDate >= endDate)` rejects same-day vacations. A one-day vacation with equal start/end is valid.

**Fix:** Change to strict less-than:
```ts
if (startDate > endDate) {
  throw new BadRequestException({ ... message: 'startDate must not be after endDate' });
}
```

---

## Phase 2 — Medium Bugs & Code Quality

**Files touched:** `availability-helpers.ts`, `practitioner-availability.service.ts`, `practitioner-service.service.ts`, `practitioner-breaks.service.ts`, `practitioner-ratings.service.ts`, `practitioners.controller.ts`, `dto/set-availability.dto.ts`

### M1 — `slotEnd = '24:00'` at midnight boundary (availability-helpers.ts:53)

**Problem:** When `slotEndMinutes >= 1440` (i.e., slot would end at or after midnight), `pad(Math.floor(1440/60))` = `'24'` — an invalid time string.

**Fix:** Cap slot generation to exclude any slot whose end exceeds `1440`:
```ts
for (let m = startMinutes; m + duration <= endMinutes && m + duration <= 1440; m += step) {
```

### M2 — `dayOfWeek` computed with server timezone instead of Riyadh (practitioner-availability.service.ts:86)

**Problem:** `new Date(date).getDay()` uses the server's local timezone. If the server runs UTC, `2026-05-03T00:00:00Z` returns the correct day — but this is fragile.

**Fix:** Use `Intl.DateTimeFormat` to extract the weekday in Asia/Riyadh:
```ts
const dayOfWeek = parseInt(
  new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE,
    weekday: 'short',
  }).format(new Date(date)) === 'Sun' ? '0' : ..., // use numeric weekday
  10,
);
```

Better: use the `weekday: 'narrow'` trick or a helper that maps locale weekday to 0–6.

Concrete fix — add helper to `availability-helpers.ts`:
```ts
export function getLocalDayOfWeek(dateStr: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE,
    weekday: 'short',
  }).formatToParts(new Date(dateStr));
  const day = parts.find((p) => p.type === 'weekday')?.value;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day ?? 'Sun');
}
```

### M3 — `removeService` blocks on past bookings (practitioner-service.service.ts:137)

**Problem:** The active-bookings check uses `status: { in: ['pending', 'confirmed'] }` without `startTime: { gte: new Date() }`. A confirmed booking from 6 months ago permanently prevents service removal.

**Fix:** Add `startTime: { gte: new Date() }` to the check:
```ts
where: {
  practitionerServiceId: practitionerService.id,
  status: { in: ['pending', 'confirmed'] },
  startTime: { gte: new Date() },
},
```

### M4 — `sortOrder` not validated in Controller (practitioners.controller.ts:77)

**Problem:** `sortOrder as 'asc' | 'desc' | undefined` is a type assertion with no runtime check. Invalid values reach Prisma.

**Fix:** Add explicit validation before passing to service:
```ts
const validSortOrders = ['asc', 'desc'];
if (sortOrder && !validSortOrders.includes(sortOrder)) {
  throw new BadRequestException('sortOrder must be asc or desc');
}
```

### M5 — `specialtyId` not validated as UUID in `findAll` (practitioners.controller.ts:63)

**Problem:** `branchId` is validated as UUID but `specialtyId` is passed raw.

**Fix:** Add UUID validation for `specialtyId` query param:
```ts
if (specialtyId && !isUUID(specialtyId)) {
  throw new BadRequestException('specialtyId must be a valid UUID');
}
```

### M6 — `upsert` in `create()` doesn't handle soft-deleted practitioner (practitioners.service.ts:171)

**Problem:** If `existing.deletedAt !== null`, a `ConflictException` is thrown instead of allowing re-creation or restoring the practitioner.

**Fix:** Add a branch for soft-deleted records:
```ts
if (existing.deletedAt !== null) {
  // Restore and update
  return this.prisma.practitioner.update({
    where: { id: existing.id },
    data: { deletedAt: null, isActive: true, ...profileData },
  });
}
```

### M7 — `createServiceTypes` uses N sequential queries (practitioner-service.service.ts:188)

**Problem:** `for...of` with `await create` = sequential DB round-trips.

**Fix:** Use `Promise.all` for parallel execution (still within the wrapping transaction from C4 fix):
```ts
await Promise.all(
  types.map((type) => tx.practitionerServiceType.create({ data: { ... } }))
);
```
Note: `createMany` cannot be used here because nested `durationOptions` require individual creates.

### M8 — Empty `lastName` produces `"."` in anonymization (practitioner-ratings.service.ts:43)

**Fix:**
```ts
const lastInitial = patient.lastName?.charAt(0) ?? '';
const anonymized = lastInitial ? `${patient.firstName} ${lastInitial}.` : patient.firstName;
```

### M9 — `branchId` missing `@IsUUID()` in `AvailabilitySlotDto` (set-availability.dto.ts:27)

**Fix:**
```ts
@IsOptional()
@IsUUID()
branchId?: string;
```

### M10 — Break spanning two consecutive windows rejected (practitioner-breaks.service.ts:75)

**Problem:** `validateBreaksInsideAvailability` requires a break to be fully contained within one availability window. A break spanning `11:00–14:00` with windows `09:00–12:00` + `13:00–17:00` is rejected even though it's logically valid.

**Decision:** This is a documented design constraint — a break must belong to one shift. Update the error message to clarify this, and add documentation. Do NOT change the logic (it is intentional).

**Fix:** Only update the error message:
```ts
throw new BadRequestException(
  `Break ${brk.startTime}–${brk.endTime} on day ${brk.dayOfWeek} must fall entirely within a single availability window`,
);
```

### Q1 — `getSlots` / `getAvailableSlots` code duplication (practitioner-availability.service.ts)

**Fix:** Make `getSlots` delegate to `getAvailableSlots` for slot computation, then decorate results with `available: true/false`. Eliminate the duplicated fetch logic.

### Q2 — `TIME_REGEX` defined in two files

**Fix:** Export `TIME_REGEX` from `availability-helpers.ts` and import it in `practitioner-breaks.service.ts`.

### Q3 — `NotFoundException` pattern repeated 6+ times

**Fix:** Extract to a shared helper in `practitioner.helper.ts`:
```ts
export function practitionerNotFound(): never {
  throw new NotFoundException({ statusCode: 404, message: 'Practitioner not found', error: 'PRACTITIONER_NOT_FOUND' });
}
```

### Q4 — `as never` in `resolveDurationForSlots`

**Fix:** Replace with proper typed enum or string literal union. Add a runtime guard:
```ts
if (!['in_person', 'online'].includes(bookingType)) {
  throw new BadRequestException('Invalid bookingType');
}
```

### Q5 — `object` type in `onboard` return

**Fix:** Define a typed interface `OnboardResult` and use it consistently.

---

## Phase 3 — Unit Test Gaps

**Files touched (add/extend only):**
- `tests/practitioners.crud.spec.ts`
- `tests/practitioner-onboarding.service.spec.ts`
- `tests/practitioner-ratings.service.spec.ts`
- `tests/practitioners.availability.spec.ts`
- `tests/practitioners.vacation.spec.ts`
- `tests/practitioner-breaks.service.spec.ts`
- `tests/practitioner-service.service.spec.ts` ← NEW (zero coverage)
- `tests/favorite-practitioners.service.spec.ts` ← NEW (zero coverage)

### New Unit Tests — `practitioners.crud.spec.ts`

| Test | Scenario |
|------|----------|
| `create` | with valid `specialtyId` — populates `specialty`/`specialtyAr` from specialty record |
| `create` | with non-existent `specialtyId` — throws `SPECIALTY_NOT_FOUND` |
| `create` | with soft-deleted existing record — restores practitioner (after M6 fix) |
| `create` | P2002 from DB — throws `PRACTITIONER_EXISTS` (after C1 fix) |
| `create` | `createForUser` — creates practitioner with minimal data linked to userId |
| `update` | with `specialtyId` — updates the FK (after C6 fix) |
| `update` | with `specialtyId: null` — detaches specialty |
| `update` | with `isActive: false` — deactivates practitioner |
| `update` | with `isAcceptingBookings: false` |
| `update` | `currentUserId` does not own practitioner — throws `ForbiddenException` |
| `update` | passing `userId` as id no longer works (after C5 fix) |
| `delete` | sets `isActive: false` alongside `deletedAt` |
| `findAll` | `minRating` filter — only returns practitioners with `rating >= minRating` |
| `findAll` | `branchId` filter — includes branch join |
| `findAll` | `specialtyId` takes priority over `specialty` text |
| `findAll` | `sortBy` invalid → defaults to `rating` |
| `findAll` | `sortOrder: 'asc'` |
| `findAll` | `mapSpecialtyRelation` — renames `specialtyRel` → `specialty` in output |

### New Unit Tests — `practitioner-ratings.service.spec.ts`

| Test | Scenario |
|------|----------|
| `getRatings` | `lastName` is empty string → first name only, no trailing `"."` |
| `getRatings` | `lastName` is null → first name only |
| `getRatings` | pagination — returns correct `totalPages` |
| `getRatings` | practitioner with `deletedAt` set — throws `NotFoundException` |

### New Unit Tests — `practitioners.availability.spec.ts`

| Test | Scenario |
|------|----------|
| `generateSlots` | `duration > window` → empty array |
| `generateSlots` | `duration === window` → exactly one slot |
| `generateSlots` | `bufferMinutes = 0` → back-to-back slots |
| `generateSlots` | large `bufferMinutes` → only one slot fits |
| `generateSlots` | `isToday = true`, all slots in past → empty array |
| `generateSlots` | `isToday = true`, current time mid-window → only future slots returned |
| `generateSlots` | `endTime = '23:30'` + `duration = 30` → no `'24:00'` slot (after M1 fix) |
| `generateSlots` | two windows same day → slots from both |
| `checkOverlappingSlots` | adjacent slots (`09:00–12:00` + `12:00–17:00`) → no error |
| `checkOverlappingSlots` | contained slot → throws |
| `checkOverlappingSlots` | identical slots → throws |
| `checkOverlappingSlots` | overlap on different days → no error |
| `getNowMinutesRiyadh` | returns value between 0 and 1439 (never 1440) |
| `getLocalDayOfWeek` | returns correct day for Asia/Riyadh date |
| `getAvailability` | with `branchId` — returns branch-specific + global slots |
| `getAvailability` | without `branchId` — returns all |
| `getSlots` | break removes overlapping slot |
| `getSlots` | `isAcceptingBookings: false` → empty array |

### New Unit Tests — `practitioners.vacation.spec.ts`

| Test | Scenario |
|------|----------|
| `createVacation` | `startDate === endDate` → succeeds (single day, after C9 fix) |
| `createVacation` | partial overlap (new end = existing start) → throws |
| `createVacation` | contained within existing vacation → throws |
| `createVacation` | past `startDate` → succeeds (no restriction) |
| `deleteVacation` | vacation belongs to different practitioner → throws `NotFoundException` |

### New Unit Tests — `practitioner-breaks.service.spec.ts`

| Test | Scenario |
|------|----------|
| `setBreaks` | break outside availability window → throws |
| `setBreaks` | overlapping breaks → throws |
| `setBreaks` | `breaks: []` → clears all breaks |
| `setBreaks` | break spans two consecutive windows → throws with clear message |
| `setBreaks` | break equals full availability window → succeeds |
| `getBreaks` | practitioner not found → throws `NotFoundException` |

### New Unit Tests — `practitioner-service.service.spec.ts` (NEW FILE)

| Test | Scenario |
|------|----------|
| `assignService` | happy path — creates PractitionerService + ServiceTypes + DurationOptions |
| `assignService` | service not found → throws `NotFoundException` |
| `assignService` | practitioner not found → throws `NotFoundException` |
| `assignService` | already assigned → throws `ConflictException` (via P2002 catch, after C2 fix) |
| `assignService` | with `customDuration` — saved correctly |
| `assignService` | with `types[]` — creates correct ServiceType records |
| `assignService` | with `durationOptions` — creates nested records |
| `assignService` | `isDefault: true` on two durationOptions → both saved (no enforcement at service level) |
| `listServices` | returns only `isActive: true` services |
| `listServices` | practitioner not found → throws |
| `updateService` | custom price per type |
| `updateService` | `customDuration: null` → clears override |
| `updateService` | `types: []` → removes all service types |
| `updateService` | service not assigned → throws |
| `removeService` | happy path — deletes record |
| `removeService` | future confirmed booking exists → throws `ConflictException` |
| `removeService` | past confirmed booking exists → succeeds (after M3 fix) |
| `removeService` | cascade check — serviceTypes + durationOptions gone after delete |
| `getServiceTypes` | practitioner with service but no types → returns `[]` |
| `replaceServiceTypes` | atomicity — if create fails after delete, no orphan records (after C4 fix) |

### New Unit Tests — `favorite-practitioners.service.spec.ts` (NEW FILE)

| Test | Scenario |
|------|----------|
| `addFavorite` | happy path — creates record |
| `addFavorite` | practitioner not found → throws |
| `addFavorite` | practitioner soft-deleted → throws |
| `addFavorite` | P2002 — concurrent duplicate → swallows, returns existing (after C3 fix) |
| `removeFavorite` | happy path — deletes record |
| `removeFavorite` | not favorited → throws `NotFoundException` |
| `getFavorites` | returns flattened practitioner data |
| `getFavorites` | practitioner in list is soft-deleted → excluded (or included — define behavior) |
| `getFavorites` | empty list → returns `[]` |

---

## Phase 4 — E2E Test Gaps

**Files touched (add/extend only):**
- `test/e2e/practitioners/practitioners.e2e-spec.ts`
- `test/e2e/practitioners/practitioners-services.e2e-spec.ts`
- `test/e2e/practitioners/favorite-practitioners.e2e-spec.ts`
- `test/e2e/practitioners/practitioners-onboarding.e2e-spec.ts` ← NEW (zero coverage)
- `test/e2e/practitioners/practitioners-breaks.e2e-spec.ts` ← NEW (zero coverage)

### New E2E — `practitioners-onboarding.e2e-spec.ts` (NEW FILE)

| Test | Expected |
|------|----------|
| `POST /practitioners/onboard` — no auth | 401 |
| `POST /practitioners/onboard` — no permission | 403 |
| `POST /practitioners/onboard` — valid payload | 201, creates user + practitioner |
| Verify: user `isActive: false` after onboard | true |
| Verify: practitioner appears in `GET /practitioners` with `isActive=false` query | visible to admin |
| `POST /practitioners/onboard` — duplicate email | 409 |
| `POST /practitioners/onboard` — missing required fields | 400 |
| `POST /practitioners/onboard` — email normalization (uppercase → lowercase) | email stored lowercase |
| Verify: nameEn split → firstName + lastName | `"Ahmed Al-Rashidi"` → `firstName: "Ahmed"`, `lastName: "Al-Rashidi"` |
| `POST /practitioners/onboard` — nameEn three words | middle word goes to firstName or lastName (define behavior) |

### New E2E — `practitioners-breaks.e2e-spec.ts` (NEW FILE)

| Test | Expected |
|------|----------|
| `GET /practitioners/:id/breaks` — no auth | 200 (public? or 401?) |
| `GET /practitioners/:id/breaks` — practitioner not found | 404 |
| `GET /practitioners/:id/breaks` — no breaks set | `{ breaks: [] }` |
| `PUT /practitioners/:id/breaks` — no auth | 401 |
| `PUT /practitioners/:id/breaks` — no permission | 403 |
| `PUT /practitioners/:id/breaks` — admin sets breaks | 200 |
| `PUT /practitioners/:id/breaks` — owner sets own breaks | 200 |
| `PUT /practitioners/:id/breaks` — break outside availability | 400 |
| `PUT /practitioners/:id/breaks` — overlapping breaks | 400 |
| `PUT /practitioners/:id/breaks` — `breaks: []` clears all | 200, GET returns `[]` |
| `GET /practitioners/:id/slots` — break removes overlapping slot | slot absent |
| `PUT /practitioners/:id/breaks` — invalid time format | 400 |
| `PUT /practitioners/:id/breaks` — endTime before startTime | 400 |

### New E2E — `practitioners.e2e-spec.ts` additions

| Test | Expected |
|------|----------|
| `GET /practitioners` — `branchId` not a UUID | 400 |
| `GET /practitioners` — `specialtyId` not a UUID | 400 |
| `GET /practitioners` — `sortOrder=invalid` | 400 |
| `GET /practitioners` — `minRating=1` filter | only practitioners with rating ≥ 1 |
| `GET /practitioners/:id` — `PATCH` with `specialtyId` | updates specialty correctly |
| `GET /practitioners/:id` — `PATCH` from different practitioner | 403 |
| `DELETE /practitioners/:id` — from receptionist | 403 |
| `GET /practitioners/:id/ratings` — empty ratings | `{ ratings: [], total: 0 }` |
| `GET /practitioners/:id/ratings` — anonymization verified in response | `"Ahmed A."` format |
| `GET /practitioners/:id/ratings` — pagination `page=2` | correct offset |
| `GET /practitioners/:id/slots` — `isAcceptingBookings: false` | `{ slots: [] }` |
| `GET /practitioners/:id/slots` — duration > availability window | `{ slots: [] }` |
| `GET /practitioners/:id/slots` — adjacent availability windows | slots from both |
| `POST /practitioners/:id/vacations` — `startDate === endDate` | 201 (after C9 fix) |
| `POST /practitioners/:id/vacations` — past `startDate` | 201 |

### New E2E — `practitioners-services.e2e-spec.ts` additions

| Test | Expected |
|------|----------|
| `DELETE /practitioners/:id/services/:serviceId` — future confirmed booking | 409 |
| `DELETE /practitioners/:id/services/:serviceId` — past confirmed booking | 200 (after M3 fix) |
| `DELETE /practitioners/:id/services/:serviceId` — cascade: serviceTypes deleted | verified via `getServiceTypes` |
| `POST /practitioners/:id/services` — soft-deleted service | 404 |
| `PATCH /practitioners/:id/services/:serviceId` — `types: []` | removes all types |
| `GET /practitioners/:id/services/:serviceId/types` — no types | `{ types: [] }` |
| `POST /practitioners/:id/services` — `customDuration: null` | 400 (AssignDto doesn't accept null) |

### New E2E — `favorite-practitioners.e2e-spec.ts` additions

| Test | Expected |
|------|----------|
| `POST /:id/favorite` — practitioner soft-deleted | 404 |
| `GET /favorites` — soft-deleted practitioner in list | excluded from results |
| `DELETE /:id/favorite` — cross-patient (patient B deletes patient A's favorite) | 404 |

---

## Architecture Decisions

### 1. Race Conditions — Chosen Approach: P2002 Catch
We use DB unique constraint + error code catch rather than optimistic locking or serializable transactions. Rationale: simpler, idiomatic for NestJS/Prisma, and the unique constraints already exist on the schema.

### 2. `replaceServiceTypes` Atomicity
Wrapped in `prisma.$transaction`. The `tx` client is passed as a parameter to `createServiceTypes` to allow reuse within the transaction.

### 3. Email Failure in Onboarding
Email is fire-and-forget. Account creation is not rolled back on email failure. This is intentional — email is not a hard dependency for account existence. Failed emails are logged with structured context for retry/alerting.

### 4. Break Spanning Two Windows
Kept as a design constraint (break must fit within one shift). Error message updated to be explicit.

### 5. `removeService` — Future Bookings Only
Only future bookings (`startTime >= now`) block service removal. Past bookings are historical records and should not prevent cleanup.

---

## File Ownership per Phase

| Phase | Owner | Files |
|-------|-------|-------|
| Phase 1 | Agent A | `practitioners.service.ts`, `practitioner-onboarding.service.ts`, `practitioner-vacation.service.ts`, `practitioner-service.service.ts`, `favorite-practitioners.service.ts`, `availability-helpers.ts`, `dto/update-practitioner.dto.ts` |
| Phase 2 | Agent B | `practitioner-availability.service.ts`, `practitioner-breaks.service.ts`, `practitioner-ratings.service.ts`, `practitioners.controller.ts`, `dto/set-availability.dto.ts`, `practitioner.helper.ts` |
| Phase 3 | Agent C (3 sub-agents) | All `tests/*.spec.ts` files |
| Phase 4 | Agent D (2 sub-agents) | All `test/e2e/practitioners/*.e2e-spec.ts` files |

---

## Success Criteria

- All C1–C9 bugs fixed with corresponding unit tests verifying the fix
- All M1–M10 fixes applied
- Unit test coverage: every service method has at minimum happy path + primary error path
- E2E coverage: all listed scenarios pass against real DB
- No file exceeds 350 lines — split if needed
- `npm run test` passes
- `npm run typecheck` passes
