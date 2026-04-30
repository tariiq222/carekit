# Bookings Module — Architecture & Functional Analysis

**Date:** 2026-04-11  
**Scope:** End-to-end — Backend (NestJS), Dashboard (Next.js), Mobile (Expo), Task Scheduler  
**Purpose:** Architectural documentation + functional conflict analysis for onboarding and future development

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Data Model (Schema)](#2-data-model-schema)
3. [Service Architecture Map](#3-service-architecture-map)
4. [State Machine](#4-state-machine)
5. [Data Flow — End-to-End](#5-data-flow--end-to-end)
6. [Task Scheduler (Automated Transitions)](#6-task-scheduler-automated-transitions)
7. [Pricing Resolution Chain](#7-pricing-resolution-chain)
8. [Recurring Bookings](#8-recurring-bookings)
9. [Waitlist System](#9-waitlist-system)
10. [Zoom Integration](#10-zoom-integration)
11. [Settings Architecture](#11-settings-architecture)
12. [Cross-Module Dependencies](#12-cross-module-dependencies)
13. [HTTP API Surface](#13-http-api-surface)
14. [Functional Conflicts & Issues](#14-functional-conflicts--issues)

---

## 1. Module Overview

The bookings module is the most complex domain in Deqah. It manages the full lifecycle of a patient appointment — from creation through payment, clinical workflow (check-in → session → completion), and cancellation with refund processing.

**File count:** 25+ files across `backend/src/modules/bookings/` and `backend/src/modules/tasks/`

**Decomposition pattern:** Single facade (`bookings.service.ts`) delegates to focused sub-services. Each sub-service owns one concern and has no overlap with others.

```
bookings.service.ts          ← Thin facade, all delegation
├── booking-creation.service.ts
├── booking-cancellation.service.ts
├── booking-status.service.ts
├── booking-reschedule.service.ts
├── booking-query.service.ts
├── booking-recurring.service.ts
├── booking-settings.service.ts
├── booking-status-log.service.ts
├── waitlist.service.ts
├── price-resolver.service.ts
├── booking-payment.helper.ts
├── booking-cancel-helpers.service.ts
├── booking-lookup.helper.ts
└── booking-validation.helper.ts (pure functions)
```

---

## 2. Data Model (Schema)

### 2.1 Booking Model (`bookings.prisma`)

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID | PK |
| `patientId` | String? | Nullable — onDelete:SetNull (preserves booking history if user deleted) |
| `branchId` | String? | Nullable — onDelete:SetNull |
| `practitionerId` | String | onDelete:Restrict (cannot delete practitioner with bookings) |
| `serviceId` | String | onDelete:Restrict |
| `practitionerServiceId` | String | onDelete:Restrict |
| `type` | BookingType | in_person / online / walk_in |
| `date` | DateTime | Date of appointment |
| `startTime` | String | "HH:mm" format |
| `endTime` | String | "HH:mm" — calculated at creation, never stored by client |
| `status` | BookingStatus | See state machine below |
| `bookedPrice` | Int? | **Immutable snapshot** in halalat — source of truth for invoicing |
| `bookedDuration` | Int? | **Immutable snapshot** in minutes |
| `durationOptionId` | String? | FK to option at time of booking (no FK constraint — snapshot) |
| `serviceDurationOptionId` | String? | FK-constrained to ServiceDurationOption (onDelete:SetNull) |
| `recurringGroupId` | UUID? | Groups sibling recurring bookings |
| `recurringPattern` | RecurringPattern? | Pattern stored per-booking for future divergence |
| `rescheduleCount` | Int | Incremented each time patient reschedules |
| `rescheduledFromId` | String? @unique | Self-reference chain link |
| `isWalkIn` | Boolean | Walk-in flag |
| `suggestedRefundType` | RefundType? | Calculated when entering pending_cancellation |
| `zoomMeetingId` | String? | Populated on-demand at session time (not at creation) |
| `zoomJoinUrl` | String? | |
| `zoomHostUrl` | String? | |
| State timestamps | DateTime? | confirmedAt, checkedInAt, inProgressAt, completedAt, cancelledAt, noShowAt |
| `cancelledBy` | CancelledBy? | patient / practitioner / admin / system |

**Design decisions documented in schema header:**
- State timestamps are intentional denormalization (fast single-row reads without joining BookingStatusLog)
- Price/duration snapshot is immutable — service price changes must not affect past bookings
- Zoom fields are candidates for future extraction to a `BookingMeeting` table

**Indexes:** 12 indexes covering all common query patterns: `[practitionerId,date]`, `[practitionerId,status]`, `[patientId,status]`, `[status,date]`, `[branchId,date]`, `[recurringGroupId]`, etc.

### 2.2 Related Models

| Model | Purpose |
|-------|---------|
| `BookingSettings` | Multi-branch config (global default + branch overrides) |
| `BookingStatusLog` | Audit trail of every status transition |
| `WaitlistEntry` | Patient queue for slot availability |
| `IntakeForm/IntakeField/IntakeResponse` | Pre/post-session forms linked to bookings |
| `FavoritePractitioner` | Patient-practitioner relationship |
| `Payment` | 1:1 with booking (unique FK) |
| `Invoice` | 1:1 with payment |
| `BankTransferReceipt` | AI-verified transfer receipt |

### 2.3 Enums

**BookingStatus (9 values):**
`pending` → `confirmed` → `checked_in` → `in_progress` → `completed`  
`pending` → `expired` (timeout)  
`confirmed` → `pending_cancellation` → `cancelled`  
`confirmed` → `no_show`  
`expired` → `confirmed` (recovery on late payment)

**BookingType:** `in_person`, `online`, `walk_in`

**RecurringPattern:** `daily`, `every_2_days`, `every_3_days`, `weekly`, `biweekly`, `monthly`

**CancelledBy:** `patient`, `practitioner`, `admin`, `system`

**RefundType:** `full`, `partial`, `none`

**NoShowPolicy:** `keep_full`, `partial_refund`, `admin_decides`

**WaitlistStatus:** `waiting`, `notified`, `booked`, `expired`, `cancelled`

---

## 3. Service Architecture Map

### `bookings.service.ts` — Facade (101 lines)
Pure delegation layer. No business logic. Owns one method with light validation: `patientReschedule()` validates settings + ownership + status + reschedule limit before delegating to `rescheduleService`.

### `booking-creation.service.ts` — Creation (354 lines)
Full booking creation with 10-step validation sequence:
1. Resolve patient ID (privilege check for booking on behalf)
2. Validate practitioner (exists, active, accepting bookings)
3. Validate service (exists, active)
4. Validate PractitionerService relationship (exists, active, type available)
5. Validate service available at branch
6. Check walk-in settings
7. Resolve price + duration via `PriceResolverService`
8. Validate date (not past, within maxAdvanceDays, meets minLeadMinutes)
9. Validate clinic hours + holidays (skippable by admin with `adminCanBookOutsideHours`)
10. Serializable transaction (3 retries, 50ms backoff): validateAvailability → checkDoubleBooking → create booking

Post-transaction: createPaymentIfNeeded → notify practitioner → activity log → resolve intake form.

**Key design:** Status at creation = `confirmed` for walk_in or payAtClinic bookings; `pending` for all others awaiting payment.

### `booking-status.service.ts` — Status Transitions (311 lines)
Implements 6 explicit state transitions, all in Serializable transactions:

| Method | Transition | Guard |
|--------|-----------|-------|
| `confirm()` | pending → confirmed | Requires payment.status = 'paid' |
| `checkIn()` | confirmed → checked_in | Status must be 'confirmed' |
| `startSession()` | checked_in → in_progress | Status must be 'checked_in'; practitioner owns it |
| `complete()` | in_progress → completed | Status must be 'in_progress' |
| `markNoShow()` | confirmed → no_show | Status must be 'confirmed' only |
| `recoverExpiredBooking()` | expired → confirmed | Idempotent via updateMany with status condition |

### `booking-cancellation.service.ts` — Cancellation (308 lines)
5 distinct cancellation paths:

| Method | Actor | Flow |
|--------|-------|------|
| `requestCancellation()` | Patient | pending → direct cancel; confirmed/checked_in → pending_cancellation |
| `approveCancellation()` | Admin | pending_cancellation → cancelled + refund |
| `rejectCancellation()` | Admin | pending_cancellation → confirmed (restore) |
| `adminDirectCancel()` | Admin | Any ADMIN_CANCELLABLE_STATUSES → cancelled |
| `practitionerCancel()` | Practitioner | Any → cancelled (always full refund) |

`ADMIN_CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in', 'pending_cancellation']`  
Note: `in_progress` is in `NON_CANCELLABLE` — admin cannot cancel active sessions.

### `booking-reschedule.service.ts` — Reschedule (125 lines)
Creates a new booking record and cancels the old one (rescheduledFromId chain). Transfers payment to new booking ID. For online bookings, creates a new Zoom meeting for the new time, deletes the old one.

**Pattern:** Reschedule = cancel old + create new (immutable snapshot preserved from original).

### `booking-query.service.ts` — Queries (320 lines)
Role-based queries. Admin sees all; Practitioner sees own; Patient sees own.  
`getNextAvailableSlots()` uses 2 bulk DB queries (O(1) map lookups) instead of N sequential queries — performance-optimized alternative suggestion on booking conflict.

### `booking-recurring.service.ts` — Recurring (151 lines)
Creates a series of bookings by calling `bookingsService.create()` in a loop. Each booking is independent — validates separately. Conflicts are collected and returned (partial success allowed). Pattern intersection: service patterns ∩ clinic patterns.

### `waitlist.service.ts` — Waitlist (213 lines)
Three operations: `join()`, `leave()`, `checkAndNotify()`.  
`checkAndNotify()` is called post-cancellation/expiry to notify the first 3 waiting patients. Notification only — promotion to booking is manual (patient must book themselves after receiving notification).

### `price-resolver.service.ts` — Price Resolution (140 lines)
See [Section 7](#7-pricing-resolution-chain).

### `booking-payment.helper.ts` — Payment Creation (94 lines)
`resolvePatientId()`: Privilege check for booking on behalf. Allowed roles: `super_admin`, `receptionist`, `owner`.  
`createPaymentIfNeeded()`: Creates payment record. Handles deposit logic, cash (payAtClinic), free services (no payment), walk-in (payment optional by settings).

### `booking-cancel-helpers.service.ts` — Cancel Helpers (211 lines)
`calculateSuggestedRefund()`: Time-based logic — free cancel if > `freeCancelBeforeHours`, late cancel policy otherwise.  
`processRefund()`: Updates payment record + calls Moyasar API for card payments.  
`notifyAdmins()`: Broadcasts to all users with `super_admin` or `receptionist` roles.

### `booking-validation.helper.ts` — Validation (185 lines, pure functions)
`validateAvailability()`: Checks practitioner vacation + availability schedule (day-of-week based).  
`checkDoubleBooking()`: Buffer-aware overlap detection. Buffer applied symmetrically to both sides.  
`validateClinicAvailability()`: Clinic hours + holiday check.

### `booking-lookup.helper.ts` — Lookup (96 lines)
`findOrFail()`: Unified lookup with optional includes. Deprecated methods (`findBookingOrFail`, `findWithPayment`, `findWithRelations`) preserved for backwards compatibility.  
`assertCancellable()`, `assertPatientOwnership()`, `assertPractitionerOwnership()`: Centralized guards.

### `booking-settings.service.ts` — Settings (86 lines)
Redis-cached settings with 1-hour TTL. Branch resolution: branch row ?? global row. Cache invalidated on update.

---

## 4. State Machine

```
                    ┌─────────────────────────────────┐
                    │              pending              │
                    └──┬──────────────┬───────────────┘
                       │              │
              payment.paid        timeout (cron)
                       │              │
                       ▼              ▼
               ┌──────────┐      ┌─────────┐
               │ confirmed │      │ expired │──── late payment ──→ confirmed
               └──┬──┬──┬──┘      └─────────┘
                  │  │  │
          patient │  │  │ admin/practitioner cancel
        requests  │  │  │
           cancel │  │  │ ───────────────────────────→ cancelled
                  │  │  │
      check-in ◄──┘  │  └──► no_show (cron/manual, confirmed only)
                      │
              auto-complete (cron)
                      │
    ┌─────────────────────────────────────────────┐
    │              confirmed                       │
    └─────────────────────────────────────────────┘
    
confirmed → checked_in → in_progress → completed
                                   ↑
                         auto-complete (cron) also from
                         confirmed and checked_in

pending_cancellation:
  confirmed/checked_in ──patient cancel──→ pending_cancellation
  pending_cancellation ──admin approve──→ cancelled
  pending_cancellation ──admin reject──→ confirmed
  pending_cancellation ──48h timeout──→ cancelled (auto, full refund)
```

### Complete Transition Table

| From | To | Trigger | Service | Guard |
|------|----|---------|---------|-------|
| pending | confirmed | Payment webhook | BookingStatusService.confirm() | payment.status='paid' |
| pending | cancelled | Patient cancel (pending) | BookingCancellationService.handlePendingCancel() | settings.patientCanCancelPending |
| pending | cancelled | Admin direct cancel | BookingCancellationService.adminDirectCancel() | — |
| pending | expired | Cron (payment timeout) | BookingExpiryService | createdAt < cutoff, no paid payment |
| confirmed | checked_in | Manual/receptionist | BookingStatusService.checkIn() | status='confirmed' |
| confirmed | in_progress | Practitioner starts | BookingStatusService.startSession() | status='checked_in' first (explicit error if not) |
| confirmed | pending_cancellation | Patient requests | BookingCancellationService.handleConfirmedCancelRequest() | status in [confirmed, checked_in] |
| confirmed | cancelled | Admin direct cancel | BookingCancellationService.adminDirectCancel() | — |
| confirmed | cancelled | Practitioner cancel | BookingCancellationService.practitionerCancel() | owns booking |
| confirmed | no_show | Manual | BookingStatusService.markNoShow() | status='confirmed' only |
| confirmed | no_show | Cron (autoNoShow) | BookingNoShowService | past startTime + autoNoShowAfterMinutes |
| confirmed | completed | Cron (autoComplete) | BookingAutocompleteService | past endTime + autoCompleteAfterHours |
| checked_in | in_progress | Practitioner starts | BookingStatusService.startSession() | practitioner owns booking |
| checked_in | completed | Cron (autoComplete) | BookingAutocompleteService | — |
| in_progress | completed | Manual | BookingStatusService.complete() | status='in_progress' |
| in_progress | completed | Cron (autoComplete) | BookingAutocompleteService | — |
| pending_cancellation | cancelled | Admin approves | BookingCancellationService.approveCancellation() | — |
| pending_cancellation | cancelled | Cron (48h timeout) | BookingCancellationTimeoutService | updatedAt < cutoff |
| pending_cancellation | confirmed | Admin rejects | BookingCancellationService.rejectCancellation() | — |
| expired | confirmed | Late payment success | BookingStatusService.recoverExpiredBooking() | Idempotent updateMany |

---

## 5. Data Flow — End-to-End

### 5.1 Receptionist Creates Booking (Dashboard)

```
POST /bookings
  └── BookingCreationService.execute()
        ├── 1. resolvePatientId() — privilege check
        ├── 2-5. Validate practitioner, service, PS, branch
        ├── 6. Walk-in settings check
        ├── 7. PriceResolverService.resolve() → {price, duration, source}
        ├── 8. Date/time validation (past, maxAdvanceDays, leadMinutes)
        ├── 9. validateClinicAvailability() (skipped if admin override)
        └── 10. $transaction (Serializable, 3 retries):
              ├── validateAvailability() — vacation + schedule
              ├── checkDoubleBooking() — buffer-aware overlap
              └── booking.create({
                    status: 'confirmed' if walkIn/payAtClinic else 'pending',
                    bookedPrice, bookedDuration  ← immutable snapshot
                  })
        
        Post-transaction:
        ├── createPaymentIfNeeded() → payment record (cash/moyasar/deposit)
        ├── notificationsService → practitioner notified
        ├── activityLogService.log()
        └── Return {booking, intakeFormId, intakeFormAlreadySubmitted}
```

### 5.2 Patient Books via Mobile App

Same flow as above. `resolvePatientId()` returns `callerUserId` (patient books for themselves). Status = `pending` → patient redirected to Moyasar payment page.

### 5.3 Payment Confirmation → Booking Confirmed

```
Moyasar webhook → PaymentsController
  └── processWebhook()
        ├── payment.update({status: 'paid'})
        └── BookingStatusService.confirm(bookingId)
              └── $transaction: status 'pending' → 'confirmed', confirmedAt=now
              └── notify patient (booking_confirmed)
```

### 5.4 Day-of-Appointment Workflow (Receptionist + Practitioner)

```
Receptionist Dashboard:
  POST /bookings/:id/check-in
    └── status: confirmed → checked_in, checkedInAt=now
    └── notify practitioner (patient_arrived)

Practitioner Mobile App:
  POST /bookings/:id/start
    └── status: checked_in → in_progress, inProgressAt=now
    └── (must be own booking)

Practitioner completes:
  POST /bookings/:id/complete
    └── status: in_progress → completed, completedAt=now
    └── notify patient (booking_completed / rate your experience)
```

### 5.5 Cancellation Flows

**Patient cancels pending booking:**
```
POST /bookings/:id/cancel-request
  └── status='pending' → direct cancel
      ├── payment.deleteMany({status: [awaiting, pending]})
      └── notify patient + practitioner
```

**Patient cancels confirmed booking:**
```
POST /bookings/:id/cancel-request
  └── status='confirmed' → pending_cancellation
      ├── calculateSuggestedRefund() — time-based (freeCancelBeforeHours threshold)
      └── notify admins (cancellation_requested)

Admin reviews:
  POST /bookings/:id/cancel/approve  → cancelled + refund
  POST /bookings/:id/cancel/reject   → confirmed (restored, patient notified)
```

**Timeout (48h):**
```
Cron: BookingCancellationTimeoutService
  └── pending_cancellation → cancelled (auto)
      └── full refund applied (non-Moyasar in tx, Moyasar via API post-tx)
```

### 5.6 Reschedule Flow

```
POST /bookings/:id  (admin) or  POST /bookings/:id/patient-reschedule
  └── BookingRescheduleService.reschedule()
        ├── Calculate new end time from bookedDuration (preserves original)
        ├── Create Zoom meeting (online bookings only)
        ├── $transaction:
        │   ├── validateAvailability() (new time)
        │   ├── checkDoubleBooking() (exclude current booking)
        │   ├── booking.create({...original, new date/time, rescheduledFromId=old.id})
        │   ├── old booking.update({status: 'cancelled', adminNotes: 'Rescheduled to ...'})
        │   └── payment.updateMany({bookingId: old → new})  ← transfers payment!
        ├── Delete old Zoom meeting (fire-and-forget)
        └── notify patient + practitioner
```

Patient reschedule adds additional guards in `bookings.service.patientReschedule()`:
- `settings.patientCanReschedule` must be true
- Status in `[pending, confirmed, checked_in]`
- `rescheduleCount < settings.maxReschedulesPerBooking`
- Appointment must be ≥ `rescheduleBeforeHours` away

---

## 6. Task Scheduler (Automated Transitions)

All 4 scheduled services run on BullMQ cron and include atomic re-checks inside transactions to prevent races.

| Service | Trigger | Transition | Key Behavior |
|---------|---------|-----------|--------------|
| `BookingExpiryService` | Periodic cron | pending → expired | Filters bookings with `payment: null`. Uses `filterSafeToExpire()` to skip any with active payments. Deletes `awaiting` payment records. Notifies patient + waitlist. |
| `BookingNoShowService` | Periodic cron | confirmed → no_show | Only `confirmed` status (checked_in and in_progress are excluded by design). Applies no-show financial policy: `keep_full` / `partial_refund` / `admin_decides`. Moyasar partial refund called outside transaction (external API). |
| `BookingAutocompleteService` | Periodic cron | confirmed/checked_in/in_progress → completed | Auto-completes any booking past `endTime + autoCompleteAfterHours`. Sends rating prompt to patient. |
| `BookingCancellationTimeoutService` | Periodic cron | pending_cancellation → cancelled | Auto-approves after `cancellationReviewTimeoutHours` (default 48h). Full refund applied. cancelledBy = 'system'. |

---

## 7. Pricing Resolution Chain

`PriceResolverService.resolve({serviceId, practitionerServiceId, bookingType, durationOptionId?})`

**Priority order (highest to lowest):**

```
1. If durationOptionId provided:
   a. Search in PractitionerServiceType.durationOptions (if useCustomOptions=true)
   b. Search in ServiceBookingType.durationOptions
   c. Throw 400 if not found

2. Practitioner has custom duration options:
   PractitionerServiceType.useCustomOptions=true + durationOptions.length > 0
   → Use default (isDefault=true) or first option
   → source: 'practitioner_option'

3. Service has duration options:
   ServiceBookingType.durationOptions.length > 0
   → Use default or first option
   → source: 'service_option'

4. Practitioner override (flat price/duration):
   PractitionerServiceType.price or PractitionerServiceType.duration is set
   → source: 'practitioner_type'

5. Pure service defaults:
   ServiceBookingType.price + ServiceBookingType.duration
   → source: 'service_type'
```

**Deposit logic** (in `BookingPaymentHelper`):
```
if (depositEnabled && depositPercent > 0 && depositPercent < 100):
  effectivePrice = Math.round(resolvedPrice * depositPercent / 100)
else:
  effectivePrice = resolvedPrice

VAT applied via applyVat(effectivePrice) → {amount, vatAmount, totalAmount}
```

**Note:** No coupon or gift card discount in the booking creation flow. These appear to be applied at payment time (not in the booking module itself).

---

## 8. Recurring Bookings

`BookingRecurringService.createRecurring()` — calls `bookingsService.create()` in a loop.

**Validation:**
- Service must have `allowRecurring=true`
- Pattern must be in: `allowedPatterns = servicePatterns.length > 0 ? (servicePatterns ∩ clinicPatterns) : clinicPatterns`
- repeatCount ≤ `Math.min(service.maxRecurrences, settings.maxRecurrences)`

**Date calculation:**
```
Pattern intervals:
  daily:        +1 day
  every_2_days: +2 days
  every_3_days: +3 days
  weekly:       +7 days
  biweekly:     +14 days
  monthly:      setMonth(+1)  ← calendar month (February edge case exists)
```

**Conflict handling:** Partial success. Conflicts are collected and returned but do not abort the series. Created bookings are returned as `{created: [...], conflicts: [...]}`.

**Group identity:** All bookings share `recurringGroupId` (UUID assigned at series creation). No separate RecurringGroup model.

**Cancellation of series:** No series-level cancellation API. Each booking cancelled individually. No "cancel series" operation exists.

---

## 9. Waitlist System

**Join (`waitlist.service.join()`):**
- Requires `settings.waitlistEnabled=true`
- Checks slot capacity (`waitlistMaxPerSlot` per practitioner + date combination)
- Prevents duplicate entries (one active entry per patient per practitioner)
- Creates `WaitlistEntry` with status `waiting`

**Notify on slot open (`checkAndNotify()`):**
Called after every cancellation and expiry event.
- Returns early if `waitlistEnabled=false` or `waitlistAutoNotify=false`
- Finds up to 3 entries: same practitioner + (same date OR no preferred date), status='waiting'
- Updates entries to `notified`, sends `waitlist_slot_available` notification
- **No automatic booking creation** — patient notified, must book manually

**Leave (`leave()`):** Patient cancels own waitlist entry → status = `cancelled`.

**Important gap:** `checkAndNotify()` uses a hardcoded limit of `take: 3`. This does not use `waitlistMaxPerSlot` setting. The intent is likely to notify the first N in queue, but the limit is not configurable.

---

## 10. Zoom Integration

**When Zoom is created:** At reschedule time for online bookings (NOT at booking creation).  
The booking creation service has a comment: "Zoom is triggered for online bookings on-demand (at session time), not at booking creation."

**Note:** There is a disconnect in documentation vs implementation. The comment says "at session time" but `booking-reschedule.service.ts` creates Zoom meetings during reschedule. The actual session-time Zoom creation endpoint is not visible in the bookings module — it may be in a separate controller or triggered differently.

**Zoom deletion:** Fire-and-forget (non-blocking). Called on:
- Transaction failure during booking creation (cleanup)
- Any cancellation (all 5 paths via `deleteZoomIfNeeded()`)
- Reschedule (old meeting deleted, new one created)

Errors logged as warnings, not propagated. Orphaned meetings possible on Zoom API failure.

---

## 11. Settings Architecture

`BookingSettings` is a multi-branch configuration model:

```
Resolution: getForBranch(branchId) → branch row ?? global row
Cache: Redis, 1-hour TTL, key per branch + global
Invalidation: On update, both global and branch cache keys are deleted
```

**Key settings and their effects:**

| Setting | Default | Effect |
|---------|---------|--------|
| `paymentTimeoutMinutes` | 60 | How long before pending booking expires |
| `freeCancelBeforeHours` | 24 | Threshold for free vs late cancellation |
| `freeCancelRefundType` | full | Refund type when cancelling early |
| `lateCancelRefundType` | none | Refund type when cancelling late |
| `adminCanDirectCancel` | true | Whether admin can bypass review flow |
| `patientCanCancelPending` | true | Whether patient can cancel unpaid bookings |
| `patientCanReschedule` | true | Patient self-reschedule enabled |
| `rescheduleBeforeHours` | 12 | Min hours before appointment to allow reschedule |
| `maxReschedulesPerBooking` | 2 | Hard cap on reschedule count |
| `allowWalkIn` | true | Walk-in booking type enabled |
| `walkInPaymentRequired` | false | Whether walk-ins need payment |
| `allowRecurring` | false | Recurring bookings enabled |
| `maxRecurrences` | 12 | Max bookings in a series |
| `waitlistEnabled` | false | Waitlist feature on/off |
| `waitlistAutoNotify` | true | Auto-notify on slot open |
| `bufferMinutes` | 0 | Gap between appointments |
| `autoCompleteAfterHours` | 2 | Hours after endTime to auto-complete |
| `autoNoShowAfterMinutes` | 30 | Minutes after startTime to auto-mark no-show |
| `noShowPolicy` | keep_full | keep_full / partial_refund / admin_decides |
| `cancellationReviewTimeoutHours` | 48 | Time before auto-approving pending cancellation |
| `adminCanBookOutsideHours` | false | Bypass clinic hours for admin bookings |
| `bookingFlowOrder` | service_first | UI wizard order |
| `paymentMoyasarEnabled` | false | Online payment available |
| `paymentAtClinicEnabled` | true | Cash payment available |

---

## 12. Cross-Module Dependencies

### Inbound (modules that call bookings):
- `payments/` — calls `BookingStatusService.confirm()` and `recoverExpiredBooking()` via webhook
- `tasks/` — 4 task services directly manipulate bookings via PrismaService

### Outbound (bookings calls these):
| Module | Usage |
|--------|-------|
| `payments/` | Payment creation, Moyasar refund API |
| `notifications/` | All state transitions trigger notifications |
| `activity-log/` | All significant actions logged |
| `organization/` | BusinessHoursService, ClinicHolidaysService (availability validation) |
| `organization-settings/` | Timezone for date validation |
| `integrations/zoom/` | Meeting creation/deletion |
| `waitlist` | Triggered on every cancellation/expiry |

### Prisma models accessed directly by bookings:
`booking`, `practitioner`, `service`, `practitionerService`, `serviceBranch`, `branch`, `practitionerBranch`, `practitionerVacation`, `practitionerAvailability`, `intakeForm`, `intakeResponse`, `payment`, `waitlistEntry`, `bookingStatusLog`, `serviceBookingType`, `practitionerServiceType`, `userRole`

---

## 13. HTTP API Surface

### `BookingsController` (`/bookings`)

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| POST | `/bookings` | bookings.create | Create booking |
| GET | `/bookings` | bookings.view | List (scoped) |
| GET | `/bookings/my` | bookings.view | Patient's own |
| GET | `/bookings/today` | bookings.view | Practitioner today |
| GET | `/bookings/stats` | bookings.view | Stats |
| GET | `/bookings/:id` | bookings.view | Single (scoped) |
| GET | `/bookings/:id/payment-status` | bookings.view | Payment status |
| PATCH | `/bookings/:id` | bookings.edit | Admin reschedule |
| POST | `/bookings/:id/patient-reschedule` | bookings.create | Patient reschedule |
| POST | `/bookings/recurring` | bookings.create | Create series |

### `BookingActionsController` (`/bookings`)

| Method | Path | Permission | Handler |
|--------|------|-----------|---------|
| POST | `/bookings/:id/confirm` | bookings.edit | Confirm |
| POST | `/bookings/:id/check-in` | bookings.edit | Check in |
| POST | `/bookings/:id/start` | bookings.edit | Start session |
| POST | `/bookings/:id/complete` | bookings.edit | Complete |
| POST | `/bookings/:id/no-show` | bookings.edit | Mark no-show |
| POST | `/bookings/:id/cancel-request` | bookings.create | Patient cancel request |
| POST | `/bookings/:id/cancel/approve` | bookings.edit | Approve cancellation |
| POST | `/bookings/:id/cancel/reject` | bookings.edit | Reject cancellation |
| POST | `/bookings/:id/admin-cancel` | bookings.delete | Admin direct cancel |
| POST | `/bookings/:id/practitioner-cancel` | bookings.delete | Practitioner cancel |

### `WaitlistController` (`/waitlist`)
`POST /waitlist/join`, `POST /waitlist/:id/leave`, `GET /waitlist/my`, `GET /waitlist` (admin)

### `BookingStatusLogController` (`/bookings/:id/status-logs`)
`GET` — audit trail for a booking

### `BookingSettingsController` (`/booking-settings`)
`GET`, `PATCH` — read/update settings

---

## 14. Functional Conflicts & Issues

### CRITICAL — Logic Errors

**C1: Buffer Minutes Double-Applied on Both Sides**
`checkDoubleBooking()` applies buffer symmetrically to both the new slot AND the existing booking:
```typescript
effectiveStart = shiftTime(startTime, -bufferMinutes)        // ← new slot expanded
effectiveEnd = shiftTime(endTime, +bufferMinutes)
existingEffectiveStart = shiftTime(existing.startTime, -bufferMinutes)  // ← existing also expanded
existingEffectiveEnd = shiftTime(existing.endTime, +bufferMinutes)
```
This means the effective gap enforced is `2× bufferMinutes`, not `1×`. If `bufferMinutes=15`, the actual gap between appointments is 30 minutes. This is likely unintentional and undocumented.

**C2: Reschedule Buffer Resolution Different from Creation**
In `booking-creation.service.ts`:
```typescript
const bufferMinutes = ps.bufferMinutes > 0 ? ps.bufferMinutes : (service.bufferMinutes > 0 ? service.bufferMinutes : settings.bufferMinutes);
```
In `booking-reschedule.service.ts`:
```typescript
const bufferMinutes = ps?.bufferMinutes ?? svc?.bufferMinutes ?? settings.bufferMinutes;
```
Creation uses explicit `> 0` checks (treats 0 as "not set"). Reschedule uses `??` (null/undefined only). If `ps.bufferMinutes = 0`, creation falls through to service/settings buffer, but reschedule uses 0. **Inconsistent behavior between creation and reschedule paths.**

**C3: Auto-Complete Hardcodes `+03:00` Timezone**
`BookingAutocompleteService`:
```typescript
const riyadhTomorrow = new Date('...' + 'T00:00:00+03:00');
const bookingEnd = new Date(`${dateStr}T${b.endTime}:00+03:00`);
```
This hardcodes UTC+3 (Riyadh/Saudi Arabia) regardless of `OrganizationSettings.timezone`. All other time-sensitive services (`BookingNoShowService`, `BookingCreationService`) use `Intl.DateTimeFormat` with the dynamic clinic timezone. White-label deployments in other timezones will experience incorrect auto-complete timing.

**C4: Cancellation Timeout Always Applies Full Refund**
`BookingCancellationTimeoutService` auto-approves with a full refund regardless of the original `suggestedRefundType` stored on the booking. A patient who made a late cancellation request (which would normally get `lateCancelRefundType=none`) gets a full refund when the admin doesn't review within 48 hours. This punishes admins for being slow.

**C5: No-Show cron only processes `confirmed` but manually `markNoShow()` also allows only `confirmed`**
This is consistent. However, the auto-noshow cron does NOT check for `checked_in` or `in_progress` status. A patient who checked in but the appointment was never started is never auto-marked no-show — they'll be auto-completed instead. This is likely correct but worth documenting explicitly.

---

### HIGH — Gaps & Missing Validation

**H1: Recurring Booking Series — No Series Cancellation**
There is no endpoint or service method for "cancel all future bookings in this series." Each booking must be cancelled individually. For a patient with a 12-week series, this requires 12 separate cancellation actions. Significant receptionist friction.

**H2: Waitlist Notify Limit Hardcoded to 3**
`checkAndNotify()` uses `take: 3` regardless of `settings.waitlistMaxPerSlot`. If a slot has 5 waitlisted patients, only the first 3 are notified. The other 2 remain in `waiting` status with no path to `notified` unless another cancellation triggers another notification round.

**H3: `monthly` Recurring Pattern — February Edge Case**
`setMonth(+1)` on January 31 → March 3 (February 28/29 skipped entirely). Patients booking monthly on the 31st skip months that don't have 31 days. No clamping logic exists.

**H4: Intake Form Check is Service-Scoped Only**
`booking-creation.service.ts` only finds intake forms by `serviceId`. The `IntakeForm` model supports `scope: global | service | practitioner | branch`. Global forms and practitioner-specific forms are never surfaced at booking creation. Only one scope (service) is checked.

**H5: rescheduleCount Not Set on serviceDurationOptionId**
The new booking created during reschedule does not set `serviceDurationOptionId` (only `durationOptionId`). This means the FK to `ServiceDurationOption` is not preserved through reschedules. The snapshot is functionally preserved via `durationOptionId` (non-FK) but the FK-constrained field is lost, breaking potential future queries joining on `serviceDurationOptionId`.

**H6: Patient Self-Reschedule Ignores Service-Level `minLeadMinutes`**
`bookings.service.patientReschedule()` checks `settings.rescheduleBeforeHours` but not `service.minLeadMinutes`. Admin reschedule via `BookingRescheduleService.reschedule()` also only checks `settings.minBookingLeadMinutes` — service-level lead time is not enforced on reschedule, only on creation.

**H7: No Validation of `patientCanCancelPending` in Admin Flow**
`settings.patientCanCancelPending` is checked in `handlePendingCancel()` only. Admin direct cancel (`adminDirectCancel()`) ignores this setting — admin can always cancel pending bookings even when the setting is false. This may be intentional (admin overrides patient restriction) but is undocumented.

**H8: Waitlist `checkAndNotify` Uses UTC Midnight for Date Comparison**
```typescript
const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
```
This compares against UTC boundaries. The `Booking.date` field stores timezone-aware datetimes. For clinics in UTC+3, a booking at 2026-04-11 in Riyadh time is stored as 2026-04-10T21:00:00Z. The waitlist check would miss this booking entirely, failing to notify waitlisted patients when a Riyadh-timezone appointment is cancelled.

---

### MEDIUM — Design Concerns

**M1: Reschedule Creates New Booking Record (Immutable Pattern)**
Reschedule cancels the old booking and creates a new one. This means:
- The `confirmed` booking the patient holds becomes `cancelled`
- A new `confirmed` booking is created with `rescheduledFromId`
- Payment is transferred via `payment.updateMany({bookingId: old → new})`
- This is a valid pattern (immutable audit trail) but has UX implications: patient's booking ID changes on every reschedule

**M2: `ADMIN_CANCELLABLE_STATUSES` vs `NON_CANCELLABLE` Are Not Complements**
`ADMIN_CANCELLABLE_STATUSES = ['pending', 'confirmed', 'checked_in', 'pending_cancellation']`  
`NON_CANCELLABLE = ['in_progress', 'completed', 'cancelled', 'expired', 'no_show']`  
`in_progress` is in `NON_CANCELLABLE` (admin cannot cancel) but NOT in `ADMIN_CANCELLABLE_STATUSES`. This is intentional — active sessions cannot be cancelled. But the lists are maintained separately, creating a maintenance risk.

**M3: Zoom Meeting Timing Unclear**
The comment in `booking-creation.service.ts` says Zoom is created "at session time." But `booking-reschedule.service.ts` creates a Zoom meeting immediately on reschedule (before session start). There is no endpoint visible for creating a Zoom meeting at session time. The actual Zoom meeting creation flow for initial (non-rescheduled) online bookings is unclear.

**M4: `patientReschedule` in BookingsService vs Delegating to RescheduleService**
Reschedule limit validation (`rescheduleCount >= maxReschedulesPerBooking`) is in `bookings.service.patientReschedule()`. But `rescheduleCount` is incremented via a separate `prisma.booking.update()` call AFTER `rescheduleService.reschedule()` returns. Since reschedule creates a new booking record, the `rescheduleCount` increment is applied to `result.id` (new booking) but `booking.rescheduleCount` (old booking) is used for the check. This is correct but fragile — the old booking's count is read, validated, then the new booking's count is set.

**M5: `getStats` Date Range Bug**
```typescript
where.date = { gte: effectiveDateFrom, lte: effectiveDateTo };
```
`effectiveDateTo = new Date()` includes bookings up to the current moment. But the stats function is likely intended for "today end of day." A booking created at 23:50 on the last day of the range is included; a booking at 23:55 might not be if the cron runs between. Minor, but affects stats consistency.

---

### LOW — Code Quality

**L1: `BookingLookupHelper` Has Deprecated Methods Alongside New API**
`findBookingOrFail()`, `findWithPayment()`, `findWithRelations()` are marked `@deprecated` but still called from `BookingCancellationService`. Migration to `findOrFail()` is incomplete.

**L2: `booking-creation.service.ts` Has Dead `ensureBookingExists()` Method**
`ensureBookingExists()` is defined in both `bookings.service.ts` and `booking-creation.service.ts` but never called from within `booking-creation.service.ts`. It's a copy-paste artifact.

**L3: `BookingAutocompleteService` Sends Rating Prompt on Auto-Complete**
The notification body says "How was your experience? Rate now." — but the booking was auto-completed by a cron, meaning the patient may not have actually attended. Auto-complete covers `confirmed`, `checked_in`, and `in_progress` statuses. A patient who checked in but whose session was never started will receive a rating prompt. This is a UX issue — asking for a rating when the session possibly didn't happen.

---

## Summary: Top Issues by Priority

| Priority | Issue | File |
|----------|-------|------|
| CRITICAL | C1: Buffer applied 2× (30min gap when 15min intended) | booking-validation.helper.ts |
| CRITICAL | C2: Buffer resolution inconsistent creation vs reschedule | booking-creation vs reschedule service |
| CRITICAL | C3: Auto-complete hardcodes UTC+3 timezone | booking-autocomplete.service.ts:49 |
| CRITICAL | C4: Cancellation timeout ignores suggestedRefundType | booking-cancellation-timeout.service.ts |
| HIGH | H1: No series cancellation for recurring bookings | booking-recurring.service.ts |
| HIGH | H2: Waitlist notify hardcoded at 3 (ignores setting) | waitlist.service.ts:186 |
| HIGH | H3: Monthly recurring skips Feb 28/29 | booking-recurring.service.ts:22 |
| HIGH | H8: Waitlist date comparison uses UTC not clinic TZ | waitlist.service.ts:164 |
| MEDIUM | M3: Zoom creation timing unclear | booking-reschedule.service.ts vs comments |
| LOW | L3: Rating prompt sent on auto-complete of uncompleted sessions | booking-autocomplete.service.ts:86 |
