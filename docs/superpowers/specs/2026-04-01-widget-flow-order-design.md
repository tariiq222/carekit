# Widget Booking Flow Order — Design Spec

**Date:** 2026-04-01  
**Status:** Approved for implementation

## Overview

Add admin control over the booking widget's step order. Currently the widget always shows practitioners first then services — this should be configurable: service-first or practitioner-first. The setting is saved in the DB and can also be overridden per-embed via a URL param.

---

## Scope

| Layer | Change |
|-------|--------|
| Backend | Add `serviceId` filter to `GET /practitioners` |
| Dashboard Settings | New card in `booking-tab.tsx` to save flow order |
| Dashboard Widget Tab | Add `flow` URL param in configurator |
| Widget page | Read `flow` from URL or fetch from API |
| Widget hook | Reverse fetch logic based on `flowOrder` |
| Widget UI | Reverse step display based on `flowOrder` |

---

## 1. Backend — `serviceId` Filter on Practitioners

**Files:**
- `backend/src/modules/practitioners/dto/get-practitioners-query.dto.ts`
- `backend/src/modules/practitioners/practitioners.service.ts`

**Changes:**

Add optional `serviceId` field to `GetPractitionersQueryDto`:

```ts
@ApiPropertyOptional({ format: 'uuid' })
@IsOptional()
@IsUUID()
serviceId?: string;
```

Add filter in `practitioners.service.ts` `findAll` query:

```ts
...(query.serviceId && {
  services: { some: { serviceId: query.serviceId } },
}),
```

**No migration needed** — uses existing `PractitionerService` relation table.

---

## 2. Dashboard — `booking-tab.tsx` New Card

**File:** `dashboard/components/features/settings/booking-tab.tsx`

Add a new card "ترتيب خطوات الويدجت" with a RadioGroup:

- **الخدمة أولاً** (`service_first`) — default, recommended
- **المعالج أولاً** (`practitioner_first`)

**Data flow:**
- On load: `GET /clinic/booking-flow-order` → pre-select current value
- On save: `PATCH /clinic/booking-flow-order` with `{ order: "service_first" | "practitioner_first" }`

**API layer:** Add `fetchBookingFlowOrder` and `updateBookingFlowOrder` to `dashboard/lib/api/clinic.ts` (or create if missing).

**Hook:** Add query + mutation in `dashboard/hooks/use-booking-settings.ts` (or appropriate existing hook).

---

## 3. Dashboard — `widget-tab.tsx` Flow Param

**File:** `dashboard/components/features/settings/widget-tab.tsx`

Add `flow` field to configurator state and `buildWidgetUrl`:

```ts
// state
const [flow, setFlow] = useState<"service_first" | "practitioner_first">("service_first")

// buildWidgetUrl params
flow?: "service_first" | "practitioner_first"

// URL construction
if (params.flow) url.searchParams.set("flow", params.flow)
```

Add toggle UI (same style as locale toggle) in the configurator card.

Add to `ParamRow` reference table:
- name: `flow`
- description: ترتيب خطوات الويدجت — يتجاوز إعداد الحساب
- example: `service_first | practitioner_first`

---

## 4. Widget Page — `booking/page.tsx`

**File:** `dashboard/app/booking/page.tsx`

Read `flow` from search params. Pass to `BookingWizard`:

```ts
const flow = searchParams.get("flow") as "service_first" | "practitioner_first" | null
```

If `flow` is provided via URL → use it directly.  
If not → fetch from `GET /clinic/booking-flow-order` server-side and pass as prop.

Pass as `initialFlowOrder` prop to `BookingWizard`.

---

## 5. Widget — `booking-wizard.tsx`

**File:** `dashboard/components/features/widget/booking-wizard.tsx`

Add prop:
```ts
initialFlowOrder?: "service_first" | "practitioner_first"
```

Pass to `useWidgetBooking` hook and to `WidgetServiceStep`.

---

## 6. Widget Hook — `use-widget-booking.ts`

**File:** `dashboard/hooks/use-widget-booking.ts`

Add `flowOrder` param:
```ts
export function useWidgetBooking(
  initialPractitionerId?: string,
  initialServiceId?: string,
  flowOrder: "service_first" | "practitioner_first" = "service_first",
)
```

**`service_first` logic (new):**
- Fetch all services (new query: `fetchWidgetServices`)
- On service select → fetch practitioners filtered by `?serviceId=`
- `selectService(svc)` → set service, fetch practitioners
- `selectPractitioner(p)` → set practitioner, proceed to next sub-step or datetime

**`practitioner_first` logic (existing):**
- Fetch all practitioners → select → fetch that practitioner's services
- No change to existing flow

**State machine remains the same** — steps are still `service | datetime | auth | confirm | success`. The `service` step internally handles both sub-orderings.

---

## 7. Widget UI — `widget-service-step.tsx`

**File:** `dashboard/components/features/widget/widget-service-step.tsx`

Add `flowOrder` prop. Conditionally render:

**`practitioner_first` (current behavior):**
1. Show practitioners list
2. After selection → show services list
3. After selection → show booking type

**`service_first` (new):**
1. Show services list
2. After selection → show practitioners list (filtered by service)
3. After selection → show booking type

The internal sub-step state (`substep`) already exists in the component — extend it to support both orderings.

---

## API Endpoints Summary

| Method | Endpoint | Used by |
|--------|----------|---------|
| `GET` | `/clinic/booking-flow-order` | Dashboard settings, Widget page fallback |
| `PATCH` | `/clinic/booking-flow-order` | Dashboard settings save |
| `GET` | `/practitioners?serviceId=` | Widget hook (service_first mode) |
| `GET` | `/services` (public) | Widget hook (service_first mode) — verify public endpoint exists |

> **Confirmed:** `fetchWidgetServices()` already exists in `dashboard/lib/api/widget.ts` → `GET /services?isActive=true&perPage=50`. No new endpoint needed.

---

## Data Flow Diagrams

### service_first
```
Widget loads
  → fetch all services
  → patient selects service
  → fetch practitioners filtered by ?serviceId=
  → patient selects practitioner
  → fetch booking types for (practitioner, service)
  → proceed to datetime step
```

### practitioner_first (existing)
```
Widget loads
  → fetch all practitioners
  → patient selects practitioner
  → fetch services for practitioner
  → patient selects service + booking type
  → proceed to datetime step
```

---

## Files Changed

| File | Type |
|------|------|
| `backend/src/modules/practitioners/dto/get-practitioners-query.dto.ts` | modify |
| `backend/src/modules/practitioners/practitioners.service.ts` | modify |
| `dashboard/lib/api/clinic.ts` | modify (add 2 functions) |
| `dashboard/hooks/use-booking-settings.ts` | modify (add query + mutation) |
| `dashboard/components/features/settings/booking-tab.tsx` | modify (add card) |
| `dashboard/components/features/settings/widget-tab.tsx` | modify (add flow param) |
| `dashboard/app/booking/page.tsx` | modify (read flow param) |
| `dashboard/components/features/widget/booking-wizard.tsx` | modify (add prop) |
| `dashboard/hooks/use-widget-booking.ts` | modify (add flowOrder logic) |
| `dashboard/components/features/widget/widget-service-step.tsx` | modify (reverse UI) |

**Total: 10 files** — within the 10-file commit limit per system, split into 2 commits (backend + frontend).

---

## Open Questions Resolved

- **Where does the setting live in the UI?** → `booking-tab.tsx` (not widget-tab)
- **URL override?** → Yes, `flow` param in widget URL
- **Filtering direction?** → Both: `practitioner_first` uses existing `/practitioners/:id/services`, `service_first` uses new `?serviceId=` filter
- **Public services endpoint?** → Needs verification before implementation starts
