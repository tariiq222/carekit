# Widget Full Booking Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the embeddable booking widget with branch selection, coupons/gift cards, payment method selection (Moyasar + at-clinic), and intake form popup after booking.

**Architecture:** Backend adds 3 new public/client endpoints and 2 new `BookingSettings` columns. Dashboard widget gains 2 new step components (`widget-branch-step`, `widget-intake-popup`) and extends the confirm step. The hook and wizard become step-adaptive — branch step only renders when `branches.length > 1`. Intake popup fires post-booking when `intakeFormRequired && !intakeFormAlreadySubmitted`.

**Tech Stack:** NestJS 11 + Prisma 7 (backend), Next.js 15 App Router + TanStack Query + shadcn/ui + Tailwind 4 (dashboard widget). Test runner: `cd backend && npm run test`, typecheck: `cd dashboard && npm run typecheck`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/prisma/schema/bookings.prisma` | Modify | Add `paymentMoyasarEnabled` + `paymentAtClinicEnabled` to `BookingSettings` |
| `backend/prisma/migrations/20260401000000_booking_settings_payment_flags/migration.sql` | Create | Migration for the two new columns |
| `backend/src/modules/branches/branches.controller.ts` | Modify | Add `GET /branches/public` (no auth) |
| `backend/src/modules/branches/branches.service.ts` | Modify | Add `getPublicBranches()` |
| `backend/src/modules/coupons/dto/validate-coupon.dto.ts` | Create | DTO for widget coupon+gift-card validation |
| `backend/src/modules/coupons/coupons.controller.ts` | Modify | Add `POST /coupons/validate` (client JWT) |
| `backend/src/modules/coupons/coupons.service.ts` | Modify | Add `validateCode()` — handles coupon + gift card |
| `backend/src/modules/clinic/clinic-settings.service.ts` | Modify | Add `getPaymentSettings()` + `updatePaymentSettings()` |
| `backend/src/modules/clinic/clinic-settings.controller.ts` | Modify | Add `GET/PATCH /clinic/settings/payment` |
| `backend/src/modules/bookings/booking-creation.service.ts` | Modify | Extend create response with `intakeFormId` + `intakeFormAlreadySubmitted` |
| `backend/src/modules/bookings/dto/create-booking.dto.ts` | Modify | Add `couponCode?` + `giftCardCode?` fields |
| `backend/src/modules/whitelabel/whitelabel.service.ts` | Modify | Include `payment_moyasar_enabled` + `payment_at_clinic_enabled` in `getPublicBranding()` |
| `dashboard/lib/api/widget.ts` | Modify | Add `fetchPublicBranches`, `validateWidgetCode`, extend `WidgetBranding` + `widgetCreateBooking` payload |
| `dashboard/lib/api/clinic-settings.ts` | Modify | Add `fetchPaymentSettings` + `updatePaymentSettings` |
| `dashboard/lib/types/booking.ts` | Modify | Add `intakeFormId` + `intakeFormAlreadySubmitted` to `Booking`, extend `CreateBookingPayload` |
| `dashboard/hooks/use-widget-booking.ts` | Modify | Add `branch` + coupon + payment method + intake popup state |
| `dashboard/hooks/use-widget-booking-queries.ts` | Modify | Add `branchesQuery` |
| `dashboard/components/features/widget/booking-wizard.tsx` | Modify | Dynamic `STEP_ORDER`, add branch step render |
| `dashboard/components/features/widget/widget-steps-sidebar.tsx` | Modify | Accept dynamic steps array |
| `dashboard/components/features/widget/widget-branch-step.tsx` | Create | Branch grid selection UI |
| `dashboard/components/features/widget/widget-confirm-step.tsx` | Modify | Add coupon section + payment RadioGroup |
| `dashboard/components/features/widget/widget-intake-popup.tsx` | Create | Post-booking intake form modal |
| `dashboard/components/features/settings/booking-tab.tsx` | Modify | Add `PaymentMethodsCard` |

---

## Task 1: Backend — Add payment flags to `BookingSettings`

**Files:**
- Modify: `backend/prisma/schema/bookings.prisma`
- Create: `backend/prisma/migrations/20260401000000_booking_settings_payment_flags/migration.sql`

- [ ] **Step 1: Add fields to schema**

In `backend/prisma/schema/bookings.prisma`, inside `model BookingSettings`, after the `bookingFlowOrder` line add:

```prisma
  // Payment method availability
  paymentMoyasarEnabled  Boolean @default(false) @map("payment_moyasar_enabled")
  paymentAtClinicEnabled Boolean @default(true)  @map("payment_at_clinic_enabled")
```

- [ ] **Step 2: Create migration file**

Create directory `backend/prisma/migrations/20260401000000_booking_settings_payment_flags/` and write `migration.sql`:

```sql
-- AddColumn payment_moyasar_enabled
ALTER TABLE "booking_settings" ADD COLUMN "payment_moyasar_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn payment_at_clinic_enabled
ALTER TABLE "booking_settings" ADD COLUMN "payment_at_clinic_enabled" BOOLEAN NOT NULL DEFAULT true;
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npm run prisma:migrate
```

Expected: `1 migration applied` with no errors.

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd backend && npx prisma generate
```

Expected: `Generated Prisma Client`.

---

## Task 2: Backend — `GET /branches/public`

**Files:**
- Modify: `backend/src/modules/branches/branches.service.ts`
- Modify: `backend/src/modules/branches/branches.controller.ts`
- Test: `backend/test/unit/branches/` (create `branches-public.service.spec.ts` if needed)

- [ ] **Step 1: Add `getPublicBranches()` to service**

In `backend/src/modules/branches/branches.service.ts`, add this method:

```typescript
async getPublicBranches(): Promise<Array<{
  id: string;
  nameAr: string;
  nameEn: string;
  address: string | null;
  phone: string | null;
}>> {
  return this.prisma.branch.findMany({
    where: { isActive: true, deletedAt: null },
    select: { id: true, nameAr: true, nameEn: true, address: true, phone: true },
    orderBy: { createdAt: 'asc' },
  });
}
```

- [ ] **Step 2: Add controller endpoint**

In `backend/src/modules/branches/branches.controller.ts`, add before the first `@Get()`:

```typescript
import { Public } from '../../common/decorators/public.decorator.js';
```

Then add this endpoint (no guards needed — `@Public()` bypasses `JwtAuthGuard`):

```typescript
@Get('public')
@Public()
async getPublicBranches() {
  return this.branchesService.getPublicBranches();
}
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npm run test -- --testPathPattern=branches
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add prisma/schema/bookings.prisma prisma/migrations/20260401000000_booking_settings_payment_flags src/modules/branches/branches.service.ts src/modules/branches/branches.controller.ts
git commit -m "feat(backend): add payment flags to BookingSettings + public branches endpoint"
```

---

## Task 3: Backend — `POST /coupons/validate` (coupon + gift card)

**Files:**
- Create: `backend/src/modules/coupons/dto/validate-coupon.dto.ts`
- Modify: `backend/src/modules/coupons/coupons.service.ts`
- Modify: `backend/src/modules/coupons/coupons.controller.ts`

- [ ] **Step 1: Create DTO**

Create `backend/src/modules/coupons/dto/validate-coupon.dto.ts`:

```typescript
import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ description: 'Coupon code or gift card code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Service ID for service-restricted coupons' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ description: 'Original booking amount in SAR (before discount)' })
  @IsInt()
  @Min(0)
  amount!: number;
}
```

- [ ] **Step 2: Add `validateCode()` to coupons service**

In `backend/src/modules/coupons/coupons.service.ts`, add this import at the top:

```typescript
import { ValidateCouponDto } from './dto/validate-coupon.dto.js';
```

Add the method after `applyCoupon`:

```typescript
async validateCode(
  dto: ValidateCouponDto,
  userId: string,
): Promise<{
  valid: boolean;
  discountAmount: number;
  type: 'coupon' | 'gift_card';
  couponId?: string;
  giftCardId?: string;
}> {
  const code = dto.code.toUpperCase();

  // Try coupon first
  const coupon = await this.prisma.coupon.findFirst({
    where: { code, isActive: true },
    include: COUPON_INCLUDE,
  });

  if (coupon) {
    try {
      this.validateCouponExpiry(coupon);
      this.validateCouponUsageLimit(coupon);
      await this.validatePerUserLimit(coupon, userId);
      this.validateServiceRestriction(coupon, dto.serviceId);
      this.validateMinAmount(coupon, dto.amount);
    } catch {
      return { valid: false, discountAmount: 0, type: 'coupon' };
    }
    const discountAmount = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      dto.amount,
    );
    return { valid: true, discountAmount, type: 'coupon', couponId: coupon.id };
  }

  // Try gift card
  const giftCard = await this.prisma.giftCard.findUnique({
    where: { code },
  });

  if (!giftCard || !giftCard.isActive) {
    return { valid: false, discountAmount: 0, type: 'gift_card' };
  }
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    return { valid: false, discountAmount: 0, type: 'gift_card' };
  }
  if (giftCard.balance <= 0) {
    return { valid: false, discountAmount: 0, type: 'gift_card' };
  }

  const discountAmount = Math.min(giftCard.balance, dto.amount);
  return {
    valid: true,
    discountAmount,
    type: 'gift_card',
    giftCardId: giftCard.id,
  };
}
```

- [ ] **Step 3: Add controller endpoint**

In `backend/src/modules/coupons/coupons.controller.ts`, add import:

```typescript
import { ValidateCouponDto } from './dto/validate-coupon.dto.js';
```

Add endpoint after `@Post('apply')`:

```typescript
@Post('validate')
@HttpCode(200)
async validateCode(
  @Body() dto: ValidateCouponDto,
  @Req() req: { user: { id: string } },
) {
  const data = await this.couponsService.validateCode(dto, req.user.id);
  return { success: true, data };
}
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm run test -- --testPathPattern=coupons
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
cd backend && git add src/modules/coupons/
git commit -m "feat(coupons): add POST /coupons/validate for widget coupon + gift card"
```

---

## Task 4: Backend — Payment settings in clinic settings

**Files:**
- Modify: `backend/src/modules/clinic/clinic-settings.service.ts`
- Modify: `backend/src/modules/clinic/clinic-settings.controller.ts`

- [ ] **Step 1: Add service methods**

In `backend/src/modules/clinic/clinic-settings.service.ts`, add after `updateBookingFlowOrder`:

```typescript
async getPaymentSettings(): Promise<{
  paymentMoyasarEnabled: boolean;
  paymentAtClinicEnabled: boolean;
}> {
  const settings = await this.prisma.bookingSettings.findFirst({
    where: { branchId: null },
    select: { paymentMoyasarEnabled: true, paymentAtClinicEnabled: true },
  });
  return {
    paymentMoyasarEnabled: settings?.paymentMoyasarEnabled ?? false,
    paymentAtClinicEnabled: settings?.paymentAtClinicEnabled ?? true,
  };
}

async updatePaymentSettings(data: {
  paymentMoyasarEnabled?: boolean;
  paymentAtClinicEnabled?: boolean;
}): Promise<{ paymentMoyasarEnabled: boolean; paymentAtClinicEnabled: boolean }> {
  const current = await this.prisma.bookingSettings.findFirst({
    where: { branchId: null },
  });

  const updated = current
    ? await this.prisma.bookingSettings.update({
        where: { id: current.id },
        data,
        select: { paymentMoyasarEnabled: true, paymentAtClinicEnabled: true },
      })
    : await this.prisma.bookingSettings.create({
        data: {
          branchId: null,
          paymentMoyasarEnabled: data.paymentMoyasarEnabled ?? false,
          paymentAtClinicEnabled: data.paymentAtClinicEnabled ?? true,
        },
        select: { paymentMoyasarEnabled: true, paymentAtClinicEnabled: true },
      });

  return updated;
}
```

- [ ] **Step 2: Add controller endpoints**

In `backend/src/modules/clinic/clinic-settings.controller.ts`, add imports:

```typescript
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
```

Add after `updateBookingFlowOrder`:

```typescript
@Get('payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CheckPermissions({ module: 'whitelabel', action: 'view' })
async getPaymentSettings() {
  const data = await this.clinicSettingsService.getPaymentSettings();
  return { success: true, data };
}

@Patch('payment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CheckPermissions({ module: 'whitelabel', action: 'edit' })
async updatePaymentSettings(
  @Body() dto: { paymentMoyasarEnabled?: boolean; paymentAtClinicEnabled?: boolean },
) {
  const data = await this.clinicSettingsService.updatePaymentSettings(dto);
  return { success: true, data };
}
```

- [ ] **Step 3: Run tests**

```bash
cd backend && npm run test -- --testPathPattern=clinic
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/clinic/
git commit -m "feat(clinic): add GET/PATCH /clinic/settings/payment endpoints"
```

---

## Task 5: Backend — Extend booking response with intake info

**Files:**
- Modify: `backend/src/modules/bookings/dto/create-booking.dto.ts`
- Modify: `backend/src/modules/bookings/booking-creation.service.ts`

- [ ] **Step 1: Add coupon/gift-card fields to DTO**

In `backend/src/modules/bookings/dto/create-booking.dto.ts`, add after `recurringGroupId`:

```typescript
@ApiPropertyOptional({ description: 'Coupon code to apply discount' })
@IsOptional()
@IsString()
@MaxLength(50)
couponCode?: string;

@ApiPropertyOptional({ description: 'Gift card code to apply discount' })
@IsOptional()
@IsString()
@MaxLength(50)
giftCardCode?: string;
```

- [ ] **Step 2: Extend booking response with intake info**

In `backend/src/modules/bookings/booking-creation.service.ts`, find the place where the booking is returned after creation (the `execute` method return). Add after the booking is created:

```typescript
// Resolve intake form info for the widget popup
const intakeForm = await this.prisma.intakeForm.findFirst({
  where: { serviceId: dto.serviceId, isActive: true },
  select: { id: true },
});

let intakeFormAlreadySubmitted = false;
if (intakeForm && booking.clientId) {
  const existing = await this.prisma.intakeResponse.findFirst({
    where: { formId: intakeForm.id, clientId: booking.clientId },
    select: { id: true },
  });
  intakeFormAlreadySubmitted = !!existing;
}
```

Then add `intakeFormId` and `intakeFormAlreadySubmitted` to the returned booking object:

```typescript
return {
  ...booking,
  intakeFormId: intakeForm?.id ?? null,
  intakeFormAlreadySubmitted,
};
```

> **Note:** Find the exact return point in `booking-creation.service.ts` (around the end of the `execute` method). The existing return may be a `booking` variable — wrap it as shown above.

- [ ] **Step 3: Run tests**

```bash
cd backend && npm run test -- --testPathPattern=bookings.create
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/bookings/
git commit -m "feat(bookings): add couponCode/giftCardCode to DTO + intake info in create response"
```

---

## Task 6: Backend — Extend `GET /whitelabel/public` with payment flags

**Files:**
- Modify: `backend/src/modules/whitelabel/whitelabel.service.ts`

- [ ] **Step 1: Inject ClinicSettingsService into WhitelabelService**

In `backend/src/modules/whitelabel/whitelabel.service.ts`, add to constructor:

```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly cache: CacheService,
  private readonly clinicSettingsService: ClinicSettingsService,
) {}
```

> If `ClinicSettingsService` is not already imported in `WhitelabelModule`, add it. Check `whitelabel.module.ts` — if `ClinicModule` is not imported there, add `ClinicModule` to `imports`.

- [ ] **Step 2: Extend `getPublicBranding()` return**

Find `getPublicBranding()` in `whitelabel.service.ts`. After building `result` from WhiteLabelConfig keys, add payment settings:

```typescript
const paymentSettings = await this.clinicSettingsService.getPaymentSettings();
const fullResult = {
  ...result,
  payment_moyasar_enabled: String(paymentSettings.paymentMoyasarEnabled),
  payment_at_clinic_enabled: String(paymentSettings.paymentAtClinicEnabled),
};
```

Return `fullResult` instead of `result`, and cache `fullResult`.

- [ ] **Step 3: Run tests**

```bash
cd backend && npm run test -- --testPathPattern=whitelabel
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
cd backend && git add src/modules/whitelabel/
git commit -m "feat(whitelabel): include payment flags in GET /whitelabel/public"
```

---

## Task 7: Dashboard — API layer + types

**Files:**
- Modify: `dashboard/lib/api/widget.ts`
- Modify: `dashboard/lib/api/clinic-settings.ts`
- Modify: `dashboard/lib/types/booking.ts`

- [ ] **Step 1: Extend `WidgetBranding` type and `fetchPublicBranches`**

In `dashboard/lib/api/widget.ts`:

Add to `WidgetBranding` interface:
```typescript
payment_moyasar_enabled: string | null
payment_at_clinic_enabled: string | null
```

Add after `fetchWidgetBranding`:
```typescript
export interface PublicBranch {
  id: string
  nameAr: string
  nameEn: string
  address: string | null
  phone: string | null
}

export async function fetchPublicBranches(): Promise<PublicBranch[]> {
  return api.get<PublicBranch[]>("/branches/public")
}
```

- [ ] **Step 2: Add `validateWidgetCode`**

In `dashboard/lib/api/widget.ts`, add after `fetchPublicBranches`:

```typescript
export interface ValidateCodePayload {
  code: string
  serviceId: string
  amount: number
}

export interface ValidateCodeResult {
  valid: boolean
  discountAmount: number
  type: "coupon" | "gift_card"
  couponId?: string
  giftCardId?: string
}

export async function validateWidgetCode(
  payload: ValidateCodePayload,
): Promise<ValidateCodeResult> {
  const res = await api.post<{ data: ValidateCodeResult }>("/coupons/validate", payload)
  return res.data
}
```

- [ ] **Step 3: Extend `widgetCreateBooking` payload**

In `dashboard/lib/types/booking.ts`, extend `CreateBookingPayload`:
```typescript
export interface CreateBookingPayload {
  clientId?: string
  employeeId: string
  serviceId: string
  type: BookingType
  durationOptionId?: string
  date: string
  startTime: string
  notes?: string
  payAtClinic?: boolean
  branchId?: string
  couponCode?: string
  giftCardCode?: string
}
```

Also add to `Booking` interface (after `payment`):
```typescript
intakeFormId: string | null
intakeFormAlreadySubmitted: boolean
```

- [ ] **Step 4: Add payment settings to clinic-settings API**

In `dashboard/lib/api/clinic-settings.ts`, add:

```typescript
export interface PaymentSettings {
  paymentMoyasarEnabled: boolean
  paymentAtClinicEnabled: boolean
}

export async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const res = await api.get<{ data: PaymentSettings }>("/clinic/settings/payment")
  return res.data
}

export async function updatePaymentSettings(
  settings: Partial<PaymentSettings>,
): Promise<PaymentSettings> {
  const res = await api.patch<{ data: PaymentSettings }>("/clinic/settings/payment", settings)
  return res.data
}
```

- [ ] **Step 5: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd dashboard && git add lib/api/widget.ts lib/api/clinic-settings.ts lib/types/booking.ts
git commit -m "feat(widget): extend API layer — branches, coupon validate, payment settings, intake info"
```

---

## Task 8: Dashboard — Hook extension

**Files:**
- Modify: `dashboard/hooks/use-widget-booking-queries.ts`
- Modify: `dashboard/hooks/use-widget-booking.ts`

- [ ] **Step 1: Add branches query**

In `dashboard/hooks/use-widget-booking-queries.ts`, add import:
```typescript
import { fetchPublicBranches } from "@/lib/api/widget"
import type { PublicBranch } from "@/lib/api/widget"
```

Add to the `useWidgetBookingQueries` function:
```typescript
const { data: branches = [], isLoading: branchesLoading } = useQuery({
  queryKey: ["widget", "branches"],
  queryFn: fetchPublicBranches,
  staleTime: STALE_5M,
})
```

Add to return:
```typescript
branches,
branchesLoading,
```

- [ ] **Step 2: Extend WizardState and WizardStep**

In `dashboard/hooks/use-widget-booking.ts`:

Change `WizardStep` type:
```typescript
export type WizardStep = "branch" | "service" | "datetime" | "auth" | "confirm" | "success"
```

Add to `WizardState`:
```typescript
export interface WizardState {
  step: WizardStep
  branch: import("@/lib/api/widget").PublicBranch | null   // NEW
  employee: Employee | null
  service: Service | null
  bookingType: BookingType | null
  durationOption: EmployeeDurationOption | null
  date: string
  slot: TimeSlot | null
  booking: Booking | null
  couponCode: string | null          // NEW — applied code
  couponId: string | null            // NEW
  giftCardId: string | null          // NEW
  discountAmount: number             // NEW
  paymentMethod: "moyasar" | "at_clinic" | null  // NEW
  showIntakePopup: boolean           // NEW
}
```

Update initial state:
```typescript
const [state, setState] = useState<WizardState>({
  step: "service",  // will be overridden to "branch" when hasBranches
  branch: null,
  employee: null,
  service: null,
  bookingType: null,
  durationOption: null,
  date: "",
  slot: null,
  booking: null,
  couponCode: null,
  couponId: null,
  giftCardId: null,
  discountAmount: 0,
  paymentMethod: null,
  showIntakePopup: false,
})
```

- [ ] **Step 3: Add new action helpers**

In `dashboard/hooks/use-widget-booking.ts`, add these helpers after `clearServiceOnly`:

```typescript
const selectBranch = useCallback((branch: import("@/lib/api/widget").PublicBranch) => {
  setState((s) => ({ ...s, branch, step: "service" }))
}, [])

const applyDiscount = useCallback((
  code: string,
  discountAmount: number,
  couponId?: string,
  giftCardId?: string,
) => {
  setState((s) => ({
    ...s,
    couponCode: code,
    discountAmount,
    couponId: couponId ?? null,
    giftCardId: giftCardId ?? null,
  }))
}, [])

const clearDiscount = useCallback(() => {
  setState((s) => ({
    ...s,
    couponCode: null,
    discountAmount: 0,
    couponId: null,
    giftCardId: null,
  }))
}, [])

const selectPaymentMethod = useCallback((method: "moyasar" | "at_clinic") => {
  setState((s) => ({ ...s, paymentMethod: method }))
}, [])

const dismissIntakePopup = useCallback(() => {
  setState((s) => ({ ...s, showIntakePopup: false }))
}, [])
```

- [ ] **Step 4: Extend `confirmBooking` to handle payment method + intake popup**

Replace the existing `confirmBooking` callback:

```typescript
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
      ...(state.branch ? { branchId: state.branch.id } : {}),
      ...(state.couponCode ? { couponCode: state.couponCode } : {}),
      payAtClinic: state.paymentMethod === "at_clinic" ? true : undefined,
    })
  },
  [state, createMut],
)
```

Update `createMut` `onSuccess`:
```typescript
const createMut = useMutation({
  mutationFn: widgetCreateBooking,
  onSuccess: (booking) => {
    const showPopup = !!(booking.intakeFormId && !booking.intakeFormAlreadySubmitted)
    setState((s) => ({ ...s, booking, step: "success", showIntakePopup: showPopup }))
  },
})
```

- [ ] **Step 5: Expose hasBranches and set initial step**

In `useWidgetBooking`, after getting `queries`:

```typescript
const hasBranches = queries.branches.length > 1

// Set initial step to "branch" when there are multiple branches
// (only on first render — if step is already beyond "branch", don't reset)
useEffect(() => {
  if (hasBranches) {
    setState((s) => s.step === "service" && !s.branch ? { ...s, step: "branch" } : s)
  }
}, [hasBranches])
```

Add to return:
```typescript
hasBranches,
selectBranch,
applyDiscount,
clearDiscount,
selectPaymentMethod,
dismissIntakePopup,
```

- [ ] **Step 6: Update `goBack` to handle branch step**

Replace the existing `goBack`:
```typescript
const goBack = useCallback(() => {
  setState((s) => {
    const steps: WizardStep[] = hasBranches
      ? ["branch", "service", "datetime", "auth", "confirm"]
      : ["service", "datetime", "auth", "confirm"]
    const idx = steps.indexOf(s.step)
    if (idx <= 0) return s
    return { ...s, step: steps[idx - 1] }
  })
}, [hasBranches])
```

- [ ] **Step 7: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd dashboard && git add hooks/use-widget-booking.ts hooks/use-widget-booking-queries.ts
git commit -m "feat(widget): extend hook — branch, coupon, payment method, intake popup state"
```

---

## Task 9: Dashboard — `widget-branch-step.tsx` (new file)

**Files:**
- Create: `dashboard/components/features/widget/widget-branch-step.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

/**
 * Widget Branch Step — select clinic branch before booking
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { Building01Icon, Location01Icon, Call02Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { PublicBranch } from "@/lib/api/widget"
import type { useWidgetBooking } from "@/hooks/use-widget-booking"

interface Props {
  locale: "ar" | "en"
  booking: ReturnType<typeof useWidgetBooking>
}

export function WidgetBranchStep({ locale, booking }: Props) {
  const { branches, branchesLoading, selectBranch, state } = booking
  const isRtl = locale === "ar"

  if (branchesLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <HugeiconsIcon icon={Loading03Icon} size={28} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {isRtl ? "اختر الفرع الذي تريد الحجز فيه" : "Select the branch you'd like to book at"}
      </p>

      <div className="grid gap-3">
        {branches.map((branch: PublicBranch) => {
          const isSelected = state.branch?.id === branch.id
          const name = isRtl ? branch.nameAr : branch.nameEn

          return (
            <button
              key={branch.id}
              onClick={() => selectBranch(branch)}
              className={cn(
                "w-full text-start rounded-xl border p-4 transition-all",
                "hover:border-primary/60 hover:bg-primary/5",
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border/60 bg-surface",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <HugeiconsIcon icon={Building01Icon} size={18} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-medium text-sm text-foreground">{name}</p>
                  {branch.address && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={Location01Icon} size={12} />
                      {branch.address}
                    </p>
                  )}
                  {branch.phone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <HugeiconsIcon icon={Call02Icon} size={12} />
                      {branch.phone}
                    </p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

---

## Task 10: Dashboard — `widget-steps-sidebar.tsx` — dynamic steps

**Files:**
- Modify: `dashboard/components/features/widget/widget-steps-sidebar.tsx`

- [ ] **Step 1: Accept dynamic steps prop**

Replace the entire file content:

```typescript
"use client"

/**
 * Widget Steps Sidebar — vertical step list with numbered indicators
 * Accepts a dynamic steps array to support optional branch step.
 */

import { HugeiconsIcon } from "@hugeicons/react"
import { Tick01Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { WizardStep } from "@/hooks/use-widget-booking"

export interface StepDef {
  key: WizardStep
  labelAr: string
  labelEn: string
}

interface Props {
  locale: "ar" | "en"
  step: WizardStep
  steps: StepDef[]
}

export function WidgetStepsSidebar({ locale, step, steps }: Props) {
  const isRtl = locale === "ar"
  const stepIndex = steps.findIndex((s) => s.key === step)

  return (
    <aside
      className={cn(
        "w-48 shrink-0 flex flex-col gap-1 py-6 px-5",
        "bg-surface-muted/60",
        "border-e border-border/50",
      )}
    >
      <div className="flex flex-col gap-3 mt-1">
        {steps.map((s, idx) => {
          const isCompleted = idx < stepIndex
          const isActive = s.key === step
          const isPending = idx > stepIndex

          return (
            <div key={s.key} className="flex items-center gap-3">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold transition-all",
                  isCompleted && "bg-primary text-primary-foreground",
                  isActive && "bg-primary text-primary-foreground",
                  isPending && "bg-muted-foreground/20 text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <HugeiconsIcon icon={Tick01Icon} size={14} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-sm transition-colors leading-tight",
                  isActive && "text-foreground font-semibold",
                  isCompleted && "text-foreground/70 font-medium",
                  isPending && "text-muted-foreground/50",
                )}
              >
                {isRtl ? s.labelAr : s.labelEn}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

---

## Task 11: Dashboard — `booking-wizard.tsx` — dynamic steps + branch render

**Files:**
- Modify: `dashboard/components/features/widget/booking-wizard.tsx`

- [ ] **Step 1: Update STEP_ORDER to be dynamic**

Replace the static `STEP_ORDER` and add dynamic step definitions. Replace the relevant sections in `booking-wizard.tsx`:

```typescript
import { WidgetBranchStep } from "./widget-branch-step"
import type { StepDef } from "./widget-steps-sidebar"
```

Replace:
```typescript
const STEP_ORDER = ["service", "datetime", "auth", "confirm", "success"] as const
```

With (inside the component, after `const booking = useWidgetBooking(...)`):
```typescript
const { hasBranches } = booking

const VISIBLE_STEPS: StepDef[] = [
  ...(hasBranches ? [{ key: "branch" as const, labelAr: "الفرع", labelEn: "Branch" }] : []),
  { key: "service" as const, labelAr: "الخدمة", labelEn: "Service" },
  { key: "datetime" as const, labelAr: "الموعد", labelEn: "Date & Time" },
  { key: "auth" as const, labelAr: "تسجيل", labelEn: "Information" },
  { key: "confirm" as const, labelAr: "التأكيد", labelEn: "Confirmation" },
]

const stepIndex = VISIBLE_STEPS.findIndex((s) => s.key === state.step)
const isSuccess = state.step === "success"
```

- [ ] **Step 2: Add branch step render**

In the content area section, add before `{state.step === "service" && ...}`:

```typescript
{state.step === "branch" && (
  <WidgetBranchStep
    locale={initialLocale}
    booking={booking}
  />
)}
```

- [ ] **Step 3: Update sidebar call**

Replace the `WidgetStepsSidebar` call:

```typescript
<WidgetStepsSidebar
  locale={initialLocale}
  step={state.step}
  steps={VISIBLE_STEPS}
/>
```

- [ ] **Step 4: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd dashboard && git add components/features/widget/booking-wizard.tsx components/features/widget/widget-steps-sidebar.tsx components/features/widget/widget-branch-step.tsx
git commit -m "feat(widget): add branch step — conditional display + dynamic sidebar"
```

---

## Task 12: Dashboard — `widget-confirm-step.tsx` — coupon + payment method

**Files:**
- Modify: `dashboard/components/features/widget/widget-confirm-step.tsx`

- [ ] **Step 1: Add coupon section state**

At the top of `WidgetConfirmStep`, add local state:

```typescript
const [codeInput, setCodeInput] = useState("")
const [codeError, setCodeError] = useState<string | null>(null)
const [isValidating, setIsValidating] = useState(false)
```

Add imports:
```typescript
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { validateWidgetCode } from "@/lib/api/widget"
import { Tag01Icon, GiftIcon } from "@hugeicons/core-free-icons"
```

- [ ] **Step 2: Add coupon handler**

Inside the component, add:

```typescript
const { applyDiscount, clearDiscount, selectPaymentMethod } = booking

async function handleApplyCode() {
  if (!codeInput.trim() || !service) return
  setIsValidating(true)
  setCodeError(null)
  try {
    const result = await validateWidgetCode({
      code: codeInput.trim(),
      serviceId: service.id,
      amount: price,
    })
    if (result.valid) {
      applyDiscount(codeInput.trim(), result.discountAmount, result.couponId, result.giftCardId)
    } else {
      setCodeError(isRtl ? "الكود غير صالح أو منتهي الصلاحية" : "Invalid or expired code")
    }
  } catch {
    setCodeError(isRtl ? "حدث خطأ. حاول مجدداً." : "An error occurred. Try again.")
  } finally {
    setIsValidating(false)
  }
}
```

- [ ] **Step 3: Fetch payment settings**

Add to the component (after existing state):

```typescript
const { data: branding } = useQuery({
  queryKey: ["widget", "branding"],
  queryFn: fetchWidgetBranding,
  staleTime: 10 * 60 * 1000,
})

const moyasarEnabled = branding?.payment_moyasar_enabled === "true"
const atClinicEnabled = branding?.payment_at_clinic_enabled === "true" || branding?.payment_at_clinic_enabled === null || branding?.payment_at_clinic_enabled === undefined

// Auto-select payment method when only one is available
const { paymentMethod } = state
useEffect(() => {
  if (moyasarEnabled && !atClinicEnabled && !paymentMethod) {
    selectPaymentMethod("moyasar")
  } else if (!moyasarEnabled && atClinicEnabled && !paymentMethod) {
    selectPaymentMethod("at_clinic")
  }
}, [moyasarEnabled, atClinicEnabled, paymentMethod, selectPaymentMethod])
```

Add import:
```typescript
import { useQuery } from "@tanstack/react-query"
import { fetchWidgetBranding } from "@/lib/api/widget"
import { useEffect } from "react"
```

- [ ] **Step 4: Update price calculation**

Replace:
```typescript
const price = getPrice(booking)
const vat = Math.round(price * 0.15 * 100) / 100
const total = price + vat
```

With:
```typescript
const price = getPrice(booking)
const discount = state.discountAmount ?? 0
const discountedPrice = Math.max(0, price - discount)
const vat = Math.round(discountedPrice * 0.15 * 100) / 100
const total = discountedPrice + vat
```

- [ ] **Step 5: Add coupon UI before summary card**

Add before the summary card `<div className="bg-muted/30 ...">`:

```typescript
{/* Discount code */}
{!state.couponCode ? (
  <div className="space-y-2">
    <p className="text-xs text-muted-foreground">
      {isRtl ? "هل لديك كود خصم أو بطاقة هدية؟" : "Have a discount or gift card code?"}
    </p>
    <div className="flex gap-2">
      <Input
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value)}
        placeholder={isRtl ? "أدخل الكود" : "Enter code"}
        className="text-sm h-9"
        onKeyDown={(e) => e.key === "Enter" && handleApplyCode()}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleApplyCode}
        disabled={isValidating || !codeInput.trim()}
        className="shrink-0"
      >
        {isValidating
          ? <HugeiconsIcon icon={Loading03Icon} size={14} className="animate-spin" />
          : (isRtl ? "تطبيق" : "Apply")}
      </Button>
    </div>
    {codeError && (
      <p className="text-xs text-destructive">{codeError}</p>
    )}
  </div>
) : (
  <div className="flex items-center justify-between bg-success/10 border border-success/30 rounded-lg px-3 py-2">
    <div className="flex items-center gap-2 text-success text-sm">
      <HugeiconsIcon icon={Tag01Icon} size={14} />
      <span>{state.couponCode}</span>
      <span className="font-semibold">-{state.discountAmount} {isRtl ? "ر.س" : "SAR"}</span>
    </div>
    <button
      onClick={() => { clearDiscount(); setCodeInput("") }}
      className="text-muted-foreground hover:text-foreground text-xs"
    >
      {isRtl ? "إزالة" : "Remove"}
    </button>
  </div>
)}
```

- [ ] **Step 6: Update price rows in summary to show discount**

In the summary card, replace the price rows:

```typescript
<SummaryRow
  label={isRtl ? "السعر" : "Price"}
  value={`${price} ${isRtl ? "ر.س" : "SAR"}`}
/>
{discount > 0 && (
  <SummaryRow
    icon={<HugeiconsIcon icon={Tag01Icon} size={14} className="text-success" />}
    label={isRtl ? "الخصم" : "Discount"}
    value={`-${discount} ${isRtl ? "ر.س" : "SAR"}`}
  />
)}
<SummaryRow
  label={isRtl ? "ضريبة القيمة المضافة (15%)" : "VAT (15%)"}
  value={`${vat} ${isRtl ? "ر.س" : "SAR"}`}
/>
```

- [ ] **Step 7: Add payment method RadioGroup before confirm button**

Add before `{confirmError && ...}`:

```typescript
{/* Payment method */}
{moyasarEnabled && atClinicEnabled && (
  <div className="space-y-2">
    <p className="text-sm font-medium">
      {isRtl ? "طريقة الدفع" : "Payment Method"}
    </p>
    <RadioGroup
      value={state.paymentMethod ?? ""}
      onValueChange={(v) => selectPaymentMethod(v as "moyasar" | "at_clinic")}
      className="space-y-2"
    >
      <label className={cn(
        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
        state.paymentMethod === "moyasar"
          ? "border-primary/60 bg-primary/5"
          : "border-border/60",
      )}>
        <RadioGroupItem value="moyasar" />
        <span className="text-sm">{isRtl ? "دفع إلكتروني" : "Online Payment"}</span>
      </label>
      <label className={cn(
        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
        state.paymentMethod === "at_clinic"
          ? "border-primary/60 bg-primary/5"
          : "border-border/60",
      )}>
        <RadioGroupItem value="at_clinic" />
        <span className="text-sm">{isRtl ? "الدفع في العيادة" : "Pay at Clinic"}</span>
      </label>
    </RadioGroup>
  </div>
)}

{!moyasarEnabled && !atClinicEnabled && (
  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
    {isRtl
      ? "سيتم التواصل معك لتأكيد الموعد والدفع"
      : "We'll contact you to confirm your appointment and payment"}
  </p>
)}
```

- [ ] **Step 8: Disable confirm button when payment method required but not selected**

Update the confirm button:

```typescript
const paymentRequired = moyasarEnabled || atClinicEnabled
const canConfirm = !paymentRequired || !!state.paymentMethod

<Button
  className="w-full"
  disabled={isConfirming || !canConfirm}
  onClick={() => confirmBooking(notes || undefined)}
>
```

- [ ] **Step 9: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
cd dashboard && git add components/features/widget/widget-confirm-step.tsx
git commit -m "feat(widget): add coupon/gift-card + payment method to confirm step"
```

---

## Task 13: Dashboard — `widget-intake-popup.tsx` (new file)

**Files:**
- Create: `dashboard/components/features/widget/widget-intake-popup.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"

/**
 * Widget Intake Popup — post-booking modal for filling intake form
 * Only shown when intakeFormRequired && !intakeFormAlreadySubmitted
 */

import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Loading03Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { fetchIntakeForm } from "@/lib/api/intake-forms"
import { api } from "@/lib/api"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"

interface Props {
  locale: "ar" | "en"
  formId: string
  bookingId: string
  onDismiss: () => void
}

export function WidgetIntakePopup({ locale, formId, bookingId, onDismiss }: Props) {
  const isRtl = locale === "ar"
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [dismissWarning, setDismissWarning] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { data: form, isLoading } = useQuery({
    queryKey: ["widget", "intake-form", formId],
    queryFn: () => fetchIntakeForm(formId),
    staleTime: 5 * 60 * 1000,
  })

  const submitMut = useMutation({
    mutationFn: () =>
      api.post(`/intake-forms/${formId}/responses`, { bookingId, answers }),
    onSuccess: () => {
      setSubmitted(true)
      setTimeout(onDismiss, 1500)
    },
  })

  function handleDismiss() {
    setDismissWarning(true)
    setTimeout(onDismiss, 2000)
  }

  function setAnswer(fieldId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }))
  }

  // ── Success state ──
  if (submitted) {
    return (
      <PopupShell isRtl={isRtl} onDismiss={onDismiss} hideClose>
        <div className="flex flex-col items-center py-6 gap-3 text-center">
          <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
            <HugeiconsIcon icon={Tick01Icon} size={24} className="text-success" />
          </div>
          <p className="text-sm font-medium">
            {isRtl ? "تم إرسال المعلومات بنجاح" : "Information submitted successfully"}
          </p>
        </div>
      </PopupShell>
    )
  }

  // ── Loading ──
  if (isLoading || !form) {
    return (
      <PopupShell isRtl={isRtl} onDismiss={handleDismiss}>
        <div className="flex items-center justify-center h-32">
          <HugeiconsIcon icon={Loading03Icon} size={24} className="animate-spin text-primary" />
        </div>
      </PopupShell>
    )
  }

  const fields = form.fields.sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <PopupShell isRtl={isRtl} onDismiss={handleDismiss}>
      <div className="space-y-1 mb-4">
        <h3 className="font-semibold text-base">
          {isRtl ? "أكمل معلوماتك الطبية" : "Complete Your Medical Information"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isRtl
            ? "هذا النموذج يساعد الطبيب على الاستعداد لموعدك"
            : "This form helps your doctor prepare for your appointment"}
        </p>
      </div>

      {dismissWarning && (
        <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-2 mb-3">
          {isRtl ? "يُفضل تعبئة النموذج قبل موعدك" : "It's recommended to fill this before your appointment"}
        </p>
      )}

      <div className="space-y-4 max-h-64 overflow-y-auto">
        {fields.map((field) => {
          const label = isRtl ? field.labelAr : field.labelEn
          const value = (answers[field.id] as string) ?? ""

          if (field.fieldType === "textarea") {
            return (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-xs">{label}{field.isRequired && " *"}</Label>
                <Textarea
                  rows={2}
                  className="text-sm resize-none"
                  value={value}
                  onChange={(e) => setAnswer(field.id, e.target.value)}
                />
              </div>
            )
          }

          if (field.fieldType === "select" && field.options) {
            return (
              <div key={field.id} className="space-y-1.5">
                <Label className="text-xs">{label}{field.isRequired && " *"}</Label>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt: string) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnswer(field.id, opt)}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-full border transition-all",
                        value === opt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )
          }

          return (
            <div key={field.id} className="space-y-1.5">
              <Label className="text-xs">{label}{field.isRequired && " *"}</Label>
              <Input
                className="text-sm h-9"
                value={value}
                onChange={(e) => setAnswer(field.id, e.target.value)}
              />
            </div>
          )
        })}
      </div>

      {submitMut.isError && (
        <p className="text-xs text-destructive mt-2">
          {isRtl ? "حدث خطأ. حاول مجدداً." : "An error occurred. Try again."}
        </p>
      )}

      <Button
        className="w-full mt-4"
        onClick={() => submitMut.mutate()}
        disabled={submitMut.isPending}
      >
        {submitMut.isPending && <HugeiconsIcon icon={Loading03Icon} size={14} className="me-2 animate-spin" />}
        {isRtl ? "إرسال" : "Submit"}
      </Button>
    </PopupShell>
  )
}

/* ─── Shell ─── */

function PopupShell({
  isRtl,
  onDismiss,
  hideClose,
  children,
}: {
  isRtl: boolean
  onDismiss: () => void
  hideClose?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="glass-solid w-full max-w-md rounded-2xl border border-border/50 shadow-2xl p-5 relative">
        {!hideClose && (
          <button
            onClick={onDismiss}
            className="absolute top-4 end-4 h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount popup in `booking-wizard.tsx`**

Add import:
```typescript
import { WidgetIntakePopup } from "./widget-intake-popup"
```

Inside the component, after the main `<Card>` closing tag, add:

```typescript
{state.showIntakePopup && state.booking?.intakeFormId && (
  <WidgetIntakePopup
    locale={initialLocale}
    formId={state.booking.intakeFormId}
    bookingId={state.booking.id}
    onDismiss={booking.dismissIntakePopup}
  />
)}
```

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add components/features/widget/widget-intake-popup.tsx components/features/widget/booking-wizard.tsx
git commit -m "feat(widget): add post-booking intake form popup"
```

---

## Task 14: Dashboard — Settings — `PaymentMethodsCard`

**Files:**
- Modify: `dashboard/components/features/settings/booking-tab.tsx`
- Modify: `dashboard/hooks/use-clinic-settings.ts`

- [ ] **Step 1: Add hooks for payment settings**

In `dashboard/hooks/use-clinic-settings.ts`, add:

```typescript
import { fetchPaymentSettings, updatePaymentSettings, type PaymentSettings } from "@/lib/api/clinic-settings"

export function usePaymentSettings() {
  return useQuery({
    queryKey: ["clinic-settings", "payment"],
    queryFn: fetchPaymentSettings,
  })
}

export function usePaymentSettingsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updatePaymentSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clinic-settings", "payment"] }),
  })
}
```

- [ ] **Step 2: Add `PaymentMethodsCard` to booking-tab.tsx**

In `dashboard/components/features/settings/booking-tab.tsx`, add import:
```typescript
import { usePaymentSettings, usePaymentSettingsMutation } from "@/hooks/use-clinic-settings"
```

Add the component inside the file (after `FlowOrderCard`):

```typescript
function PaymentMethodsCard({ t }: { t: (key: string) => string }) {
  const { data, isLoading } = usePaymentSettings()
  const mutation = usePaymentSettingsMutation()

  function toggle(key: "paymentMoyasarEnabled" | "paymentAtClinicEnabled", value: boolean) {
    mutation.mutate(
      { [key]: value },
      { onSuccess: () => toast.success(t("settings.saved")), onError: (err: Error) => toast.error(err.message) },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.booking.paymentMethods.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.booking.paymentMethods.moyasar")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.paymentMethods.moyasarDesc")}</p>
              </div>
              <Switch
                checked={data?.paymentMoyasarEnabled ?? false}
                onCheckedChange={(v) => toggle("paymentMoyasarEnabled", v)}
                disabled={mutation.isPending}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">{t("settings.booking.paymentMethods.atClinic")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("settings.booking.paymentMethods.atClinicDesc")}</p>
              </div>
              <Switch
                checked={data?.paymentAtClinicEnabled ?? true}
                onCheckedChange={(v) => toggle("paymentAtClinicEnabled", v)}
                disabled={mutation.isPending}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

Then add `<PaymentMethodsCard t={t} />` in the return JSX after `<FlowOrderCard t={t} />`.

- [ ] **Step 3: Typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd dashboard && git add components/features/settings/booking-tab.tsx hooks/use-clinic-settings.ts
git commit -m "feat(settings): add payment methods toggle card to booking settings"
```

---

## Task 15: Backend — Run full test suite

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm run test
```

Expected: all pass, no regressions.

- [ ] **Step 2: Run coverage check**

```bash
cd backend && npm run test:cov
```

Expected: branch ≥ 40%, fn/line ≥ 50%.

---

## Task 16: Dashboard — Final typecheck

- [ ] **Step 1: Full typecheck**

```bash
cd dashboard && npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Lint**

```bash
cd dashboard && npm run lint
```

Expected: 0 errors.
