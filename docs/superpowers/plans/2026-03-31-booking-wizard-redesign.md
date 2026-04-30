# Booking Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the 2-step booking creation dialog into a 6-step card-selection wizard where each card click advances to the next step automatically.

**Architecture:** A new `BookingWizard` component with a `useWizardState` hook manages a flat state object with cascade-reset logic. Six step components (client, service, employee, type+duration, date+time, confirm+pay) are rendered conditionally inside the existing `BookingCreateDialog`. The clinic `bookingFlowOrder` setting controls whether steps 2 and 3 are service-first or employee-first.

**Tech Stack:** Next.js 15, React 19, TanStack Query v5, shadcn/ui, Tailwind 4, Framer Motion (already in dashboard), react-hook-form removed from booking step (replaced by direct wizard state), NestJS backend.

---

## File Map

### New Files (Dashboard)
| File | Responsibility |
|------|---------------|
| `dashboard/components/features/bookings/use-wizard-state.ts` | Flat wizard state + cascade reset logic + step ordering by `bookingFlowOrder` |
| `dashboard/components/features/bookings/wizard-card.tsx` | Reusable card component — vertical list variant and grid variant |
| `dashboard/components/features/bookings/booking-wizard.tsx` | Wizard orchestrator — renders step + animated transition |
| `dashboard/components/features/bookings/wizard-steps/step-service.tsx` | Step: service card list with search |
| `dashboard/components/features/bookings/wizard-steps/step-employee.tsx` | Step: employee card list |
| `dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx` | Step: booking type grid + duration grid |
| `dashboard/components/features/bookings/wizard-steps/step-datetime.tsx` | Step: day strip + time slot grid |
| `dashboard/components/features/bookings/wizard-steps/step-confirm.tsx` | Step: summary table + payment toggle + submit |

### Modified Files (Dashboard)
| File | Change |
|------|--------|
| `dashboard/components/features/bookings/booking-create-dialog.tsx` | Replace `BookingStep` + progressive logic with `<BookingWizard>` |
| `dashboard/lib/api/services.ts` | `fetchServiceEmployees` already exists — verify signature |
| `dashboard/lib/query-keys.ts` | Add `services.employees(id)` key |
| `dashboard/lib/translations/ar.bookings.ts` | Add wizard translation keys |
| `dashboard/lib/translations/en.bookings.ts` | Add wizard translation keys |

### New Files (Backend)
| File | Responsibility |
|------|---------------|
| `backend/src/modules/clinic/dto/update-organization-settings.dto.ts` | DTO for updating `bookingFlowOrder` |

### Modified Files (Backend)
| File | Change |
|------|--------|
| `backend/src/modules/clinic/organization-settings.service.ts` | Add `bookingFlowOrder` to settings + getBookingSettings() |
| `backend/src/modules/clinic/organization-settings.controller.ts` | Add GET/PATCH for booking flow setting |
| `backend/prisma/schema/bookings.prisma` | Add `bookingFlowOrder` field to `BookingSettings` |

---

## Task 1: Add `bookingFlowOrder` to BookingSettings schema

**Files:**
- Modify: `backend/prisma/schema/bookings.prisma`

- [ ] **Step 1: Add field to BookingSettings model**

Open `backend/prisma/schema/bookings.prisma`. In the `BookingSettings` model, add after the last field before the closing `}`:

```prisma
bookingFlowOrder  String  @default("service_first") @map("booking_flow_order")
```

- [ ] **Step 2: Create migration**

```bash
cd backend
npx prisma migrate dev --name add_booking_flow_order
```

Expected: new migration file created in `backend/prisma/migrations/`, `BookingSettings` table updated.

- [ ] **Step 3: Verify migration ran**

```bash
npx prisma studio
```

Open `BookingSettings` table, confirm `booking_flow_order` column exists with value `service_first`.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add backend/prisma/schema/bookings.prisma backend/prisma/migrations/
git commit -m "feat(backend/clinic): add booking_flow_order to BookingSettings"
```

---

## Task 2: Backend — expose `bookingFlowOrder` in OrganizationSettingsService

**Files:**
- Modify: `backend/src/modules/clinic/organization-settings.service.ts`
- Create: `backend/src/modules/clinic/dto/update-organization-settings.dto.ts`
- Modify: `backend/src/modules/clinic/organization-settings.controller.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/test/unit/clinic/organization-settings.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing'
import { PrismaService } from '../../../src/common/prisma/prisma.service'
import { OrganizationSettingsService } from '../../../src/modules/clinic/organization-settings.service'

describe('OrganizationSettingsService', () => {
  let service: OrganizationSettingsService
  let prisma: { bookingSettings: { findFirst: jest.Mock; upsert: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      bookingSettings: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    }
    const module = await Test.createTestingModule({
      providers: [
        OrganizationSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()
    service = module.get(OrganizationSettingsService)
  })

  describe('getBookingFlowOrder', () => {
    it('returns service_first when no settings exist', async () => {
      prisma.bookingSettings.findFirst.mockResolvedValue(null)
      const result = await service.getBookingFlowOrder()
      expect(result).toBe('service_first')
    })

    it('returns stored value when settings exist', async () => {
      prisma.bookingSettings.findFirst.mockResolvedValue({
        bookingFlowOrder: 'employee_first',
      })
      const result = await service.getBookingFlowOrder()
      expect(result).toBe('employee_first')
    })
  })

  describe('updateBookingFlowOrder', () => {
    it('upserts the bookingFlowOrder value', async () => {
      prisma.bookingSettings.upsert.mockResolvedValue({
        bookingFlowOrder: 'employee_first',
      })
      const result = await service.updateBookingFlowOrder('employee_first')
      expect(prisma.bookingSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { bookingFlowOrder: 'employee_first' },
        }),
      )
      expect(result).toBe('employee_first')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- --testPathPattern="organization-settings.service.spec" --no-coverage
```

Expected: FAIL — `service.getBookingFlowOrder is not a function`

- [ ] **Step 3: Update OrganizationSettingsService**

Replace the full content of `backend/src/modules/clinic/organization-settings.service.ts`:

```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'

export type BookingFlowOrder = 'service_first' | 'employee_first'

export interface PublicOrganizationSettings {
  bankName: string | null
  bankIban: string | null
  bankAccountHolder: string | null
}

@Injectable()
export class OrganizationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings(): Promise<PublicOrganizationSettings> {
    const config = await this.prisma.whiteLabelConfig.findFirst({
      select: {
        bankName: true,
        bankIban: true,
        bankAccountHolder: true,
      },
    })
    return {
      bankName: config?.bankName ?? null,
      bankIban: config?.bankIban ?? null,
      bankAccountHolder: config?.bankAccountHolder ?? null,
    }
  }

  async getBookingFlowOrder(): Promise<BookingFlowOrder> {
    const settings = await this.prisma.bookingSettings.findFirst({
      select: { bookingFlowOrder: true },
    })
    return (settings?.bookingFlowOrder as BookingFlowOrder) ?? 'service_first'
  }

  async updateBookingFlowOrder(order: BookingFlowOrder): Promise<BookingFlowOrder> {
    const result = await this.prisma.bookingSettings.upsert({
      where: { id: 'global' },
      create: { bookingFlowOrder: order },
      update: { bookingFlowOrder: order },
      select: { bookingFlowOrder: true },
    })
    return result.bookingFlowOrder as BookingFlowOrder
  }
}
```

> **Note**: Check the actual BookingSettings `where` condition — it may use `branchId: null` for global. Adjust `where: { id: 'global' }` to match the existing upsert pattern in `booking-settings.service.ts`.

- [ ] **Step 4: Create the DTO**

Create `backend/src/modules/clinic/dto/update-organization-settings.dto.ts`:

```typescript
import { IsIn } from 'class-validator'

export class UpdateBookingFlowOrderDto {
  @IsIn(['service_first', 'employee_first'])
  order: 'service_first' | 'employee_first'
}
```

- [ ] **Step 5: Update the controller**

Replace the full content of `backend/src/modules/clinic/organization-settings.controller.ts`:

```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { OrganizationSettingsService } from './organization-settings.service'
import { UpdateBookingFlowOrderDto } from './dto/update-organization-settings.dto'

@Controller('clinic/settings')
export class OrganizationSettingsController {
  constructor(private readonly service: OrganizationSettingsService) {}

  @Get('public')
  getPublicSettings() {
    return this.service.getPublicSettings()
  }

  @Get('booking-flow')
  @UseGuards(JwtAuthGuard)
  getBookingFlowOrder() {
    return this.service.getBookingFlowOrder()
  }

  @Patch('booking-flow')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('owner', 'admin')
  updateBookingFlowOrder(@Body() dto: UpdateBookingFlowOrderDto) {
    return this.service.updateBookingFlowOrder(dto.order)
  }
}
```

> **Note**: Check the guard/decorator import paths against other controllers in the project. Use the same pattern as `BusinessHoursController`.

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend
npm test -- --testPathPattern="organization-settings.service.spec" --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add backend/src/modules/clinic/ backend/test/unit/clinic/
git commit -m "feat(backend/clinic): add booking flow order setting endpoint"
```

---

## Task 3: Dashboard — API + query key for booking flow order + service employees

**Files:**
- Modify: `dashboard/lib/query-keys.ts`
- Modify: `dashboard/lib/api/services.ts`
- Create: `dashboard/lib/api/organization-settings.ts`

- [ ] **Step 1: Add query keys**

In `dashboard/lib/query-keys.ts`, find the `services` section and add:

```typescript
// Inside queryKeys.services object, add:
employees: (serviceId: string) => ['services', serviceId, 'employees'] as const,
```

Also add a new top-level `organizationSettings` section (find a good place, e.g. after `bookingSettings`):

```typescript
organizationSettings: {
  bookingFlowOrder: () => ['organization-settings', 'booking-flow-order'] as const,
},
```

- [ ] **Step 2: Verify fetchServiceEmployees exists in services.ts**

Read `dashboard/lib/api/services.ts` and confirm the function `fetchServiceEmployees(serviceId: string)` exists and calls `GET /services/:id/employees`. If it does NOT exist, add:

```typescript
export async function fetchServiceEmployees(serviceId: string) {
  const { data } = await apiClient.get<EmployeeForService[]>(
    `/services/${serviceId}/employees`,
  )
  return data
}
```

Where `EmployeeForService` matches the backend response (id, nameAr, nameEn, avatar, specialty).

- [ ] **Step 3: Create organization-settings API client**

Create `dashboard/lib/api/organization-settings.ts`:

```typescript
import { apiClient } from './client'

export type BookingFlowOrder = 'service_first' | 'employee_first'

export async function fetchBookingFlowOrder(): Promise<BookingFlowOrder> {
  const { data } = await apiClient.get<BookingFlowOrder>(
    '/clinic/settings/booking-flow',
  )
  return data
}

export async function updateBookingFlowOrder(
  order: BookingFlowOrder,
): Promise<BookingFlowOrder> {
  const { data } = await apiClient.patch<BookingFlowOrder>(
    '/clinic/settings/booking-flow',
    { order },
  )
  return data
}
```

> **Note**: Check the existing API client import pattern in `dashboard/lib/api/bookings.ts` to confirm the correct `apiClient` import path.

- [ ] **Step 4: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep -E "organization-settings|query-keys|services"
```

Expected: no errors for the modified files.

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/lib/api/organization-settings.ts dashboard/lib/query-keys.ts dashboard/lib/api/services.ts
git commit -m "feat(dashboard/api): add clinic booking flow order + service employees query"
```

---

## Task 4: Dashboard — Translation keys for wizard

**Files:**
- Modify: `dashboard/lib/translations/ar.bookings.ts`
- Modify: `dashboard/lib/translations/en.bookings.ts`

- [ ] **Step 1: Add Arabic wizard keys**

In `dashboard/lib/translations/ar.bookings.ts`, add inside the main object (find the `create` section and add a `wizard` sub-section):

```typescript
wizard: {
  title: 'حجز جديد',
  stepLabel: {
    client: 'المستفيد',
    service: 'الخدمة',
    employee: 'الممارس',
    typeDuration: 'النوع والمدة',
    datetime: 'الموعد',
    confirm: 'التأكيد',
  },
  step: {
    service: {
      title: 'اختر الخدمة',
      search: 'ابحث عن خدمة...',
      priceFrom: 'يبدأ من',
      currency: 'ر.س',
    },
    employee: {
      title: 'اختر الممارس',
      availableToday: 'متاح اليوم',
      nextAvailable: 'أقرب موعد',
    },
    typeDuration: {
      typeTitle: 'نوع الحجز',
      durationTitle: 'مدة الجلسة',
      inPerson: 'حضوري',
      online: 'عن بعد',
      walkIn: 'زيارة مباشرة',
      minutes: 'دقيقة',
    },
    datetime: {
      title: 'اختر الموعد',
      dayTitle: 'اليوم',
      timeTitle: 'الوقت المتاح',
      noSlots: 'لا توجد مواعيد متاحة',
    },
    confirm: {
      title: 'تأكيد الحجز',
      summaryTitle: 'ملخص الحجز',
      client: 'المستفيد',
      service: 'الخدمة',
      employee: 'الممارس',
      type: 'النوع',
      datetime: 'الموعد',
      submit: 'إنشاء الحجز',
      payAtClinic: 'الدفع في العيادة',
      payAtClinicDescription: 'ادفع عند الزيارة',
    },
  },
  back: 'رجوع',
  changeClient: '← تغيير المستفيد',
},
```

- [ ] **Step 2: Add English wizard keys**

In `dashboard/lib/translations/en.bookings.ts`, add the matching section:

```typescript
wizard: {
  title: 'New Booking',
  stepLabel: {
    client: 'Client',
    service: 'Service',
    employee: 'Employee',
    typeDuration: 'Type & Duration',
    datetime: 'Appointment',
    confirm: 'Confirm',
  },
  step: {
    service: {
      title: 'Choose a Service',
      search: 'Search services...',
      priceFrom: 'From',
      currency: 'SAR',
    },
    employee: {
      title: 'Choose a Employee',
      availableToday: 'Available today',
      nextAvailable: 'Next available',
    },
    typeDuration: {
      typeTitle: 'Booking Type',
      durationTitle: 'Session Duration',
      inPerson: 'In Person',
      online: 'Online',
      walkIn: 'Walk-in',
      minutes: 'min',
    },
    datetime: {
      title: 'Choose Appointment',
      dayTitle: 'Day',
      timeTitle: 'Available Times',
      noSlots: 'No available slots',
    },
    confirm: {
      title: 'Confirm Booking',
      summaryTitle: 'Booking Summary',
      client: 'Client',
      service: 'Service',
      employee: 'Employee',
      type: 'Type',
      datetime: 'Appointment',
      submit: 'Create Booking',
      payAtClinic: 'Pay at Clinic',
      payAtClinicDescription: 'Pay when you visit',
    },
  },
  back: 'Back',
  changeClient: '← Change Client',
},
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep -E "translations"
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/lib/translations/
git commit -m "feat(dashboard/i18n): add booking wizard translation keys"
```

---

## Task 5: Dashboard — `useWizardState` hook

**Files:**
- Create: `dashboard/components/features/bookings/use-wizard-state.ts`

This hook is the brain of the wizard. It holds all selected values and enforces cascade reset.

- [ ] **Step 1: Create the hook**

Create `dashboard/components/features/bookings/use-wizard-state.ts`:

```typescript
import { useCallback, useState } from 'react'
import type { BookingFlowOrder } from '@/lib/api/organization-settings'

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export interface WizardState {
  step: WizardStep
  clientId: string | null
  clientName: string | null
  serviceId: string | null
  serviceName: string | null
  employeeId: string | null
  employeeName: string | null
  type: 'in_person' | 'online' | 'walk_in' | null
  durationOptionId: string | null
  durationLabel: string | null
  date: string | null        // ISO date YYYY-MM-DD
  startTime: string | null   // HH:MM
  payAtClinic: boolean
}

const INITIAL_STATE: WizardState = {
  step: 1,
  clientId: null,
  clientName: null,
  serviceId: null,
  serviceName: null,
  employeeId: null,
  employeeName: null,
  type: null,
  durationOptionId: null,
  durationLabel: null,
  date: null,
  startTime: null,
  payAtClinic: true,
}

export function useWizardState(flowOrder: BookingFlowOrder = 'service_first') {
  const [state, setState] = useState<WizardState>(INITIAL_STATE)

  // Step 2 is service or employee depending on flowOrder
  const stepForService: WizardStep = flowOrder === 'service_first' ? 2 : 3
  const stepForEmployee: WizardStep = flowOrder === 'service_first' ? 3 : 2

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }))
  }, [])

  const selectClient = useCallback(
    (clientId: string, clientName: string) => {
      setState((prev) => ({
        ...prev,
        clientId,
        clientName,
        // cascade: clear everything downstream
        serviceId: null,
        serviceName: null,
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: 2,
      }))
    },
    [],
  )

  const selectService = useCallback(
    (serviceId: string, serviceName: string) => {
      setState((prev) => ({
        ...prev,
        serviceId,
        serviceName,
        // cascade: clear employee and everything downstream
        employeeId: null,
        employeeName: null,
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectEmployee = useCallback(
    (employeeId: string, employeeName: string) => {
      setState((prev) => ({
        ...prev,
        employeeId,
        employeeName,
        // cascade: clear type and everything downstream
        type: null,
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
        step: (prev.step + 1) as WizardStep,
      }))
    },
    [],
  )

  const selectType = useCallback(
    (type: 'in_person' | 'online' | 'walk_in') => {
      setState((prev) => ({
        ...prev,
        type,
        // cascade: clear duration, date, time
        durationOptionId: null,
        durationLabel: null,
        date: null,
        startTime: null,
      }))
    },
    [],
  )

  const selectDuration = useCallback(
    (durationOptionId: string, durationLabel: string) => {
      setState((prev) => ({
        ...prev,
        durationOptionId,
        durationLabel,
        // cascade: clear date, time
        date: null,
        startTime: null,
        step: 5,
      }))
    },
    [],
  )

  const skipDuration = useCallback(() => {
    setState((prev) => ({
      ...prev,
      durationOptionId: null,
      durationLabel: null,
      step: 5,
    }))
  }, [])

  const advanceFromType = useCallback((hasDurations: boolean) => {
    if (!hasDurations) {
      setState((prev) => ({ ...prev, step: 5 }))
    }
    // If hasDurations, stay on step 4 to show duration cards
  }, [])

  const selectDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      date,
      startTime: null, // cascade: clear time
    }))
  }, [])

  const selectTime = useCallback((startTime: string) => {
    setState((prev) => ({ ...prev, startTime, step: 6 }))
  }, [])

  const setPayAtClinic = useCallback((payAtClinic: boolean) => {
    setState((prev) => ({ ...prev, payAtClinic }))
  }, [])

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as WizardStep,
    }))
  }, [])

  // Jump to a specific step from the confirmation summary
  // Clears all state downstream of that step
  const jumpToStep = useCallback(
    (targetStep: WizardStep) => {
      setState((prev) => {
        const next = { ...prev, step: targetStep }
        if (targetStep <= stepForService) {
          next.serviceId = null
          next.serviceName = null
          next.employeeId = null
          next.employeeName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep <= stepForEmployee) {
          next.employeeId = null
          next.employeeName = null
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 4) {
          next.type = null
          next.durationOptionId = null
          next.durationLabel = null
          next.date = null
          next.startTime = null
        } else if (targetStep === 5) {
          next.date = null
          next.startTime = null
        }
        return next
      })
    },
    [stepForService, stepForEmployee],
  )

  return {
    state,
    stepForService,
    stepForEmployee,
    reset,
    goToStep,
    goBack,
    jumpToStep,
    selectClient,
    selectService,
    selectEmployee,
    selectType,
    selectDuration,
    skipDuration,
    advanceFromType,
    selectDate,
    selectTime,
    setPayAtClinic,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "use-wizard-state"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/use-wizard-state.ts
git commit -m "feat(dashboard/bookings): add useWizardState hook with cascade reset"
```

---

## Task 6: Dashboard — `WizardCard` reusable component

**Files:**
- Create: `dashboard/components/features/bookings/wizard-card.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/components/features/bookings/wizard-card.tsx`:

```typescript
'use client'

import { cn } from '@/lib/utils'
import { CheckmarkCircle01Icon } from '@hugeicons/react'

interface WizardCardProps {
  onClick: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}

/**
 * Base card for wizard steps. Click to select and advance.
 * Two layout variants:
 *   - Default (full-width): use for vertical lists (services, employees)
 *   - Grid: wrap in a CSS grid from parent, this card fills its cell
 */
export function WizardCard({
  onClick,
  selected = false,
  disabled = false,
  className,
  children,
}: WizardCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative w-full rounded-xl border border-border bg-surface',
        'px-4 py-3 text-right transition-all duration-150',
        'hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm',
        'active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        selected && 'border-primary bg-primary/8 ring-1 ring-primary/30',
        className,
      )}
    >
      {selected && (
        <span className="absolute start-3 top-1/2 -translate-y-1/2">
          <CheckmarkCircle01Icon className="h-4 w-4 text-primary" />
        </span>
      )}
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "wizard-card"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-card.tsx
git commit -m "feat(dashboard/bookings): add WizardCard base component"
```

---

## Task 7: Dashboard — Step 2/3: Service step

**Files:**
- Create: `dashboard/components/features/bookings/wizard-steps/step-service.tsx`

- [ ] **Step 1: Create the step**

Create `dashboard/components/features/bookings/wizard-steps/step-service.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/hooks/use-locale'
import { queryKeys } from '@/lib/query-keys'
import { fetchServices } from '@/lib/api/services'
import { WizardCard } from '../wizard-card'
import { Input } from '@/components/ui/input'
import { Search01Icon, Stethoscope02Icon } from '@hugeicons/react'
import type { Service } from '@/lib/types/service'

interface StepServiceProps {
  onSelect: (serviceId: string, serviceName: string) => void
}

function formatPrice(service: Service, t: ReturnType<typeof useLocale>['t']): string | null {
  if (service.hidePriceOnBooking) return null

  // Collect all available prices across booking types and duration options
  const prices: number[] = []

  if (service.bookingTypes && service.bookingTypes.length > 0) {
    for (const bt of service.bookingTypes) {
      if (!bt.isActive) continue
      if (bt.durationOptions && bt.durationOptions.length > 0) {
        bt.durationOptions.forEach((opt) => prices.push(opt.price))
      } else if (bt.price != null) {
        prices.push(bt.price)
      }
    }
  }

  if (prices.length === 0 && service.price != null) {
    prices.push(service.price)
  }

  if (prices.length === 0) return null

  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const formatted = (minPrice / 100).toFixed(0)

  if (minPrice !== maxPrice) {
    return `${t('bookings.wizard.step.service.priceFrom')} ${formatted} ${t('bookings.wizard.step.service.currency')}`
  }
  return `${formatted} ${t('bookings.wizard.step.service.currency')}`
}

function formatDuration(service: Service, t: ReturnType<typeof useLocale>['t']): string | null {
  if (service.hideDurationOnBooking) return null
  if (!service.duration) return null
  return `${service.duration} ${t('bookings.wizard.step.typeDuration.minutes')}`
}

export function StepService({ onSelect }: StepServiceProps) {
  const { t, locale } = useLocale()
  const [search, setSearch] = useState('')

  const { data: services = [], isLoading } = useQuery({
    queryKey: queryKeys.services.list({ active: true }),
    queryFn: () => fetchServices({ active: true }),
  })

  const filtered = services.filter((s) => {
    if (!search) return true
    const name = locale === 'ar' ? s.nameAr : s.nameEn
    return name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search01Icon className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('bookings.wizard.step.service.search')}
          className="pe-9"
          dir="auto"
        />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((service) => {
          const name = locale === 'ar' ? service.nameAr : service.nameEn
          const price = formatPrice(service, t)
          const duration = formatDuration(service, t)
          const meta = [duration, price].filter(Boolean).join(' · ')

          return (
            <WizardCard
              key={service.id}
              onClick={() => onSelect(service.id, name)}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope02Icon className="h-4 w-4 text-primary" />
                </span>
                <div className="flex flex-col items-start gap-0.5">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  {meta && (
                    <span className="text-xs text-muted-foreground">{meta}</span>
                  )}
                </div>
              </div>
            </WizardCard>
          )
        })}
      </div>
    </div>
  )
}
```

> **Note**: Check the actual `Service` type and `fetchServices` function signature from `dashboard/lib/api/services.ts` and `dashboard/lib/types/service.ts`. Adjust field names (e.g., `bookingTypes` vs `serviceBookingTypes`) to match.

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "step-service"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-steps/step-service.tsx
git commit -m "feat(dashboard/bookings): add wizard step-service component"
```

---

## Task 8: Dashboard — Step 2/3: Employee step

**Files:**
- Create: `dashboard/components/features/bookings/wizard-steps/step-employee.tsx`

- [ ] **Step 1: Create the step**

Create `dashboard/components/features/bookings/wizard-steps/step-employee.tsx`:

```typescript
'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/hooks/use-locale'
import { queryKeys } from '@/lib/query-keys'
import { fetchServiceEmployees } from '@/lib/api/services'
import { WizardCard } from '../wizard-card'
import { UserCircleIcon } from '@hugeicons/react'

interface StepEmployeeProps {
  serviceId: string
  onSelect: (employeeId: string, employeeName: string) => void
}

export function StepEmployee({ serviceId, onSelect }: StepEmployeeProps) {
  const { t, locale } = useLocale()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {employees.map((p) => {
        const name = locale === 'ar' ? p.nameAr : p.nameEn
        const specialty = locale === 'ar' ? p.specialty?.nameAr : p.specialty?.nameEn

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.id, name)}
          >
            <div className="flex items-center gap-3">
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={name}
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserCircleIcon className="h-5 w-5 text-muted-foreground" />
                </span>
              )}
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium text-foreground">{name}</span>
                {specialty && (
                  <span className="text-xs text-muted-foreground">{specialty}</span>
                )}
              </div>
            </div>
          </WizardCard>
        )
      })}
    </div>
  )
}
```

> **Note**: The `fetchServiceEmployees` return type needs to match. Check the actual backend response shape from `GET /services/:id/employees` and adjust field names (`nameAr`, `nameEn`, `avatarUrl`, `specialty`) accordingly.

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "step-employee"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-steps/step-employee.tsx
git commit -m "feat(dashboard/bookings): add wizard step-employee component"
```

---

## Task 9: Dashboard — Step 4: Type + Duration

**Files:**
- Create: `dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx`

- [ ] **Step 1: Create the step**

Create `dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx`:

```typescript
'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/hooks/use-locale'
import { queryKeys } from '@/lib/query-keys'
import { fetchEmployeeServiceTypes } from '@/lib/api/employees'
import { WizardCard } from '../wizard-card'
import {
  Building04Icon,
  VideoCallIcon,
  WalkingIcon,
} from '@hugeicons/react'
import type { BookingType } from '@/lib/types/booking'

interface StepTypeDurationProps {
  employeeId: string
  serviceId: string
  selectedType: BookingType | null
  selectedDurationOptionId: string | null
  onSelectType: (type: BookingType) => void
  onSelectDuration: (durationOptionId: string, label: string) => void
  onSkipDuration: () => void
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  in_person: <Building04Icon className="h-5 w-5" />,
  online: <VideoCallIcon className="h-5 w-5" />,
  walk_in: <WalkingIcon className="h-5 w-5" />,
}

export function StepTypeDuration({
  employeeId,
  serviceId,
  selectedType,
  selectedDurationOptionId,
  onSelectType,
  onSelectDuration,
  onSkipDuration,
}: StepTypeDurationProps) {
  const { t, locale } = useLocale()

  const { data: serviceTypes = [], isLoading } = useQuery({
    queryKey: queryKeys.employees.serviceTypes(employeeId, serviceId),
    queryFn: () =>
      fetchEmployeeServiceTypes(employeeId, serviceId),
    enabled: !!employeeId && !!serviceId,
  })

  // Auto-select if only one type available
  useEffect(() => {
    if (serviceTypes.length === 1 && !selectedType) {
      onSelectType(serviceTypes[0].bookingType as BookingType)
    }
  }, [serviceTypes, selectedType, onSelectType])

  const selectedServiceType = serviceTypes.find(
    (st) => st.bookingType === selectedType,
  )
  const durationOptions = selectedServiceType?.durationOptions ?? []

  // Auto-select if only one duration option, or skip if none
  useEffect(() => {
    if (!selectedType) return
    if (durationOptions.length === 0) {
      onSkipDuration()
    } else if (durationOptions.length === 1 && !selectedDurationOptionId) {
      const opt = durationOptions[0]
      const label = locale === 'ar' ? opt.labelAr ?? opt.label : opt.label
      onSelectDuration(opt.id, label)
    }
  }, [selectedType, durationOptions, selectedDurationOptionId, onSelectDuration, onSkipDuration, locale])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  const typeLabels: Record<string, string> = {
    in_person: t('bookings.wizard.step.typeDuration.inPerson'),
    online: t('bookings.wizard.step.typeDuration.online'),
    walk_in: t('bookings.wizard.step.typeDuration.walkIn'),
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Type grid */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('bookings.wizard.step.typeDuration.typeTitle')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {serviceTypes.map((st) => (
            <WizardCard
              key={st.bookingType}
              selected={selectedType === st.bookingType}
              onClick={() => onSelectType(st.bookingType as BookingType)}
            >
              <div className="flex flex-col items-center gap-1.5 py-1">
                <span className="text-primary">
                  {TYPE_ICONS[st.bookingType] ?? <Building04Icon className="h-5 w-5" />}
                </span>
                <span className="text-sm font-medium">
                  {typeLabels[st.bookingType] ?? st.bookingType}
                </span>
              </div>
            </WizardCard>
          ))}
        </div>
      </div>

      {/* Duration grid — shown only after type selected and durations exist */}
      {selectedType && durationOptions.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('bookings.wizard.step.typeDuration.durationTitle')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {durationOptions.map((opt) => {
              const label = locale === 'ar' ? opt.labelAr ?? opt.label : opt.label
              const price = opt.price != null
                ? `${(opt.price / 100).toFixed(0)} ${t('bookings.wizard.step.service.currency')}`
                : null

              return (
                <WizardCard
                  key={opt.id}
                  selected={selectedDurationOptionId === opt.id}
                  onClick={() => onSelectDuration(opt.id, label)}
                >
                  <div className="flex flex-col items-center gap-1 py-1">
                    <span className="text-sm font-semibold">{label}</span>
                    {price && (
                      <span className="text-xs text-muted-foreground">{price}</span>
                    )}
                  </div>
                </WizardCard>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

> **Note**: Check `fetchEmployeeServiceTypes` signature in `dashboard/lib/api/employees.ts`. It may be named differently. Also confirm `queryKeys.employees.serviceTypes(employeeId, serviceId)` exists or add it to `query-keys.ts`.

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "step-type-duration"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-steps/step-type-duration.tsx
git commit -m "feat(dashboard/bookings): add wizard step-type-duration component"
```

---

## Task 10: Dashboard — Step 5: Date + Time

**Files:**
- Create: `dashboard/components/features/bookings/wizard-steps/step-datetime.tsx`

- [ ] **Step 1: Create the step**

Create `dashboard/components/features/bookings/wizard-steps/step-datetime.tsx`:

```typescript
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/hooks/use-locale'
import { queryKeys } from '@/lib/query-keys'
import { fetchEmployeeSlots } from '@/lib/api/employees'
import { WizardCard } from '../wizard-card'
import { cn } from '@/lib/utils'

interface StepDatetimeProps {
  employeeId: string
  durationOptionId: string | null
  selectedDate: string | null
  selectedTime: string | null
  onSelectDate: (date: string) => void
  onSelectTime: (time: string) => void
}

function buildDayStrip(daysAhead = 14): Array<{ iso: string; label: string; dayName: string }> {
  return Array.from({ length: daysAhead }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })
    const dayName = d.toLocaleDateString('ar-SA', { weekday: 'short' })
    return { iso, label, dayName }
  })
}

export function StepDatetime({
  employeeId,
  durationOptionId,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: StepDatetimeProps) {
  const { t } = useLocale()
  const days = useMemo(() => buildDayStrip(14), [])

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: queryKeys.employees.slots(employeeId, selectedDate ?? '', durationOptionId ?? ''),
    queryFn: () =>
      fetchEmployeeSlots({
        employeeId,
        date: selectedDate!,
        durationOptionId: durationOptionId ?? undefined,
      }),
    enabled: !!employeeId && !!selectedDate,
  })

  return (
    <div className="flex flex-col gap-4">
      {/* Day strip */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('bookings.wizard.step.datetime.dayTitle')}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {days.map(({ iso, label, dayName }) => (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={cn(
                'flex shrink-0 flex-col items-center gap-0.5 rounded-xl border border-border',
                'px-3 py-2 text-center transition-all duration-150',
                'hover:border-primary/40 hover:bg-primary/5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                selectedDate === iso
                  ? 'border-primary bg-primary/8 ring-1 ring-primary/30'
                  : 'bg-surface',
              )}
            >
              <span className="text-xs text-muted-foreground">{dayName}</span>
              <span className="text-sm font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('bookings.wizard.step.datetime.timeTitle')}
          </p>

          {slotsLoading && (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          )}

          {!slotsLoading && slots.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              {t('bookings.wizard.step.datetime.noSlots')}
            </p>
          )}

          {!slotsLoading && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => (
                <WizardCard
                  key={slot.startTime}
                  selected={selectedTime === slot.startTime}
                  onClick={() => onSelectTime(slot.startTime)}
                >
                  <span className="block text-center text-sm font-medium">
                    {slot.startTime}
                  </span>
                </WizardCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

> **Note**: Check `fetchEmployeeSlots` and `queryKeys.employees.slots` signatures — adjust parameter names and query key structure to match what already exists in `use-booking-slots.ts`.

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "step-datetime"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-steps/step-datetime.tsx
git commit -m "feat(dashboard/bookings): add wizard step-datetime component"
```

---

## Task 11: Dashboard — Step 6: Confirm + Pay

**Files:**
- Create: `dashboard/components/features/bookings/wizard-steps/step-confirm.tsx`

- [ ] **Step 1: Create the step**

Create `dashboard/components/features/bookings/wizard-steps/step-confirm.tsx`:

```typescript
'use client'

import { useLocale } from '@/hooks/use-locale'
import { Button } from '@/components/ui/button'
import { Edit02Icon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import type { WizardState, WizardStep } from '../use-wizard-state'

interface StepConfirmProps {
  state: WizardState
  submitting: boolean
  onJump: (step: WizardStep) => void
  onSubmit: () => void
  onTogglePayAtClinic: (value: boolean) => void
}

interface SummaryRowProps {
  label: string
  value: string
  onEdit: () => void
}

function SummaryRow({ label, value, onEdit }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{value}</span>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Edit02Icon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function StepConfirm({
  state,
  submitting,
  onJump,
  onSubmit,
  onTogglePayAtClinic,
}: StepConfirmProps) {
  const { t, locale } = useLocale()

  const dateLabel = state.date
    ? new Date(state.date + 'T00:00:00').toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—'

  const typeLabels: Record<string, string> = {
    in_person: t('bookings.wizard.step.typeDuration.inPerson'),
    online: t('bookings.wizard.step.typeDuration.online'),
    walk_in: t('bookings.wizard.step.typeDuration.walkIn'),
  }

  const typeValue = state.type
    ? [typeLabels[state.type], state.durationLabel].filter(Boolean).join(' · ')
    : '—'

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="divide-y divide-border px-4">
          <SummaryRow
            label={t('bookings.wizard.step.confirm.client')}
            value={state.clientName ?? '—'}
            onEdit={() => onJump(1)}
          />
          <SummaryRow
            label={t('bookings.wizard.step.confirm.service')}
            value={state.serviceName ?? '—'}
            onEdit={() => onJump(2)}
          />
          <SummaryRow
            label={t('bookings.wizard.step.confirm.employee')}
            value={state.employeeName ?? '—'}
            onEdit={() => onJump(3)}
          />
          <SummaryRow
            label={t('bookings.wizard.step.confirm.type')}
            value={typeValue}
            onEdit={() => onJump(4)}
          />
          <SummaryRow
            label={t('bookings.wizard.step.confirm.datetime')}
            value={`${dateLabel} - ${state.startTime ?? '—'}`}
            onEdit={() => onJump(5)}
          />
        </div>
      </div>

      {/* Pay at clinic toggle */}
      <button
        type="button"
        onClick={() => onTogglePayAtClinic(!state.payAtClinic)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3',
          'text-right transition-colors hover:bg-muted/50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          state.payAtClinic && 'border-primary/40 bg-primary/5',
        )}
      >
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            state.payAtClinic
              ? 'border-primary bg-primary'
              : 'border-border bg-surface',
          )}
        >
          {state.payAtClinic && (
            <span className="block h-2 w-2 rounded-full bg-white" />
          )}
        </div>
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-medium">
            {t('bookings.wizard.step.confirm.payAtClinic')}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('bookings.wizard.step.confirm.payAtClinicDescription')}
          </span>
        </div>
      </button>

      {/* Submit */}
      <Button
        className="w-full"
        size="lg"
        onClick={onSubmit}
        disabled={submitting}
        loading={submitting}
      >
        {t('bookings.wizard.step.confirm.submit')}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "step-confirm"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/wizard-steps/step-confirm.tsx
git commit -m "feat(dashboard/bookings): add wizard step-confirm component"
```

---

## Task 12: Dashboard — `BookingWizard` orchestrator

**Files:**
- Create: `dashboard/components/features/bookings/booking-wizard.tsx`

This component ties all steps together with animated transitions.

- [ ] **Step 1: Create the orchestrator**

Create `dashboard/components/features/bookings/booking-wizard.tsx`:

```typescript
'use client'

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocale } from '@/hooks/use-locale'
import { queryKeys } from '@/lib/query-keys'
import { fetchBookingFlowOrder } from '@/lib/api/organization-settings'
import { useWizardState } from './use-wizard-state'
import { useBookingMutations } from '@/hooks/use-booking-mutations'
import { ClientStep } from './booking-client-step'
import { StepService } from './wizard-steps/step-service'
import { StepEmployee } from './wizard-steps/step-employee'
import { StepTypeDuration } from './wizard-steps/step-type-duration'
import { StepDatetime } from './wizard-steps/step-datetime'
import { StepConfirm } from './wizard-steps/step-confirm'
import { ArrowRight01Icon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { WizardStep } from './use-wizard-state'

const STEP_COUNT = 6

interface BookingWizardProps {
  onSuccess: () => void
  onClose: () => void
}

function StepDots({ current, total }: { current: WizardStep; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`block rounded-full transition-all duration-200 ${
            i + 1 === current
              ? 'h-2 w-6 bg-primary'
              : i + 1 < current
              ? 'h-2 w-2 bg-primary/40'
              : 'h-2 w-2 bg-border'
          }`}
        />
      ))}
    </div>
  )
}

export function BookingWizard({ onSuccess, onClose }: BookingWizardProps) {
  const { t } = useLocale()

  const { data: flowOrder = 'service_first' } = useQuery({
    queryKey: queryKeys.organizationSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60 * 1000, // 5 min — setting rarely changes
  })

  const wizard = useWizardState(flowOrder)
  const { state } = wizard
  const { createMut } = useBookingMutations()

  const handleSubmit = useCallback(async () => {
    if (
      !state.clientId ||
      !state.serviceId ||
      !state.employeeId ||
      !state.type ||
      !state.date ||
      !state.startTime
    ) return

    try {
      await createMut.mutateAsync({
        clientId: state.clientId,
        serviceId: state.serviceId,
        employeeId: state.employeeId,
        type: state.type,
        durationOptionId: state.durationOptionId ?? undefined,
        date: state.date,
        startTime: state.startTime,
        payAtClinic: state.payAtClinic,
      })
      onSuccess()
    } catch {
      toast.error(t('bookings.create.error'))
    }
  }, [state, createMut, onSuccess, t])

  const stepTitles: Record<WizardStep, string> = {
    1: t('bookings.wizard.stepLabel.client'),
    2: flowOrder === 'service_first'
      ? t('bookings.wizard.stepLabel.service')
      : t('bookings.wizard.stepLabel.employee'),
    3: flowOrder === 'service_first'
      ? t('bookings.wizard.stepLabel.employee')
      : t('bookings.wizard.stepLabel.service'),
    4: t('bookings.wizard.stepLabel.typeDuration'),
    5: t('bookings.wizard.stepLabel.datetime'),
    6: t('bookings.wizard.stepLabel.confirm'),
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Step indicator */}
      <StepDots current={state.step} total={STEP_COUNT} />

      {/* Step title */}
      <p className="text-center text-sm font-medium text-muted-foreground">
        {stepTitles[state.step]}
      </p>

      {/* Step content */}
      <div className="min-h-[300px]">
        {state.step === 1 && (
          <ClientStep onSelect={wizard.selectClient} />
        )}

        {state.step === wizard.stepForService && (
          <StepService onSelect={wizard.selectService} />
        )}

        {state.step === wizard.stepForEmployee && state.serviceId && (
          <StepEmployee
            serviceId={state.serviceId}
            onSelect={wizard.selectEmployee}
          />
        )}

        {state.step === 4 && state.employeeId && state.serviceId && (
          <StepTypeDuration
            employeeId={state.employeeId}
            serviceId={state.serviceId}
            selectedType={state.type}
            selectedDurationOptionId={state.durationOptionId}
            onSelectType={wizard.selectType}
            onSelectDuration={wizard.selectDuration}
            onSkipDuration={wizard.skipDuration}
          />
        )}

        {state.step === 5 && state.employeeId && (
          <StepDatetime
            employeeId={state.employeeId}
            durationOptionId={state.durationOptionId}
            selectedDate={state.date}
            selectedTime={state.startTime}
            onSelectDate={wizard.selectDate}
            onSelectTime={wizard.selectTime}
          />
        )}

        {state.step === 6 && (
          <StepConfirm
            state={state}
            submitting={createMut.isPending}
            onJump={wizard.jumpToStep}
            onSubmit={handleSubmit}
            onTogglePayAtClinic={wizard.setPayAtClinic}
          />
        )}
      </div>

      {/* Footer: back + change client */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        {state.step > 1 ? (
          <Button variant="ghost" size="sm" onClick={wizard.goBack}>
            <ArrowRight01Icon className="me-1 h-4 w-4" />
            {t('bookings.wizard.back')}
          </Button>
        ) : (
          <span />
        )}

        {state.step > 1 && state.clientName && (
          <Button variant="link" size="sm" onClick={() => wizard.jumpToStep(1)}>
            {t('bookings.wizard.changeClient')}
          </Button>
        )}
      </div>
    </div>
  )
}
```

> **Note**: Check `useBookingMutations` hook location and import path — it's used in the existing dialog. Also verify `createMut.mutateAsync` parameter shape matches `CreateBookingPayload` in `dashboard/lib/types/booking.ts`.

- [ ] **Step 2: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "booking-wizard"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/booking-wizard.tsx
git commit -m "feat(dashboard/bookings): add BookingWizard orchestrator"
```

---

## Task 13: Dashboard — Wire wizard into `BookingCreateDialog`

**Files:**
- Modify: `dashboard/components/features/bookings/booking-create-dialog.tsx`

- [ ] **Step 1: Read the current file**

Read `dashboard/components/features/bookings/booking-create-dialog.tsx` and understand the current step 2 rendering.

- [ ] **Step 2: Replace step 2 content with BookingWizard**

The dialog currently renders:
- Step 1: `<ClientStep onSelect={...} />`
- Step 2: `<BookingStep clientName={...} onSubmit={...} submitting={...} />`

Replace the entire `DialogContent` body with the following. The wizard handles its own client step now, so the outer dialog just needs to wrap it:

```typescript
'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BookingWizard } from './booking-wizard'
import { useLocale } from '@/hooks/use-locale'

interface BookingCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function BookingCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: BookingCreateDialogProps) {
  const { t } = useLocale()

  function handleSuccess() {
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('bookings.wizard.title')}</DialogTitle>
        </DialogHeader>
        <BookingWizard
          onSuccess={handleSuccess}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard
npm run typecheck 2>&1 | grep "booking-create-dialog"
```

Expected: no errors.

- [ ] **Step 4: Lint**

```bash
cd dashboard
npm run lint -- --quiet 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
git add dashboard/components/features/bookings/booking-create-dialog.tsx
git commit -m "feat(dashboard/bookings): wire BookingWizard into BookingCreateDialog"
```

---

## Task 14: Manual smoke test

- [ ] **Step 1: Start the dev environment**

```bash
cd /Users/tariq/Documents/my_programs/Deqah
npm run docker:up
npm run dev:backend &
npm run dev:dashboard
```

- [ ] **Step 2: Open the booking creation dialog**

Navigate to `http://localhost:5001/bookings` and click the "حجز جديد" button.

Verify the following flow:

1. **Step 1 (Client)**: Search for a client. Clicking a client row advances to step 2.
2. **Step 2 (Service)**: Service cards appear. Search works. Clicking a service advances to step 3.
3. **Step 3 (Employee)**: Only employees for the selected service appear. Clicking one advances to step 4.
4. **Step 4 (Type+Duration)**: Booking type grid appears. Selecting a type reveals duration grid if applicable. Selecting duration advances to step 5.
5. **Step 5 (Date+Time)**: Day strip appears with 14 days. Clicking a day loads time slots. Clicking a slot advances to step 6.
6. **Step 6 (Confirm)**: Summary shows all selections with edit icons. Each edit icon jumps to the correct step. "إنشاء الحجز" button creates the booking.
7. **Back button**: Returns one step, preserving all state.
8. **Auto-advance**: If only one type or duration option exists, it's selected and skipped automatically.

- [ ] **Step 3: Verify cascade reset**

From step 6, click the edit icon next to "الخدمة". Confirm that employee, type, duration, date, and time are all cleared. Select a new service and confirm the downstream steps are blank.

---

## Self-Review Notes

**Spec coverage check:**
- ✅ 6-step wizard with card selection
- ✅ Service-first / employee-first configurable order
- ✅ Cascade reset on any upstream change
- ✅ Auto-advance when single option available (type, duration)
- ✅ Combined date+time step
- ✅ Price display with "يبدأ من" for multi-tier services
- ✅ Confirmation summary with clickable edit per row
- ✅ Pay at clinic toggle
- ✅ Back navigation
- ✅ Translation keys (AR + EN)
- ✅ Backend `bookingFlowOrder` setting endpoint

**Notes / things to verify during implementation:**
1. `fetchServiceEmployees` — already exists in `services.ts`, verify return type shape
2. `queryKeys.employees.serviceTypes` — verify it takes `(employeeId, serviceId)` in this order
3. `queryKeys.employees.slots` — verify parameter count/order
4. `useBookingMutations` import path in `booking-wizard.tsx`
5. `BookingSettings` upsert `where` clause — check how existing `booking-settings.service.ts` does global upsert (it may use `branchId: null`)
6. `Button` component `loading` prop — confirm it exists in shadcn config or use `disabled={submitting}` only
