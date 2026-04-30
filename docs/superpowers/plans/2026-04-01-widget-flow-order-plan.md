# Widget Booking Flow Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to configure whether the booking widget shows services or employees first, saved in DB and overridable per embed via URL param.

**Architecture:** Backend adds `serviceId` filter to `GET /employees`. Dashboard settings adds a RadioGroup card in `booking-tab.tsx`. Widget reads `flow` from URL (or falls back to API) and reverses the service-step UI and data-fetching logic accordingly.

**Tech Stack:** NestJS + Prisma (backend), Next.js 15 App Router + TanStack Query + shadcn/ui (dashboard), React + useQuery (widget hook).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/src/modules/employees/dto/get-employees-query.dto.ts` | Modify | Add `serviceId` optional field |
| `backend/src/modules/employees/employees.service.ts` | Modify | Apply `serviceId` filter in `findAll` |
| `backend/src/modules/employees/tests/employees.service.spec.ts` | Modify | Add test for `serviceId` filter |
| `dashboard/hooks/use-organization-settings.ts` | Modify | Add `useBookingFlowOrder` query + mutation |
| `dashboard/components/features/settings/booking-tab.tsx` | Modify | Add `FlowOrderCard` component |
| `dashboard/components/features/settings/widget-tab.tsx` | Modify | Add `flow` param to configurator + URL builder |
| `dashboard/app/booking/page.tsx` | Modify | Read `flow` from searchParams, pass to wizard |
| `dashboard/components/features/widget/booking-wizard.tsx` | Modify | Accept + pass `initialFlowOrder` prop |
| `dashboard/hooks/use-widget-booking.ts` | Modify | Add `flowOrder` param, dual fetch logic |
| `dashboard/components/features/widget/widget-service-step.tsx` | Modify | Reverse UI for `service_first` mode |

---

## Task 1: Backend — Add `serviceId` filter to employees query

**Files:**
- Modify: `backend/src/modules/employees/dto/get-employees-query.dto.ts`
- Modify: `backend/src/modules/employees/employees.service.ts`
- Modify: `backend/src/modules/employees/tests/employees.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `backend/src/modules/employees/tests/employees.service.spec.ts` and add this test inside the `findAll` describe block:

```typescript
it('should filter employees by serviceId', async () => {
  const mockServiceId = 'service-uuid-123';
  mockPrisma.employee.findMany.mockResolvedValue([]);
  mockPrisma.employee.count.mockResolvedValue(0);

  await service.findAll({ serviceId: mockServiceId });

  expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        services: { some: { serviceId: mockServiceId } },
      }),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npm run test -- --testPathPattern="employees.service.spec" --verbose 2>&1 | tail -20
```

Expected: FAIL — "serviceId" not in the params type.

- [ ] **Step 3: Add `serviceId` to DTO**

In `backend/src/modules/employees/dto/get-employees-query.dto.ts`, add after the `branchId` field:

```typescript
@ApiPropertyOptional({ format: 'uuid', description: 'Filter employees who offer this service' })
@IsOptional()
@IsUUID()
serviceId?: string;
```

- [ ] **Step 4: Apply filter in `employees.service.ts`**

In `employees.service.ts`, the `findAll` method signature currently ends with `branchId?: string`. Add `serviceId` to it:

```typescript
async findAll(params?: {
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  specialty?: string;
  specialtyId?: string;
  minRating?: number;
  isActive?: boolean;
  branchId?: string;
  serviceId?: string;    // ← add this line
})
```

Then after the `branchId` filter block (around line 70), add:

```typescript
if (params?.serviceId) {
  where.services = { some: { serviceId: params.serviceId } };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend && npm run test -- --testPathPattern="employees.service.spec" --verbose 2>&1 | tail -20
```

Expected: PASS

- [ ] **Step 6: Run full backend tests**

```bash
cd backend && npm run test 2>&1 | tail -20
```

Expected: All passing, no regressions.

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/employees/dto/get-employees-query.dto.ts \
        backend/src/modules/employees/employees.service.ts \
        backend/src/modules/employees/tests/employees.service.spec.ts
git commit -m "feat(employees): add serviceId filter to GET /employees"
```

---

## Task 2: Dashboard Settings — `useBookingFlowOrder` hook + `FlowOrderCard`

**Files:**
- Modify: `dashboard/hooks/use-organization-settings.ts`
- Modify: `dashboard/components/features/settings/booking-tab.tsx`

- [ ] **Step 1: Add hook to `use-organization-settings.ts`**

Open `dashboard/hooks/use-organization-settings.ts` and add at the end of the file:

```typescript
import {
  fetchBookingFlowOrder,
  updateBookingFlowOrder,
  type BookingFlowOrder,
} from "@/lib/api/organization-settings"

export function useBookingFlowOrder() {
  return useQuery({
    queryKey: queryKeys.organizationSettings.bookingFlowOrder(),
    queryFn: fetchBookingFlowOrder,
    staleTime: 5 * 60 * 1000,
  })
}

export function useBookingFlowOrderMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (order: BookingFlowOrder) => updateBookingFlowOrder(order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.organizationSettings.bookingFlowOrder() })
    },
  })
}
```

Make sure `useQueryClient` is imported from `@tanstack/react-query` (check existing imports at top of file — add it if missing).

- [ ] **Step 2: Add `FlowOrderCard` to `booking-tab.tsx`**

Open `dashboard/components/features/settings/booking-tab.tsx`. Add these imports at the top with the existing imports:

```typescript
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useBookingFlowOrder, useBookingFlowOrderMutation } from "@/hooks/use-organization-settings"
import type { BookingFlowOrder } from "@/lib/api/organization-settings"
```

Then add this component before the `BookingTab` export:

```typescript
function FlowOrderCard({ t }: { t: (key: string) => string }) {
  const { data: flowOrder, isLoading } = useBookingFlowOrder()
  const mutation = useBookingFlowOrderMutation()

  const [selected, setSelected] = useState<BookingFlowOrder>("service_first")

  useEffect(() => {
    if (flowOrder) setSelected(flowOrder)
  }, [flowOrder])

  function handleSave() {
    mutation.mutate(selected, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (err: Error) => toast.error(err.message),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.booking.flowOrder.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <RadioGroup
            value={selected}
            onValueChange={(v) => setSelected(v as BookingFlowOrder)}
            className="space-y-3"
          >
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-surface-muted transition-colors">
              <RadioGroupItem value="service_first" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("settings.booking.flowOrder.serviceFirst")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.flowOrder.serviceFirstDesc")}</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border/60 p-3 hover:bg-surface-muted transition-colors">
              <RadioGroupItem value="employee_first" className="mt-0.5" />
              <div>
                <p className="text-sm font-medium">{t("settings.booking.flowOrder.employeeFirst")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.flowOrder.employeeFirstDesc")}</p>
              </div>
            </label>
          </RadioGroup>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={mutation.isPending || isLoading}
        >
          {t("settings.save")}
        </Button>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Add `useEffect` import if missing**

Check the top of `booking-tab.tsx` — if `useEffect` is not in the React import, add it:

```typescript
import { useState, useEffect } from "react"
```

- [ ] **Step 4: Render `FlowOrderCard` in `BookingTab`**

In the `BookingTab` return JSX, add `<FlowOrderCard t={t} />` alongside the other cards. The grid is `md:grid-cols-2` so place it after `RecurringCard`:

```typescript
<RecurringCard settings={settings} onSave={handleSettingsSave} isPending={settingsMut.isPending} t={t} />
<FlowOrderCard t={t} />
```

- [ ] **Step 5: Add translation keys**

Open `dashboard/lib/translations/ar.settings.ts` (or wherever settings translations live — check existing files). Add:

```typescript
"settings.booking.flowOrder.title": "ترتيب خطوات الحجز",
"settings.booking.flowOrder.serviceFirst": "الخدمة أولاً",
"settings.booking.flowOrder.serviceFirstDesc": "يختار المريض الخدمة ثم يرى المعالجين المتاحين لها",
"settings.booking.flowOrder.employeeFirst": "المعالج أولاً",
"settings.booking.flowOrder.employeeFirstDesc": "يختار المريض المعالج ثم يرى خدماته المتاحة",
```

Open the English translations file and add:

```typescript
"settings.booking.flowOrder.title": "Booking Flow Order",
"settings.booking.flowOrder.serviceFirst": "Service First",
"settings.booking.flowOrder.serviceFirstDesc": "Client picks a service, then sees available employees",
"settings.booking.flowOrder.employeeFirst": "Employee First",
"settings.booking.flowOrder.employeeFirstDesc": "Client picks a employee, then sees their services",
```

- [ ] **Step 6: Typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add dashboard/hooks/use-organization-settings.ts \
        dashboard/components/features/settings/booking-tab.tsx \
        dashboard/lib/translations/
git commit -m "feat(dashboard/settings): add booking flow order card in booking tab"
```

---

## Task 3: Dashboard Widget Tab — Add `flow` URL param

**Files:**
- Modify: `dashboard/components/features/settings/widget-tab.tsx`

- [ ] **Step 1: Add `flow` state and param to `buildWidgetUrl`**

Open `widget-tab.tsx`. Update the `buildWidgetUrl` function params type and body:

```typescript
function buildWidgetUrl(params: {
  employee?: string
  service?: string
  locale: string
  origin: string
  flow?: "service_first" | "employee_first"
}) {
  const url = new URL(`${DASHBOARD_ORIGIN}/booking`)
  if (params.employee) url.searchParams.set("employee", params.employee)
  if (params.service) url.searchParams.set("service", params.service)
  url.searchParams.set("locale", params.locale)
  if (params.origin) url.searchParams.set("origin", params.origin)
  if (params.flow) url.searchParams.set("flow", params.flow)
  return url.toString()
}
```

- [ ] **Step 2: Add `flow` state in `WidgetTab` component**

In the `WidgetTab` function body, add alongside the other state:

```typescript
const [flow, setFlow] = useState<"service_first" | "employee_first" | undefined>(undefined)
```

Update `widgetUrl` call to pass flow:

```typescript
const widgetUrl = buildWidgetUrl({
  employee: employee || undefined,
  service: service || undefined,
  locale,
  origin: embedOrigin,
  flow: flow || undefined,
})
```

- [ ] **Step 3: Add `flow` toggle UI**

In the configurator `CardContent`, after the `sm:grid-cols-3` grid (locale/employee/service), add a new section:

```typescript
{/* Flow Order */}
<div className="space-y-1.5">
  <Label className="text-sm font-medium">{t("settings.widget.flowOrder")}</Label>
  <div className="flex gap-2">
    {([undefined, "service_first", "employee_first"] as const).map((f) => (
      <button
        key={f ?? "default"}
        type="button"
        onClick={() => setFlow(f)}
        className={cn(
          "flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors",
          flow === f
            ? "bg-primary text-primary-foreground border-primary"
            : "border-border text-muted-foreground hover:bg-surface-muted",
        )}
      >
        {f === undefined
          ? (t("settings.widget.flowDefault"))
          : f === "service_first"
          ? (t("settings.widget.flowServiceFirst"))
          : (t("settings.widget.flowEmployeeFirst"))}
      </button>
    ))}
  </div>
  <p className="text-xs text-muted-foreground">{t("settings.widget.flowHint")}</p>
</div>
```

- [ ] **Step 4: Add `flow` to `ParamRow` reference table**

In the params reference card, add after the `service` ParamRow:

```typescript
<ParamRow
  name="flow"
  description={t("settings.widget.param.flow")}
  example="service_first | employee_first"
/>
```

- [ ] **Step 5: Add translation keys for widget tab**

In the AR translations file, add:

```typescript
"settings.widget.flowOrder": "ترتيب الخطوات",
"settings.widget.flowDefault": "افتراضي",
"settings.widget.flowServiceFirst": "خدمة أولاً",
"settings.widget.flowEmployeeFirst": "معالج أولاً",
"settings.widget.flowHint": "يتجاوز الإعداد المحفوظ في الحساب",
"settings.widget.param.flow": "ترتيب خطوات الويدجت — يتجاوز إعداد الحساب",
```

In the EN translations file, add:

```typescript
"settings.widget.flowOrder": "Step Order",
"settings.widget.flowDefault": "Default",
"settings.widget.flowServiceFirst": "Service First",
"settings.widget.flowEmployeeFirst": "Employee First",
"settings.widget.flowHint": "Overrides the account-level setting",
"settings.widget.param.flow": "Widget flow order — overrides account setting",
```

- [ ] **Step 6: Typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add dashboard/components/features/settings/widget-tab.tsx \
        dashboard/lib/translations/
git commit -m "feat(dashboard/settings): add flow order param to widget tab configurator"
```

---

## Task 4: Widget Page + Wizard — Pass `flowOrder` prop

**Files:**
- Modify: `dashboard/app/booking/page.tsx`
- Modify: `dashboard/components/features/widget/booking-wizard.tsx`

- [ ] **Step 1: Update `booking/page.tsx` to read `flow` param**

Replace the entire file content:

```typescript
import { Suspense } from "react"
import { BookingWizard } from "@/components/features/widget/booking-wizard"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { fetchBookingFlowOrder, type BookingFlowOrder } from "@/lib/api/organization-settings"

interface PageProps {
  searchParams: Promise<{
    employee?: string
    service?: string
    locale?: string
    type?: string
    origin?: string
    flow?: string
  }>
}

export default async function WidgetBookPage({ searchParams }: PageProps) {
  const params = await searchParams

  // URL param takes priority; fall back to DB setting
  let flowOrder: BookingFlowOrder = "service_first"
  if (params.flow === "service_first" || params.flow === "employee_first") {
    flowOrder = params.flow
  } else {
    try {
      flowOrder = await fetchBookingFlowOrder()
    } catch {
      // keep default
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="text-primary" />
        </div>
      }
    >
      <BookingWizard
        initialEmployeeId={params.employee}
        initialServiceId={params.service}
        initialLocale={(params.locale as "ar" | "en") ?? "ar"}
        parentOrigin={params.origin}
        initialFlowOrder={flowOrder}
      />
    </Suspense>
  )
}
```

- [ ] **Step 2: Update `BookingWizardProps` in `booking-wizard.tsx`**

Add `initialFlowOrder` to the props interface and pass it to `useWidgetBooking`:

```typescript
interface BookingWizardProps {
  initialEmployeeId?: string
  initialServiceId?: string
  initialLocale?: "ar" | "en"
  parentOrigin?: string
  initialFlowOrder?: "service_first" | "employee_first"
}

export function BookingWizard({
  initialEmployeeId,
  initialServiceId,
  initialLocale = "ar",
  parentOrigin = "*",
  initialFlowOrder = "service_first",
}: BookingWizardProps) {
  const booking = useWidgetBooking(initialEmployeeId, initialServiceId, initialFlowOrder)
```

Also pass `flowOrder` to `WidgetServiceStep`:

```typescript
{state.step === "service" && (
  <WidgetServiceStep
    locale={initialLocale}
    booking={booking}
    flowOrder={initialFlowOrder}
  />
)}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: errors about `flowOrder` not yet in `useWidgetBooking` and `WidgetServiceStep` — that's fine, we fix in next tasks.

- [ ] **Step 4: Commit (will be clean after Tasks 5+6)**

Hold this commit until Tasks 5 and 6 are done — typecheck must pass first.

---

## Task 5: Widget Hook — Dual fetch logic

**Files:**
- Modify: `dashboard/hooks/use-widget-booking.ts`

- [ ] **Step 1: Add `flowOrder` param and `service_first` fetch logic**

Replace the entire `use-widget-booking.ts` file:

```typescript
/**
 * Widget Booking Hook — Deqah Embeddable Widget
 *
 * Manages the multi-step booking wizard state machine.
 * Steps: service → datetime → auth → confirm → success
 *
 * flowOrder controls which entity is selected first:
 * - "employee_first": pick employee → see their services (original)
 * - "service_first": pick service → see employees offering it
 */

"use client"

import { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  fetchWidgetEmployees,
  fetchWidgetEmployeeServices,
  fetchWidgetSlots,
  fetchWidgetServiceTypes,
  fetchWidgetServices,
  widgetCreateBooking,
} from "@/lib/api/widget"
import { queryKeys } from "@/lib/query-keys"
import type { Employee, EmployeeDurationOption, TimeSlot } from "@/lib/types/employee"
import type { Service } from "@/lib/types/service"
import type { BookingType, Booking } from "@/lib/types/booking"

/* ─── Types ─── */

export type WizardStep = "service" | "datetime" | "auth" | "confirm" | "success"
export type BookingFlowOrder = "service_first" | "employee_first"

export interface WizardState {
  step: WizardStep
  employee: Employee | null
  service: Service | null
  bookingType: BookingType | null
  durationOption: EmployeeDurationOption | null
  date: string
  slot: TimeSlot | null
  booking: Booking | null
}

/* ─── Hook ─── */

export function useWidgetBooking(
  initialEmployeeId?: string,
  initialServiceId?: string,
  flowOrder: BookingFlowOrder = "service_first",
) {
  const [state, setState] = useState<WizardState>({
    step: "service",
    employee: null,
    service: null,
    bookingType: null,
    durationOption: null,
    date: "",
    slot: null,
    booking: null,
  })

  /* ─── employee_first: fetch all employees upfront ─── */
  const { data: employeesData, isLoading: employeesLoading } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true }),
    queryFn: () => fetchWidgetEmployees({ perPage: 20 }),
    enabled: flowOrder === "employee_first",
    staleTime: 5 * 60 * 1000,
  })

  /* ─── employee_first: fetch services for selected employee ─── */
  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: queryKeys.employees.services(state.employee?.id ?? ""),
    queryFn: () => fetchWidgetEmployeeServices(state.employee!.id),
    enabled: flowOrder === "employee_first" && !!state.employee,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── service_first: fetch all services upfront ─── */
  const { data: servicesData, isLoading: allServicesLoading } = useQuery({
    queryKey: ["widget-services-all"],
    queryFn: fetchWidgetServices,
    enabled: flowOrder === "service_first",
    staleTime: 5 * 60 * 1000,
  })

  /* ─── service_first: fetch employees filtered by selected service ─── */
  const { data: filteredEmployeesData, isLoading: filteredEmployeesLoading } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, serviceId: state.service?.id }),
    queryFn: () => fetchWidgetEmployees({ perPage: 20, serviceId: state.service!.id }),
    enabled: flowOrder === "service_first" && !!state.service,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── Fetch service types (for booking type selection) ─── */
  const { data: serviceTypes = [] } = useQuery({
    queryKey: queryKeys.employees.serviceTypes(
      state.employee?.id ?? "",
      state.service?.id ?? "",
    ),
    queryFn: () =>
      fetchWidgetServiceTypes(state.employee!.id, state.service!.id),
    enabled: !!state.employee && !!state.service,
    staleTime: 5 * 60 * 1000,
  })

  /* ─── Duration options for selected type ─── */
  const activeServiceType = serviceTypes.find(
    (st) => st.bookingType === state.bookingType && st.isActive,
  )
  const durationOptions: EmployeeDurationOption[] =
    activeServiceType?.durationOptions ?? []

  /* ─── Fetch slots ─── */
  const canFetchSlots =
    !!state.employee && !!state.date &&
    (!durationOptions.length || !!state.durationOption)

  const resolvedDuration = state.durationOption?.durationMinutes ?? undefined

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: [...queryKeys.employees.slots(state.employee?.id ?? "", state.date), resolvedDuration],
    queryFn: () => fetchWidgetSlots(state.employee!.id, state.date, resolvedDuration),
    enabled: canFetchSlots,
  })

  /* ─── Create booking mutation ─── */
  const createMut = useMutation({
    mutationFn: widgetCreateBooking,
    onSuccess: (booking) => {
      setState((s) => ({ ...s, booking, step: "success" }))
    },
  })

  /* ─── Navigation helpers ─── */

  const selectEmployee = useCallback((p: Employee) => {
    setState((s) => ({
      ...s,
      employee: p,
      service: flowOrder === "employee_first" ? null : s.service,
      bookingType: null,
      durationOption: null,
      slot: null,
    }))
  }, [flowOrder])

  const selectService = useCallback((svc: Service, type: BookingType) => {
    setState((s) => ({
      ...s,
      service: svc,
      bookingType: type,
      durationOption: null,
      slot: null,
      step: "datetime",
    }))
  }, [])

  const selectServiceOnly = useCallback((svc: Service) => {
    setState((s) => ({
      ...s,
      service: svc,
      employee: null,
      bookingType: null,
      durationOption: null,
      slot: null,
    }))
  }, [])

  const selectDateTime = useCallback((date: string, slot: TimeSlot) => {
    setState((s) => ({ ...s, date, slot, step: "auth" }))
  }, [])

  const onAuthComplete = useCallback(() => {
    setState((s) => ({ ...s, step: "confirm" }))
  }, [])

  const confirmBooking = useCallback(
    (notes?: string) => {
      if (!state.employee || !state.service || !state.bookingType || !state.date || !state.slot) return
      createMut.mutate({
        employeeId: state.employee.id,
        serviceId: state.service.id,
        type: state.bookingType,
        date: state.date,
        startTime: state.slot.startTime,
        notes,
        ...(state.durationOption ? { durationOptionId: state.durationOption.id } : {}),
      })
    },
    [state, createMut],
  )

  const goBack = useCallback(() => {
    setState((s) => {
      const steps: WizardStep[] = ["service", "datetime", "auth", "confirm"]
      const idx = steps.indexOf(s.step)
      if (idx <= 0) return s
      return { ...s, step: steps[idx - 1] }
    })
  }, [])

  return {
    state,
    setState,
    flowOrder,
    // employee_first data
    employeesData,
    employeesLoading,
    services,
    servicesLoading,
    // service_first data
    allServices: servicesData?.items ?? [],
    allServicesLoading,
    filteredEmployeesData,
    filteredEmployeesLoading,
    // shared
    serviceTypes,
    durationOptions,
    slots,
    slotsLoading,
    canFetchSlots,
    selectEmployee,
    selectService,
    selectServiceOnly,
    selectDateTime,
    onAuthComplete,
    confirmBooking,
    goBack,
    isConfirming: createMut.isPending,
    confirmError: createMut.error,
    initialEmployeeId,
    initialServiceId,
  }
}
```

- [ ] **Step 2: Add `serviceId` to `fetchWidgetEmployees` query type**

Open `dashboard/lib/api/widget.ts`. Update the `WidgetEmployeesQuery` interface:

```typescript
interface WidgetEmployeesQuery {
  page?: number
  perPage?: number
  search?: string
  specialty?: string
  serviceId?: string   // ← add this
}
```

And in `fetchWidgetEmployees`, pass `serviceId` to the API:

```typescript
export async function fetchWidgetEmployees(
  query: WidgetEmployeesQuery = {},
): Promise<PaginatedResponse<Employee>> {
  const res = await api.get<PaginatedResponse<RawEmployee>>("/employees", {
    page: query.page,
    perPage: query.perPage ?? 20,
    search: query.search,
    specialty: query.specialty,
    serviceId: query.serviceId,   // ← add this
    isActive: true,
  })
  return { items: res.items.map(mapEmployee), meta: res.meta }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: errors only about `flowOrder` prop not yet on `WidgetServiceStep` — fix in next task.

---

## Task 6: Widget UI — Reverse `widget-service-step.tsx` for `service_first`

**Files:**
- Modify: `dashboard/components/features/widget/widget-service-step.tsx`

- [ ] **Step 1: Replace the component**

Replace the entire file:

```typescript
"use client"

/**
 * Widget Service Step — Select employee+service+booking type
 * Supports two flow orders:
 *   employee_first: employees → services → booking type
 *   service_first:      services → employees → booking type
 */

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building01Icon,
  Video01Icon,
  Loading03Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"
import type { BookingFlowOrder } from "@/hooks/use-widget-booking"
import type { Employee } from "@/lib/types/employee"
import type { Service } from "@/lib/types/service"
import type { BookingType } from "@/lib/types/booking"

/* ─── Booking type config ─── */

const BOOKING_TYPE_CONFIG: Record<
  Exclude<BookingType, "walk_in">,
  { labelAr: string; labelEn: string; icon: React.ReactNode }
> = {
  in_person: {
    labelAr: "زيارة حضورية",
    labelEn: "In Person",
    icon: <HugeiconsIcon icon={Building01Icon} size={16} />,
  },
  online: {
    labelAr: "عن بعد",
    labelEn: "Online",
    icon: <HugeiconsIcon icon={Video01Icon} size={16} />,
  },
}

/* ─── Props ─── */

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
  flowOrder: BookingFlowOrder
}

export function WidgetServiceStep({ locale, booking, flowOrder }: Props) {
  const {
    employeesData,
    employeesLoading,
    services,
    servicesLoading,
    allServices,
    allServicesLoading,
    filteredEmployeesData,
    filteredEmployeesLoading,
    serviceTypes,
    state,
    selectEmployee,
    selectService,
    selectServiceOnly,
  } = booking

  const [selectedType, setSelectedType] = useState<BookingType | null>(null)
  const isRtl = locale === "ar"
  const chevronIcon = isRtl ? ArrowRight01Icon : ArrowLeft01Icon

  const availableTypes = serviceTypes
    .filter((st) => st.isActive && st.bookingType !== "walk_in")
    .map((st) => st.bookingType as Exclude<BookingType, "walk_in">)

  function handleServiceSelect(svc: Service) {
    if (!selectedType) return
    selectService(svc, selectedType as BookingType)
  }

  /* ══════════════════════════════════════════════
     EMPLOYEE FIRST flow (original behavior)
  ══════════════════════════════════════════════ */

  if (flowOrder === "employee_first") {
    /* Step 1: Select Employee */
    if (!state.employee) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الطبيب أو المعالج" : "Choose a employee"}
          </p>
          {employeesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {(employeesData?.items ?? []).map((p: Employee) => (
                <button
                  key={p.id}
                  onClick={() => selectEmployee(p)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border border-border/60",
                    "hover:border-primary/60 hover:bg-primary/5 transition-all text-start",
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-primary font-semibold text-sm">
                        {p.user.firstName?.[0] ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isRtl && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isRtl && p.specialtyAr ? p.specialtyAr : p.specialty}
                    </p>
                  </div>
                  <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }

    /* Step 2: Select Service (employee_first) */
    if (!state.service) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الخدمة" : "Choose a service"}
          </p>
          {servicesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {services.map((svc: Service) => (
                <div key={svc.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => booking.setState((s) => ({ ...s, service: svc }))}
                    className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <div>
                      <p className="font-medium text-sm">{isRtl ? svc.nameAr : svc.nameEn}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                      </p>
                    </div>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  /* ══════════════════════════════════════════════
     SERVICE FIRST flow (new behavior)
  ══════════════════════════════════════════════ */

  if (flowOrder === "service_first") {
    /* Step 1: Select Service */
    if (!state.service) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الخدمة" : "Choose a service"}
          </p>
          {allServicesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {allServices.map((svc: Service) => (
                <div key={svc.id} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => selectServiceOnly(svc)}
                    className="w-full flex items-center justify-between p-3 hover:bg-primary/5 transition-all text-start"
                  >
                    <div>
                      <p className="font-medium text-sm">{isRtl ? svc.nameAr : svc.nameEn}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {svc.duration} {isRtl ? "دقيقة" : "min"} · {svc.price} {isRtl ? "ر.س" : "SAR"}
                      </p>
                    </div>
                    <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    /* Step 2: Select Employee (service_first — filtered) */
    if (!state.employee) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {isRtl ? "اختر الطبيب أو المعالج" : "Choose a employee"}
          </p>
          {filteredEmployeesLoading ? (
            <div className="flex justify-center py-8">
              <HugeiconsIcon icon={Loading03Icon} size={24} className="text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {(filteredEmployeesData?.items ?? []).map((p: Employee) => (
                <button
                  key={p.id}
                  onClick={() => selectEmployee(p)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border border-border/60",
                    "hover:border-primary/60 hover:bg-primary/5 transition-all text-start",
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {p.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="text-primary font-semibold text-sm">
                        {p.user.firstName?.[0] ?? "?"}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {isRtl && p.nameAr ? p.nameAr : `${p.user.firstName} ${p.user.lastName}`}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {isRtl && p.specialtyAr ? p.specialtyAr : p.specialty}
                    </p>
                  </div>
                  <HugeiconsIcon icon={chevronIcon} size={16} className="text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )
    }
  }

  /* ══════════════════════════════════════════════
     SHARED: Select Booking Type (both flows)
  ══════════════════════════════════════════════ */

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {isRtl ? "اختر نوع الزيارة" : "Choose visit type"}
      </p>
      <div className="space-y-2">
        {availableTypes.map((type) => {
          const config = BOOKING_TYPE_CONFIG[type]
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-start",
                selectedType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <span>{config.icon}</span>
              <span className="text-sm font-medium">
                {isRtl ? config.labelAr : config.labelEn}
              </span>
              {selectedType === type && (
                <Badge variant="default" className="ms-auto text-xs">
                  {isRtl ? "محدد" : "Selected"}
                </Badge>
              )}
            </button>
          )
        })}
      </div>
      <Button
        className="w-full"
        disabled={!selectedType}
        onClick={() => handleServiceSelect(state.service!)}
      >
        {isRtl ? "التالي" : "Next"}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck 2>&1 | tail -20
```

Expected: 0 errors.

- [ ] **Step 3: Commit Tasks 4, 5, 6 together**

```bash
git add dashboard/app/booking/page.tsx \
        dashboard/components/features/widget/booking-wizard.tsx \
        dashboard/hooks/use-widget-booking.ts \
        dashboard/lib/api/widget.ts \
        dashboard/components/features/widget/widget-service-step.tsx
git commit -m "feat(widget): support configurable booking flow order (service_first / employee_first)"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 8 spec sections covered across 6 tasks
- [x] **Backend filter:** Task 1 adds `serviceId` to DTO + service query + test
- [x] **Settings card:** Task 2 adds `FlowOrderCard` in `booking-tab.tsx`
- [x] **Widget tab:** Task 3 adds `flow` param in configurator + param reference
- [x] **Page reads flow:** Task 4 reads URL param, falls back to API
- [x] **Hook dual logic:** Task 5 has separate query paths per `flowOrder`
- [x] **UI reversed:** Task 6 shows services first when `service_first`
- [x] **No placeholders:** All steps have concrete code
- [x] **Type consistency:** `BookingFlowOrder` defined in `use-widget-booking.ts` and imported by `booking-wizard.tsx` and `widget-service-step.tsx`
- [x] **`selectServiceOnly`** defined in Task 5 hook and called in Task 6 UI
- [x] **`fetchWidgetEmployees` serviceId param** added in Task 5 step 2
- [x] **File size check:** `widget-service-step.tsx` will be ~210 lines (under 350 limit)
