# Practitioners P0 Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three critical P0 bugs in the Practitioners module: clinic holidays not excluded from available slots/dates (patient sees slots then gets rejected at booking), rating aggregate computed outside transaction (race condition corrupts denormalized rating), and mobile schedule screen not passing `duration`/`serviceId` to slot query.

**Architecture:** 
- Holiday fix: import `ClinicModule` into `PractitionersModule` and inject `ClinicHolidaysService` into `PractitionerAvailabilityService`. Call `isHoliday()` before slot generation in both `resolveSlots` and `getAvailableDates`.
- Rating fix: wrap `rating.create` + `updatePractitionerRating` in a single `$transaction`.
- Mobile fix: read `serviceId` and `duration` from route params and pass them to `getAvailability`.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript strict, Jest, React Native / Expo

---

## Files

- Modify: `backend/src/modules/practitioners/practitioners.module.ts`
- Modify: `backend/src/modules/practitioners/practitioner-availability.service.ts`
- Modify: `backend/src/modules/ratings/ratings.service.ts`
- Modify: `mobile/app/(patient)/booking/schedule.tsx`
- Modify: `mobile/services/practitioners.ts`
- Test: `backend/test/unit/practitioners/practitioner-availability.service.spec.ts`
- Test: `backend/test/unit/ratings/ratings.service.spec.ts`

---

## Task 1: Inject ClinicHolidaysService and exclude holidays from `resolveSlots` and `getAvailableDates`

**Files:**
- Modify: `backend/src/modules/practitioners/practitioners.module.ts`
- Modify: `backend/src/modules/practitioners/practitioner-availability.service.ts`
- Test: `backend/test/unit/practitioners/practitioner-availability.service.spec.ts`

**Problem:** `resolveSlots` (single date) and `getAvailableDates` (monthly calendar) never check `ClinicHoliday`. `BookingValidationHelper.validateClinicHoliday()` does check — so the patient sees an available date, tries to book, and gets rejected.

- [ ] **Step 1: Add `ClinicModule` import to `practitioners.module.ts`**

Replace `practitioners.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { FavoritePractitionersController } from './favorite-practitioners.controller.js';
import { PractitionersController } from './practitioners.controller.js';
import { PractitionersService } from './practitioners.service.js';
import { PractitionerAvailabilityService } from './practitioner-availability.service.js';
import { PractitionerVacationService } from './practitioner-vacation.service.js';
import { PractitionerServiceService } from './practitioner-service.service.js';
import { PractitionerRatingsService } from './practitioner-ratings.service.js';
import { PractitionerBreaksService } from './practitioner-breaks.service.js';
import { FavoritePractitionersService } from './favorite-practitioners.service.js';
import { PractitionerOnboardingService } from './practitioner-onboarding.service.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module.js';
import { ClinicModule } from '../clinic/clinic.module.js';

@Module({
  imports: [BookingsModule, AuthModule, EmailModule, ClinicSettingsModule, ClinicModule],
  controllers: [FavoritePractitionersController, PractitionersController],
  providers: [
    PractitionersService,
    PractitionerAvailabilityService,
    PractitionerVacationService,
    PractitionerBreaksService,
    PractitionerServiceService,
    PractitionerRatingsService,
    FavoritePractitionersService,
    PractitionerOnboardingService,
  ],
  exports: [PractitionersService, PractitionerServiceService],
})
export class PractitionersModule {}
```

- [ ] **Step 2: Write failing tests for holiday exclusion**

In `backend/test/unit/practitioners/practitioner-availability.service.spec.ts`, add:

```typescript
describe('getAvailableDates — holiday exclusion', () => {
  it('should exclude a day that is a clinic holiday', async () => {
    // Practitioner is accepting, has availability every Monday
    prisma.practitioner.findFirst.mockResolvedValue({
      id: 'p-1', isAcceptingBookings: true, deletedAt: null,
    });
    prisma.practitionerAvailability.findMany.mockResolvedValue([
      { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
    ]);
    prisma.practitionerVacation.findMany.mockResolvedValue([]);
    prisma.practitionerBreak.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    bookingSettingsService.getForBranch.mockResolvedValue({ bufferMinutes: 0 });
    clinicSettingsService.getTimezone.mockResolvedValue('Asia/Riyadh');

    // 2026-04-13 is a Monday
    clinicHolidaysService.isHoliday.mockImplementation(async (date: Date) => {
      return date.toISOString().slice(0, 10) === '2026-04-13';
    });

    const result = await service.getAvailableDates('p-1', '2026-04');

    expect(result.availableDates).not.toContain('2026-04-13');
  });
});

describe('getSlots — holiday exclusion', () => {
  it('should return empty slots for a holiday date', async () => {
    prisma.practitioner.findFirst.mockResolvedValue({
      id: 'p-1', isAcceptingBookings: true, deletedAt: null,
    });
    prisma.practitionerAvailability.findMany.mockResolvedValue([
      { practitionerId: 'p-1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true, branchId: null },
    ]);
    prisma.practitionerVacation.findFirst.mockResolvedValue(null);

    clinicHolidaysService.isHoliday.mockResolvedValue(true);

    const result = await service.getSlots('p-1', '2026-04-13', 30);

    expect(result.slots).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="practitioner-availability" --no-coverage
```

Expected: FAIL — `clinicHolidaysService.isHoliday` is not injected yet.

- [ ] **Step 4: Inject `ClinicHolidaysService` into `PractitionerAvailabilityService`**

In `practitioner-availability.service.ts`, update imports and constructor:

```typescript
import { ClinicHolidaysService } from '../clinic/clinic-holidays.service.js';
```

Add to constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly bookingSettingsService: BookingSettingsService,
  private readonly clinicSettingsService: ClinicSettingsService,
  private readonly clinicHolidaysService: ClinicHolidaysService,
) {}
```

- [ ] **Step 5: Add holiday check in `resolveSlots`**

In `resolveSlots`, after the vacation check (after line 264 `if (vacation) return ...`), add:

```typescript
// Exclude clinic holidays — same rule as booking-validation.helper.ts
const isHoliday = await this.clinicHolidaysService.isHoliday(normalizedDate);
if (isHoliday) return { date, practitionerId, slots: [] };
```

- [ ] **Step 6: Add holiday check in `getAvailableDates` loop**

In `getAvailableDates`, inside the `while (cursor <= lastDay)` loop, after the vacation check (after `if (onVacation) { cursor.setUTCDate... continue; }`), add:

```typescript
// Skip clinic holidays
const isHoliday = await this.clinicHolidaysService.isHoliday(cursor);
if (isHoliday) {
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  continue;
}
```

**Note:** `clinicHolidaysService.isHoliday` fetches from Redis cache (5-min TTL). Calling it once per loop day is safe — it loads all holidays once, then checks in-memory. No N+1 concern.

Also move `clinicTz` outside the loop (existing N+1 bug P1-5):

```typescript
// Move this BEFORE the while loop (currently it's inside at line 192):
const clinicTz = await this.clinicSettingsService.getTimezone();
```

Remove the `await this.clinicSettingsService.getTimezone()` call from inside the loop.

- [ ] **Step 7: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="practitioner-availability" --no-coverage
```

Expected: PASS

- [ ] **Step 8: Run typecheck**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 9: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 10: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/practitioners/practitioners.module.ts \
        backend/src/modules/practitioners/practitioner-availability.service.ts \
        backend/test/unit/practitioners/practitioner-availability.service.spec.ts
git commit -m "fix(practitioners): exclude clinic holidays from available slots and dates

Also fixes N+1: getTimezone() moved outside daily loop in getAvailableDates

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Fix Rating race condition — wrap `create` + `updatePractitionerRating` in transaction

**Files:**
- Modify: `backend/src/modules/ratings/ratings.service.ts`
- Test: `backend/test/unit/ratings/ratings.service.spec.ts`

**Problem (lines 52-69):** `rating.create` then `updatePractitionerRating` (which calls `rating.aggregate` + `practitioner.update`) run as three separate DB operations. Two concurrent ratings can both read the same aggregate count and write the same (stale) average.

- [ ] **Step 1: Write the failing test**

In `backend/test/unit/ratings/ratings.service.spec.ts`, add:

```typescript
describe('create rating', () => {
  it('should call updatePractitionerRating inside the same transaction', async () => {
    const booking = {
      id: 'booking-1',
      status: 'completed',
      practitionerId: 'p-1',
      rating: null,
    };

    prisma.booking.findFirst.mockResolvedValue(booking);

    let transactionWasCalled = false;
    prisma.$transaction.mockImplementation(async (fn) => {
      transactionWasCalled = true;
      const tx = {
        rating: {
          create: jest.fn().mockResolvedValue({ id: 'rating-1', stars: 5 }),
          aggregate: jest.fn().mockResolvedValue({ _avg: { stars: 4.5 }, _count: { id: 2 } }),
        },
        practitioner: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    await service.create({
      bookingId: 'booking-1',
      patientId: 'patient-1',
      stars: 5,
    });

    expect(transactionWasCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="ratings" --no-coverage
```

Expected: FAIL — current code does NOT use `$transaction` for rating creation.

- [ ] **Step 3: Implement the fix — wrap create + updatePractitionerRating in $transaction**

In `ratings.service.ts`, replace the `create` method (lines 27-71):

```typescript
async create(dto: CreateRatingDto) {
  const booking = await this.prisma.booking.findFirst({
    where: { id: dto.bookingId, patientId: dto.patientId, deletedAt: null },
    select: { id: true, status: true, practitionerId: true, rating: true },
  });

  if (!booking) {
    throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
  }

  if (booking.status !== 'completed') {
    throw new BadRequestException('Cannot rate a booking that is not completed');
  }

  if (booking.rating) {
    throw new BadRequestException('This booking has already been rated');
  }

  if (dto.stars < 1 || dto.stars > 5) {
    throw new BadRequestException('Stars must be between 1 and 5');
  }

  let rating;
  try {
    rating = await this.prisma.$transaction(async (tx) => {
      const newRating = await tx.rating.create({
        data: {
          bookingId: dto.bookingId,
          patientId: dto.patientId,
          practitionerId: booking.practitionerId,
          stars: dto.stars,
          comment: dto.comment,
        },
      });

      // Compute and update aggregate inside same transaction — prevents race condition
      // where two concurrent ratings both read stale count and write stale average.
      const stats = await tx.rating.aggregate({
        where: { practitionerId: booking.practitionerId, deletedAt: null },
        _avg: { stars: true },
        _count: { id: true },
      });

      await tx.practitioner.update({
        where: { id: booking.practitionerId },
        data: {
          rating: stats._avg.stars ?? 0,
          reviewCount: stats._count.id,
        },
      });

      return newRating;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ConflictException('This booking has already been rated');
    }
    throw err;
  }

  return rating;
}
```

Remove the `updatePractitionerRating` standalone method call from `create` (it's now inlined). Keep `updatePractitionerRating` as a public method since it may be called from other places (e.g., soft-delete rating in the future).

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test -- --testPathPattern="ratings" --no-coverage
```

Expected: PASS

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/backend
npm run test --no-coverage
```

Expected: All passing

- [ ] **Step 6: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add backend/src/modules/ratings/ratings.service.ts \
        backend/test/unit/ratings/ratings.service.spec.ts
git commit -m "fix(ratings): prevent race condition — create rating + update aggregate in single transaction

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix Mobile — pass `serviceId` and `duration` to slot query

**Files:**
- Modify: `mobile/services/practitioners.ts`
- Modify: `mobile/app/(patient)/booking/schedule.tsx`

**Problem:** `schedule.tsx` calls `practitionersService.getAvailability(practitionerId, selectedDate)` with no `duration` or `serviceId`. Backend defaults to `duration=30`. If the booked service has a different duration (e.g., 60 min), the displayed slots don't match what the backend will compute for the actual booking, resulting in false availability.

The route params already carry `type` (bookingType string). We need `serviceId` and `duration` passed from the previous screen.

- [ ] **Step 1: Update `mobile/services/practitioners.ts` — add params to `getAvailability`**

Replace the `getAvailability` method:

```typescript
async getAvailability(id: string, date: string, options?: { duration?: number; serviceId?: string; bookingType?: string }) {
  const response = await api.get<ApiResponse<{ slots: Array<{ startTime: string; endTime: string; available: boolean }> }>>(
    `/practitioners/${id}/slots`,
    {
      params: {
        date,
        ...(options?.duration && { duration: options.duration }),
        ...(options?.serviceId && { serviceId: options.serviceId }),
        ...(options?.bookingType && { bookingType: options.bookingType }),
      },
    },
  );
  return response.data;
},
```

- [ ] **Step 2: Update `mobile/app/(patient)/booking/schedule.tsx` — read `serviceId` + `duration` from params and pass them**

Change the `useLocalSearchParams` destructure to include the new params:

```typescript
const { practitionerId, type, serviceId, duration } = useLocalSearchParams<{
  practitionerId: string;
  type: string;
  serviceId?: string;
  duration?: string;
}>();
```

Change the `useEffect` that fetches slots:

```typescript
useEffect(() => {
  if (selectedDate && practitionerId) {
    practitionersService
      .getAvailability(practitionerId, selectedDate, {
        duration: duration ? parseInt(duration, 10) : undefined,
        serviceId: serviceId ?? undefined,
        bookingType: type ?? undefined,
      })
      .then((res) => {
        const available = res.data?.slots?.filter((s) => s.available).map((s) => s.startTime) ?? [];
        setSlots(available);
      })
      .catch(() => setSlots([]));
  }
}, [selectedDate, practitionerId, duration, serviceId, type]);
```

- [ ] **Step 3: Fix hardcoded gradient colors (white-label violation)**

In `schedule.tsx`, find the two `LinearGradient` components with `colors={['#0037B0', '#1D4ED8']}` and replace with theme tokens:

```typescript
// Add this near other const declarations
const gradientColors: [string, string] = [theme.colors.primaryDark ?? '#0037B0', theme.colors.primary ?? '#1D4ED8'];
```

Then replace both `colors={['#0037B0', '#1D4ED8']}` with `colors={gradientColors}`.

Also replace `selectedColor: '#1D4ED8'` and `todayTextColor: '#1D4ED8'` in the Calendar theme with `theme.colors.primary`.

- [ ] **Step 4: Run typecheck on mobile**

```bash
cd /Users/tariq/Documents/my_programs/CareKit/mobile
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/Documents/my_programs/CareKit
git add mobile/services/practitioners.ts \
        mobile/app/(patient)/booking/schedule.tsx
git commit -m "fix(mobile): pass serviceId and duration to slot query — prevents false availability display

Also removes hardcoded gradient colors in favor of theme tokens

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
