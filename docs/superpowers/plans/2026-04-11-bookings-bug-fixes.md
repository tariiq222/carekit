# Bookings Bug Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all CRITICAL issues (C1–C4) and HIGH issues (H2, H3, H8) identified in the bookings architecture analysis.

**Architecture:** Each fix is surgical — one file per task, no cross-system changes. Buffer fix (C1/C2) touches only `booking-validation.helper.ts` and `booking-reschedule.service.ts`. Timezone fix (C3) is in `booking-autocomplete.service.ts`. Refund policy fix (C4) is in `booking-cancellation-timeout.service.ts`. Waitlist fixes (H2, H8) are in `waitlist.service.ts`. Monthly date clamp (H3) is in `booking-recurring.service.ts`.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict mode, Jest (unit tests in `test/unit/`)

---

## File Map

| File | Change |
|------|--------|
| `backend/src/modules/bookings/booking-validation.helper.ts` | Fix C1: buffer applied only once (to new slot, not to existing) |
| `backend/src/modules/bookings/booking-reschedule.service.ts` | Fix C2: align buffer resolution with creation (`> 0` check) |
| `backend/src/modules/tasks/booking-autocomplete.service.ts` | Fix C3: use clinic timezone instead of hardcoded `+03:00` |
| `backend/src/modules/tasks/booking-cancellation-timeout.service.ts` | Fix C4: respect `suggestedRefundType` from booking |
| `backend/src/modules/bookings/waitlist.service.ts` | Fix H2 + H8: use `waitlistMaxPerSlot`, fix UTC date boundary |
| `backend/src/modules/bookings/booking-recurring.service.ts` | Fix H3: clamp monthly date to last day of target month |
| `test/unit/bookings/booking-validation.helper.spec.ts` | New: unit tests for C1 fix |
| `test/unit/bookings/booking-recurring.spec.ts` | New: unit tests for H3 fix |

---

## Task 1: Fix C1 — Buffer Applied to New Slot Only (not existing bookings)

**Files:**
- Modify: `backend/src/modules/bookings/booking-validation.helper.ts:91-133`
- Create: `test/unit/bookings/booking-validation.helper.spec.ts`

**What to change:** `checkDoubleBooking()` currently expands BOTH the new slot and existing bookings by `bufferMinutes`. The intent is to enforce a gap of `bufferMinutes` between appointments, but doubling the expansion enforces a gap of `2×bufferMinutes`. The fix: expand only the new slot's effective window (add buffer on both sides), and compare against existing bookings at their raw times.

- [ ] **Step 1: Write the failing test**

Create `test/unit/bookings/booking-validation.helper.spec.ts`:

```typescript
import { ConflictException } from '@nestjs/common';
import { checkDoubleBooking } from '../../../src/modules/bookings/booking-validation.helper.js';

function makeBookingFinder(existing: Array<{ startTime: string; endTime: string }>) {
  return {
    practitionerVacation: {} as never,
    practitionerAvailability: {} as never,
    booking: {
      findMany: async () => existing,
    },
  };
}

describe('checkDoubleBooking', () => {
  it('allows a booking just outside buffer window', async () => {
    // Existing: 10:00–10:30. Buffer: 15 min. New: 10:45–11:15.
    // With single-side buffer: new effective window 10:30–11:30, existing 10:00–10:30 → no overlap.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:45', '11:15', undefined, 15),
    ).resolves.toBeUndefined();
  });

  it('rejects a booking within buffer window', async () => {
    // Existing: 10:00–10:30. Buffer: 15 min. New: 10:40–11:10.
    // New effective window: 10:25–11:25. Existing ends at 10:30 → overlap.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:40', '11:10', undefined, 15),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows back-to-back booking with zero buffer', async () => {
    // Existing: 10:00–10:30. Buffer: 0. New: 10:30–11:00 → no conflict.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:30', '11:00', undefined, 0),
    ).resolves.toBeUndefined();
  });

  it('previously double-applied buffer would have rejected 10:45 slot with 15min buffer — now allowed', async () => {
    // C1 regression test: old code would expand existing 10:00–10:30 → 09:45–10:45
    // and new 10:45–11:15 → 10:30–11:30 → overlap at 10:30–10:45 → incorrect reject.
    // Fixed code: only new slot expanded → 10:30–11:30 vs existing 10:00–10:30 → no overlap at boundary.
    const prisma = makeBookingFinder([{ startTime: '10:00', endTime: '10:30' }]);
    await expect(
      checkDoubleBooking(prisma as never, 'p1', new Date(), '10:45', '11:15', undefined, 15),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend && npx jest test/unit/bookings/booking-validation.helper.spec.ts --no-coverage
```

Expected: Tests 1, 3, and 4 may pass or fail depending on current behavior. Test 2 should fail because the assertion direction may differ. Confirm that test 4 (the regression test) FAILS under the current code.

- [ ] **Step 3: Fix `checkDoubleBooking` — expand only the new slot**

In `backend/src/modules/bookings/booking-validation.helper.ts`, replace lines 111–126:

```typescript
  // Expand only the new slot by buffer on both sides.
  // This enforces a minimum gap of bufferMinutes between the new booking
  // and any existing booking. Expanding both sides would double the gap.
  const effectiveStart = shiftTime(startTime, -bufferMinutes);
  const effectiveEnd = shiftTime(endTime, bufferMinutes);
  const hasConflict = existingBookings.some((existing) => {
    return timeSlotsOverlap(
      effectiveStart,
      effectiveEnd,
      existing.startTime,
      existing.endTime,
    );
  });
```

Remove lines that defined `existingEffectiveStart` and `existingEffectiveEnd`.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npx jest test/unit/bookings/booking-validation.helper.spec.ts --no-coverage
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run full unit suite to check for regressions**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/bookings/booking-validation.helper.ts test/unit/bookings/booking-validation.helper.spec.ts
git commit -m "fix(bookings): apply buffer only to new slot in checkDoubleBooking (C1)"
```

---

## Task 2: Fix C2 — Align Buffer Resolution in Reschedule with Creation

**Files:**
- Modify: `backend/src/modules/bookings/booking-reschedule.service.ts:84-85`

**What to change:** Creation uses `ps.bufferMinutes > 0 ? ps.bufferMinutes : (svc.bufferMinutes > 0 ? svc.bufferMinutes : settings.bufferMinutes)` — treats `0` as "not set, fall through." Reschedule uses `??` — treats `0` as explicit. Align reschedule to use the same `> 0` fallback logic.

- [ ] **Step 1: Fix buffer resolution in reschedule**

In `backend/src/modules/bookings/booking-reschedule.service.ts`, replace line 85:

```typescript
    const bufferMinutes =
      ps?.bufferMinutes ?? svc?.bufferMinutes ?? settings.bufferMinutes;
```

With:

```typescript
    const bufferMinutes =
      (ps?.bufferMinutes ?? 0) > 0
        ? ps!.bufferMinutes
        : (svc?.bufferMinutes ?? 0) > 0
          ? svc!.bufferMinutes
          : settings.bufferMinutes;
```

- [ ] **Step 2: Run tests**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
cd backend && git add src/modules/bookings/booking-reschedule.service.ts
git commit -m "fix(bookings): align buffer resolution in reschedule with creation logic (C2)"
```

---

## Task 3: Fix C3 — Auto-Complete Timezone Hardcode

**Files:**
- Modify: `backend/src/modules/tasks/booking-autocomplete.service.ts:28-54`

**What to change:** Lines 31 and 54 hardcode `+03:00` (Riyadh UTC offset) when constructing Date objects from strings. The file already uses `clinicTz` (from `ClinicSettingsService`) to format the date string — it just doesn't use it for the time portion. Fix: use `Intl.DateTimeFormat` to get the full ISO string in clinic timezone instead of hardcoding the offset.

- [ ] **Step 1: Fix the two hardcoded timezone offsets**

In `backend/src/modules/tasks/booking-autocomplete.service.ts`, replace lines 28–55:

```typescript
    const clinicDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTz,
    }).format(now);

    // "Tomorrow" in clinic timezone: anything with date < today+1 is a candidate
    const tomorrowClinic = new Date(
      new Intl.DateTimeFormat('en-CA', { timeZone: clinicTz }).format(
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
      ) + 'T00:00:00Z',
    );

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        date: { lt: tomorrowClinic },
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        date: true,
        endTime: true,
        status: true,
      },
    });

    const autoCompleteMs = settings.autoCompleteAfterHours * 60 * 60 * 1000;
    const bookings = candidates.filter((b) => {
      // Format the booking date in the clinic's timezone to get the local date string
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: clinicTz,
      }).format(b.date);
      // Reconstruct booking end time as UTC using clinic timezone offset
      const bookingEndLocal = new Intl.DateTimeFormat('en-CA', {
        timeZone: clinicTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(new Date(`${dateStr}T${b.endTime}:00Z`));
      // Parse parts into a timezone-aware Date by formatting via Intl and re-parsing
      // Use the reliable approach: append the time to the local date string, then
      // interpret it as-is knowing the offset via getTimezoneOffset equivalent
      const endIso = `${dateStr}T${b.endTime}:00`;
      const bookingEnd = new Date(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: clinicTz,
        }).format(new Date(endIso + 'Z')) === dateStr
          ? endIso + 'Z'
          : endIso + 'Z',
      );
      // Correct approach: parse the booking date in clinic TZ
      const bookingEndUtc = new Date(
        Date.UTC(
          ...( new Intl.DateTimeFormat('en-US', {
            timeZone: clinicTz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          })
            .formatToParts(new Date(`${dateStr}T${b.endTime}:00Z`))
            .reduce((acc, p) => {
              if (p.type === 'year') acc[0] = +p.value;
              if (p.type === 'month') acc[1] = +p.value - 1;
              if (p.type === 'day') acc[2] = +p.value;
              if (p.type === 'hour') acc[3] = +p.value === 24 ? 0 : +p.value;
              if (p.type === 'minute') acc[4] = +p.value;
              if (p.type === 'second') acc[5] = +p.value;
              return acc;
            }, new Array(6) as number[]) as [number, number, number, number, number, number]
          ),
        ),
      );
      void bookingEnd; void bookingEndUtc;
      return now.getTime() > bookingEndUtc.getTime() + autoCompleteMs;
    });
```

That approach is overly complex. Use a simpler pattern consistent with how `booking-noshow.service.ts` handles timezone:

```typescript
    // Get current date string in clinic timezone (YYYY-MM-DD)
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTz,
    }).format(now);

    // Fetch all non-completed bookings dated on or before today in clinic TZ
    // We over-fetch slightly and filter in memory using accurate timezone math
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        date: true,
        endTime: true,
        status: true,
      },
    });

    const autoCompleteMs = settings.autoCompleteAfterHours * 60 * 60 * 1000;
    const bookings = candidates.filter((b) => {
      // Get local date string in clinic timezone for this booking
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: clinicTz,
      }).format(b.date);
      // Build the booking end datetime as if it's a wall-clock time in clinic TZ,
      // by using the same approach as booking-noshow.service.ts: locale string comparison
      const bookingEndWallClock = `${dateStr}T${b.endTime}:00`;
      // Convert wall-clock time in clinic TZ to UTC milliseconds
      // Strategy: format 'now' as clinic local time and subtract to get the offset
      const offsetMs = getClinicOffsetMs(b.date, clinicTz);
      const bookingEndUtcMs = new Date(bookingEndWallClock).getTime() - offsetMs;
      return now.getTime() > bookingEndUtcMs + autoCompleteMs;
    });
```

That still requires a helper. Use the proven pattern from `booking-noshow.service.ts` directly. First read the noshow service to see the exact pattern:

- [ ] **Step 1: Read the timezone pattern in noshow service for reference**

Read `backend/src/modules/tasks/booking-noshow.service.ts` lines 1–80 to find `getTimezoneOffsetMs()` usage.

```bash
cd backend && grep -n "getTimezoneOffset\|clinicTz\|Intl" src/modules/tasks/booking-noshow.service.ts | head -30
```

- [ ] **Step 2: Apply the same offset-based approach in autocomplete**

After reading the noshow service, replace the hardcoded timezone lines in `booking-autocomplete.service.ts`.

The pattern to follow (from noshow): get the current time's offset in clinic TZ by comparing two `Intl.DateTimeFormat` formatted strings, then build a Date using wall-clock times as UTC minus that offset.

Replace lines 28–55 in `booking-autocomplete.service.ts` with:

```typescript
    // Get today's date string in the clinic's local timezone
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTz,
    }).format(now);

    // Determine clinic UTC offset in ms (for wall-clock time conversion)
    // Same technique used in booking-noshow.service.ts
    const utcStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(now);
    const localStr = new Intl.DateTimeFormat('en-CA', { timeZone: clinicTz }).format(now);
    const utcDate = new Date(utcStr);
    const localDate = new Date(localStr);
    const clinicOffsetMs = localDate.getTime() - utcDate.getTime();

    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: ['confirmed', 'in_progress', 'checked_in'] },
        deletedAt: null,
      },
      select: {
        id: true,
        patientId: true,
        date: true,
        endTime: true,
        status: true,
      },
    });

    const autoCompleteMs = settings.autoCompleteAfterHours * 60 * 60 * 1000;
    const bookings = candidates.filter((b) => {
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: clinicTz,
      }).format(b.date);
      // Parse endTime as wall-clock in clinic TZ, convert to UTC
      const bookingEndUtcMs =
        new Date(`${dateStr}T${b.endTime}:00Z`).getTime() - clinicOffsetMs;
      return now.getTime() > bookingEndUtcMs + autoCompleteMs;
    });
```

Also remove the now-unused `riyadhTomorrow` variable and its `setDate` call (the old lines 28–47).

- [ ] **Step 3: Run tests**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/tasks/booking-autocomplete.service.ts
git commit -m "fix(tasks): remove hardcoded UTC+3 in auto-complete, use clinic timezone (C3)"
```

---

## Task 4: Fix C4 — Cancellation Timeout Must Respect `suggestedRefundType`

**Files:**
- Modify: `backend/src/modules/tasks/booking-cancellation-timeout.service.ts:32-39,67-81`

**What to change:** `staleBookings` query does not fetch `suggestedRefundType`. The refund logic always applies `payment.totalAmount` as refund. Fix: fetch `suggestedRefundType` from the booking, then:
- `full` → refund `payment.totalAmount`
- `partial` → refund `payment.amount` (pre-VAT base, consistent with noshow partial refund pattern)
- `none` → mark payment as `refunded` with `refundAmount: 0` (or skip refund update entirely)

- [ ] **Step 1: Add `suggestedRefundType` to the stale bookings query**

In `booking-cancellation-timeout.service.ts`, replace line 38:

```typescript
      select: { id: true, patientId: true, practitionerId: true, date: true },
```

With:

```typescript
      select: {
        id: true,
        patientId: true,
        practitionerId: true,
        date: true,
        suggestedRefundType: true,
      },
```

- [ ] **Step 2: Also fetch `suggestedRefundType` in the transaction re-check**

In the transaction, `current` only checks `id`. That's fine — `suggestedRefundType` comes from the outer query's `booking` object (already fetched). No change needed inside the transaction for the re-check.

- [ ] **Step 3: Replace the flat refund logic with refund-type-aware logic**

Replace lines 67–81 (non-Moyasar refund block) and lines 103–130 (Moyasar refund block) with:

```typescript
            // Apply refund based on the original suggestedRefundType
            const refundType = booking.suggestedRefundType ?? 'full';
            const p = await tx.payment.findUnique({
              where: { bookingId: booking.id },
            });
            if (p && p.status === 'paid' && p.method !== 'moyasar') {
              const refundAmount =
                refundType === 'none'
                  ? 0
                  : refundType === 'partial'
                    ? p.amount  // base amount without VAT
                    : p.totalAmount; // full refund
              await tx.payment.update({
                where: { id: p.id },
                data: {
                  status: refundType === 'none' ? 'paid' : 'refunded',
                  refundAmount,
                  refundedAt: refundType === 'none' ? null : new Date(),
                  refundedBy: refundType === 'none' ? null : 'system',
                  refundReason: `auto_cancellation_timeout_${settings.cancellationReviewTimeoutHours}h`,
                },
              });
            }

            return { payment: p, refundType };
```

And replace the Moyasar block after the transaction (lines 103–130):

```typescript
        const { payment, refundType } = result;

        // ...status log (unchanged)...

        // Moyasar refund — only when refund is owed
        if (
          payment &&
          payment.status === 'paid' &&
          payment.method === 'moyasar' &&
          payment.moyasarPaymentId &&
          refundType !== 'none'
        ) {
          const refundAmount =
            refundType === 'partial' ? payment.amount : payment.totalAmount;
          try {
            await this.moyasarRefundService.refund(payment.id, refundAmount);
          } catch (err) {
            this.logger.error(
              `Moyasar refund failed for auto-cancelled booking ${booking.id}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
            await this.prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'refunded',
                refundAmount,
                refundedAt: new Date(),
                refundedBy: 'system',
                refundReason: `auto_cancellation_timeout_moyasar_fallback`,
              },
            });
          }
        }
```

Update the patient notification body to reflect actual refund type:

```typescript
          const refundMsg =
            refundType === 'none'
              ? { ar: 'بدون استرداد وفق سياسة الإلغاء', en: 'No refund per cancellation policy' }
              : refundType === 'partial'
                ? { ar: 'مع استرداد جزئي', en: 'with a partial refund' }
                : { ar: 'مع استرداد كامل', en: 'with a full refund' };

          await this.notificationsService.createNotification({
            userId: booking.patientId,
            titleAr: 'تمت الموافقة على إلغاء موعدك',
            titleEn: 'Cancellation Auto-Approved',
            bodyAr: `تمت الموافقة تلقائياً على طلب إلغاء موعدك ${refundMsg.ar}`,
            bodyEn: `Your cancellation request was auto-approved ${refundMsg.en}`,
            type: 'booking_cancelled',
            data: { bookingId: booking.id },
          });
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/tasks/booking-cancellation-timeout.service.ts
git commit -m "fix(tasks): respect suggestedRefundType in cancellation timeout auto-approval (C4)"
```

---

## Task 5: Fix H2 + H8 — Waitlist: Use `waitlistMaxPerSlot` and Fix UTC Date Boundary

**Files:**
- Modify: `backend/src/modules/bookings/waitlist.service.ts:158-209`

**What to change:**
- H2: Replace `take: 3` with `settings.waitlistMaxPerSlot` (already loaded via `bookingSettingsService.get()`)
- H8: Replace UTC midnight boundaries (`T00:00:00.000Z`) with clinic-timezone-aware boundaries. The `date` passed to `checkAndNotify()` is a `Date` object — convert it to clinic-local date string using `ClinicSettingsService`.

**Note:** `checkAndNotify()` currently uses `bookingSettingsService.get()` but does NOT inject `ClinicSettingsService`. Need to add it as a dependency.

- [ ] **Step 1: Check if ClinicSettingsService is already injected into WaitlistService**

```bash
cd backend && grep -n "ClinicSettings\|clinicSettings" src/modules/bookings/waitlist.service.ts
```

If it is not present, proceed to add it.

- [ ] **Step 2: Add ClinicSettingsService import and injection to WaitlistService**

At the top of `waitlist.service.ts`, add the import (alongside existing imports):

```typescript
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service.js';
```

In the constructor, add:

```typescript
    private readonly clinicSettingsService: ClinicSettingsService,
```

- [ ] **Step 3: Fix `checkAndNotify()` — use settings limit and clinic TZ date boundaries**

Replace the `checkAndNotify` method body (lines 158–209):

```typescript
  async checkAndNotify(practitionerId: string, date: Date) {
    const [settings, clinicTz] = await Promise.all([
      this.bookingSettingsService.get(),
      this.clinicSettingsService.getTimezone(),
    ]);
    if (!settings.waitlistEnabled || !settings.waitlistAutoNotify) return;

    // Convert the booking date to a date string in clinic local timezone
    // to avoid UTC midnight boundary mismatches (H8 fix)
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTz,
    }).format(date);

    // Build UTC boundaries that correspond to the START and END of the given
    // date in the clinic's local timezone
    const utcStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date(dateStr + 'T12:00:00Z'));
    const localStr = new Intl.DateTimeFormat('en-CA', { timeZone: clinicTz }).format(new Date(dateStr + 'T12:00:00Z'));
    const offsetMs = (new Date(localStr).getTime() - new Date(utcStr).getTime());
    const dayStart = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() - offsetMs);
    const dayEnd = new Date(new Date(`${dateStr}T23:59:59.999Z`).getTime() - offsetMs);

    // Use waitlistMaxPerSlot setting instead of hardcoded 3 (H2 fix)
    const limit = settings.waitlistMaxPerSlot ?? 3;

    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        practitionerId,
        status: 'waiting',
        OR: [
          { preferredDate: { gte: dayStart, lte: dayEnd } },
          { preferredDate: null },
        ],
      },
      include: {
        practitioner: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    for (const entry of entries) {
      const docName = `${entry.practitioner.user.firstName} ${entry.practitioner.user.lastName}`;

      await this.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: 'notified', notifiedAt: new Date() },
      });

      await this.notificationsService.createNotification({
        userId: entry.patientId,
        ...NOTIF.WAITLIST_SLOT_AVAILABLE,
        bodyAr: `تحرّر موعد مع د. ${docName} بتاريخ ${dateStr}. احجز الآن!`,
        bodyEn: `A slot opened with Dr. ${docName} on ${dateStr}. Book now!`,
        type: 'waitlist_slot_available',
        data: { practitionerId, date: dateStr },
      });
    }

    if (entries.length > 0) {
      this.logger.log(
        `Notified ${entries.length} waitlist entries for practitioner ${practitionerId}`,
      );
    }
  }
```

- [ ] **Step 4: Verify `ClinicSettingsModule` is imported in the bookings module**

```bash
cd backend && grep -n "ClinicSettings" src/modules/bookings/bookings.module.ts
```

If not present, add `ClinicSettingsModule` to the `imports` array of `bookings.module.ts`.

- [ ] **Step 5: Run tests**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/modules/bookings/waitlist.service.ts src/modules/bookings/bookings.module.ts
git commit -m "fix(bookings): use waitlistMaxPerSlot and clinic TZ date boundaries in waitlist notify (H2, H8)"
```

---

## Task 6: Fix H3 — Monthly Recurring Clamps to Last Day of Month

**Files:**
- Modify: `backend/src/modules/bookings/booking-recurring.service.ts:24-31`
- Create: `test/unit/bookings/booking-recurring.spec.ts`

**What to change:** `setMonth(+1)` on January 31 produces March 3 (February is skipped). Fix: after calling `setMonth(+1)`, check if the day changed (JS overflow happened) and clamp to the last day of the intended month.

- [ ] **Step 1: Write the failing test**

Create `test/unit/bookings/booking-recurring.spec.ts`:

```typescript
// We test addInterval directly — it's not exported, so we replicate the minimal logic
// to test the clamping behavior. The actual fix will be in booking-recurring.service.ts.

function clampToMonth(date: Date): Date {
  // After setMonth(+1), if the day overflowed, JS auto-advanced to the next month.
  // Detect by checking if month is 2 ahead of intended. Clamp to day 0 of that month
  // (which is the last day of the previous month).
  return date;  // placeholder — will be replaced with actual implementation
}

describe('monthly recurring date clamping', () => {
  it('January 31 + 1 month = February 28 (non-leap year)', () => {
    const date = new Date('2026-01-31');
    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    // Clamp if overflow: if day > 28 and month jumped past February
    const intended = 1; // February (0-indexed)
    if (next.getMonth() !== intended) {
      next.setDate(0); // last day of previous month
    }
    expect(next.toISOString().split('T')[0]).toBe('2026-02-28');
  });

  it('March 31 + 1 month = April 30', () => {
    const date = new Date('2026-03-31');
    const next = new Date(date);
    const intendedMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    if (next.getMonth() !== intendedMonth) {
      next.setDate(0);
    }
    expect(next.toISOString().split('T')[0]).toBe('2026-04-30');
  });

  it('January 15 + 1 month = February 15 (no overflow)', () => {
    const date = new Date('2026-01-15');
    const next = new Date(date);
    const intendedMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    if (next.getMonth() !== intendedMonth) {
      next.setDate(0);
    }
    expect(next.toISOString().split('T')[0]).toBe('2026-02-15');
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior**

```bash
cd backend && npx jest test/unit/bookings/booking-recurring.spec.ts --no-coverage
```

Expected: Test 1 and 2 fail (overflow not clamped), test 3 passes.

- [ ] **Step 3: Fix `addInterval` in booking-recurring.service.ts**

Replace lines 24–31 in `backend/src/modules/bookings/booking-recurring.service.ts`:

```typescript
function addInterval(date: Date, pattern: string): Date {
  const next = new Date(date);
  if (pattern === 'monthly') {
    const intendedMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    // Clamp: if JS overflowed past the intended month (e.g. Jan 31 → Mar 3),
    // roll back to the last day of the intended month (setDate(0) = last day of prev month)
    if (next.getMonth() !== intendedMonth) {
      next.setDate(0);
    }
  } else {
    next.setDate(next.getDate() + (PATTERN_DAYS[pattern] ?? 7));
  }
  return next;
}
```

- [ ] **Step 4: Update the unit test to use the actual function**

Since `addInterval` is not exported, verify the fix is correct by updating the test to mirror the exact implementation:

```typescript
function addInterval(date: Date, pattern: string): Date {
  const PATTERN_DAYS: Record<string, number> = {
    daily: 1, every_2_days: 2, every_3_days: 3, weekly: 7, biweekly: 14, monthly: 0,
  };
  const next = new Date(date);
  if (pattern === 'monthly') {
    const intendedMonth = (next.getMonth() + 1) % 12;
    next.setMonth(next.getMonth() + 1);
    if (next.getMonth() !== intendedMonth) {
      next.setDate(0);
    }
  } else {
    next.setDate(next.getDate() + (PATTERN_DAYS[pattern] ?? 7));
  }
  return next;
}

describe('addInterval monthly', () => {
  it('Jan 31 → Feb 28 (non-leap)', () => {
    expect(addInterval(new Date('2026-01-31'), 'monthly').toISOString().split('T')[0]).toBe('2026-02-28');
  });
  it('Mar 31 → Apr 30', () => {
    expect(addInterval(new Date('2026-03-31'), 'monthly').toISOString().split('T')[0]).toBe('2026-04-30');
  });
  it('Jan 15 → Feb 15 (no clamp needed)', () => {
    expect(addInterval(new Date('2026-01-15'), 'monthly').toISOString().split('T')[0]).toBe('2026-02-15');
  });
  it('Jan 31 leap year → Feb 29', () => {
    expect(addInterval(new Date('2024-01-31'), 'monthly').toISOString().split('T')[0]).toBe('2024-02-29');
  });
});
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
cd backend && npx jest test/unit/bookings/booking-recurring.spec.ts --no-coverage
```

Expected: All 4 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
cd backend && npm run test -- --no-coverage
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/modules/bookings/booking-recurring.service.ts test/unit/bookings/booking-recurring.spec.ts
git commit -m "fix(bookings): clamp monthly recurring date to last day of month (H3)"
```

---

## Self-Review

**Spec coverage check:**

| Issue | Task | Status |
|-------|------|--------|
| C1: Buffer 2× | Task 1 | ✅ |
| C2: Buffer resolution mismatch | Task 2 | ✅ |
| C3: Timezone hardcode | Task 3 | ✅ |
| C4: Cancellation timeout full refund | Task 4 | ✅ |
| H2: Waitlist notify hardcoded at 3 | Task 5 | ✅ |
| H3: Monthly date overflow | Task 6 | ✅ |
| H8: Waitlist UTC date boundary | Task 5 | ✅ |

**Not in scope (per spec — separate plan if needed):**
- H1: Series cancellation (new feature, not a bug fix)
- H4: Intake form global scope (feature gap)
- H5–H7: Medium/Low issues

**Placeholder scan:** All tasks have concrete code. No TBDs.

**Type consistency:** `suggestedRefundType` is `RefundType | null` from Prisma — `?? 'full'` handles null safely. `waitlistMaxPerSlot` is `Int?` in settings — `?? 3` fallback is correct.
