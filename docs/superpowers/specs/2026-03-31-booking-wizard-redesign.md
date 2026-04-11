# Booking Wizard Redesign — Multi-Step Card Flow

**Date**: 2026-03-31
**Status**: Approved
**Scope**: Dashboard booking creation dialog only

---

## Overview

Convert the existing 2-step booking creation dialog (form-based with progressive disclosure) into a **6-step card-selection wizard**. Each step presents clickable cards — selecting a card advances automatically to the next step, no "Next" button required.

---

## Steps

The order of steps 2 and 3 depends on the clinic's `bookingFlowOrder` setting:

| # | Step | Default (service-first) | Alt (practitioner-first) |
|---|------|------------------------|--------------------------|
| 1 | Patient | Patient | Patient |
| 2 | First selection | Service | Practitioner |
| 3 | Second selection | Practitioner (filtered by service) | Service (filtered by practitioner) |
| 4 | Type + Duration | Type + Duration | Type + Duration |
| 5 | Date + Time | Date + Time | Date + Time |
| 6 | Confirm + Pay | Confirm + Pay | Confirm + Pay |

---

## Wizard State

```typescript
type WizardState = {
  step: 1 | 2 | 3 | 4 | 5 | 6
  patientId: string | null
  patientName: string | null
  serviceId: string | null
  practitionerId: string | null
  type: BookingType | null           // 'in_person' | 'online' | 'walk_in'
  durationOptionId: string | null
  date: string | null                // ISO date
  startTime: string | null           // HH:MM
  payAtClinic: boolean
}
```

**Cascade reset rule**: changing any field clears all downstream fields that depend on it.

| Changed field | Clears |
|--------------|--------|
| serviceId | practitionerId, type, durationOptionId, date, startTime |
| practitionerId | type, durationOptionId, date, startTime |
| type | durationOptionId, date, startTime |
| durationOptionId | date, startTime |
| date | startTime |

---

## Step Designs

### Step 1 — Patient
Unchanged from current implementation. Search existing patients or create walk-in. Selecting a patient advances to step 2.

---

### Step 2 — Service (vertical cards)

- Search input at top to filter services
- Each card shows: service name + duration + price
- Card layout: full-width vertical list

**Price display rules**:
- Single price → show exact: `150 ر.س`
- Multiple prices (duration tiers or types) → show: `يبدأ من 150 ر.س`
- `hidePriceOnBooking = true` → hide price
- `hideDurationOnBooking = true` → hide duration

**Data source**: `GET /services?active=true` (all clinic services, no practitioner filter)

---

### Step 3 — Practitioner (vertical cards)

- Each card shows: avatar + name + specialty + availability hint
- Filtered to practitioners who offer the selected service
- No search needed (list is short after filtering)

**Data source**: `GET /services/:id/practitioners` *(new endpoint)*

---

### Step 4 — Type + Duration (grid cards)

Two sub-sections within one step:

**Type grid** (always shown):
- Cards: حضوري / عن بعد / Walk-in — shown only if available for this practitioner+service combo
- If only one type available → auto-select, skip to duration

**Duration grid** (shown after type selected, only if duration options exist):
- Cards show: label (30 دقيقة / 60 دقيقة) + price
- If only one duration option → auto-select, advance to step 5

Advancing: type selected + duration selected (or not required) → step 5.

**Data source**: existing `GET /practitioners/:id/service-types?serviceId=` API

---

### Step 5 — Date + Time (combined)

Two sub-sections:

**Day strip** (horizontal scrollable):
- 14 upcoming days
- Days with no available slots → disabled/dimmed
- Selecting a day loads time slots below

**Time slots grid**:
- Cards: HH:MM format
- Selecting a time slot → advances to step 6

**Data source**: existing slots API

---

### Step 6 — Confirm + Pay

**Summary section**: table of all selections
- Each row has an edit icon (✎) that jumps directly to that step
- Rows: Patient · Service · Practitioner · Type+Duration · Date · Time

**Payment section**:
- Single option: "الدفع في العيادة" toggle card
- (More payment methods may be added in future)

**Action**: "إنشاء الحجز" button — calls existing `createBooking` mutation

---

## Navigation

| Action | Trigger | Behavior |
|--------|---------|----------|
| Advance | Click a card | Save value → go to next step |
| Back | Header back button | Go to previous step (values preserved) |
| Jump | Click ✎ in confirmation summary | Jump to that step, clear downstream |
| Close | X button | Dismiss dialog, reset all state |

---

## Transitions

- **Forward**: slide from left (RTL — new step enters from left)
- **Backward**: slide from right
- **Cards appear**: staggered fade-in + subtle scale
- **Card select**: ring highlight + brief scale before transition
- **Duration**: 200–300ms (fast enough for receptionist workflow)

---

## Clinic Setting: `bookingFlowOrder`

New setting in `clinic_settings`:

```typescript
bookingFlowOrder: 'service_first' | 'practitioner_first'
// default: 'service_first'
```

- Controls whether step 2 is Service or Practitioner
- Steps 4, 5, 6 are unaffected regardless of setting
- Wizard reads setting on mount and builds step order dynamically

---

## Backend Changes Required

### New endpoint
`GET /practitioners?serviceId=:id` (or `/services/:id/practitioners`)
- Returns practitioners who have an active `practitioner_services` record for this service
- Returns: id, nameAr, nameEn, avatar, specialty

### Existing endpoints (unchanged)
- `GET /services?active=true` — already exists, used for service list
- `GET /practitioners/:id/service-types?serviceId=` — type + duration options
- `GET /practitioners/:id/slots?date=&duration=` — available time slots

---

## Files to Create / Modify

### New files
| File | Purpose |
|------|---------|
| `dashboard/components/features/bookings/booking-wizard.tsx` | Wizard orchestrator (replaces booking-create-dialog step 2 logic) |
| `dashboard/components/features/bookings/wizard-steps/step-service.tsx` | Step 2: service cards |
| `dashboard/components/features/bookings/wizard-steps/step-practitioner.tsx` | Step 3: practitioner cards |
| `dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx` | Step 4: type + duration grid |
| `dashboard/components/features/bookings/wizard-steps/step-datetime.tsx` | Step 5: date strip + time grid |
| `dashboard/components/features/bookings/wizard-steps/step-confirm.tsx` | Step 6: summary + payment |
| `dashboard/components/features/bookings/use-wizard-state.ts` | State machine + cascade reset logic |
| `dashboard/components/features/bookings/wizard-card.tsx` | Reusable card component (vertical + grid variants) |
| `backend/src/modules/services/dto/service-practitioners.dto.ts` | Response DTO for new endpoint |

### Modified files
| File | Change |
|------|--------|
| `dashboard/components/features/bookings/booking-create-dialog.tsx` | Replace step 2 with `<BookingWizard>` |
| `backend/src/modules/services/services.controller.ts` | Add `GET /services/:id/practitioners` |
| `backend/src/modules/services/services.service.ts` | Add `getPractitionersByService()` method |
| `backend/src/modules/clinic/organization-settings.service.ts` | Add `bookingFlowOrder` setting |
| `dashboard/lib/api/services.ts` | Add API call for new endpoint |
| `dashboard/lib/translations/ar.bookings.ts` | New translation keys |
| `dashboard/lib/translations/en.bookings.ts` | New translation keys |

---

## Out of Scope

- Mobile app booking flow (unchanged)
- Waitlist creation flow (unchanged)
- Any changes to the backend booking creation logic
- Payment method expansion (beyond "pay at clinic")
