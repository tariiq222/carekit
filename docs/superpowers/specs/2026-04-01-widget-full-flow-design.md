# Widget Booking Flow — Complete Design Spec

**Date:** 2026-04-01  
**Status:** Approved for implementation

## Overview

Extend the embeddable booking widget with the missing steps and features: branch selection (conditional), coupons/gift cards, payment method selection, and intake form popup after booking. All additions are adaptive — they only appear when enabled/applicable.

---

## 1. Full Flow

```
[branch?] → [service⇄practitioner] → datetime → auth → confirm+payment → [intake popup?] → success
```

### Step Visibility Rules

| Step | Appears When |
|------|-------------|
| **branch** | API returns `branches.length > 1` |
| **service** | Always (order controlled by `flowOrder` setting) |
| **datetime** | Always |
| **auth** | Always (login or register) |
| **confirm** | Always — includes coupon field + price summary + payment method |
| **intake popup** | After booking created, if `intakeFormRequired && !intakeFormAlreadySubmitted` |
| **success** | Always |

### flowOrder

The existing `flowOrder: "service_first" | "practitioner_first"` setting controls the internal display order within the service/practitioner step. No new step — same step, reversed UI. Already implemented.

### Sidebar

Renders dynamic steps only. If no branch step, numbering starts from 1 at service. Steps array is computed at runtime based on `hasBranches` flag.

---

## 2. Branch Step

### UI

- Grid of branch cards: name, address, phone
- Single select — tap to select and auto-advance
- Back button returns to branch selection if user navigates back from service step

### Data

- New public API: `GET /branches/public` — no auth required
- Returns active branches only: `{ id, nameAr, nameEn, address, phone }`
- Widget fetches on mount; if result has `length <= 1`, branch step is skipped entirely (single branch auto-selected silently, or no branch sent if zero)

### State

```ts
branch: Branch | null  // added to WizardState
```

`branchId` passed in `confirmBooking` payload when present.

---

## 3. Confirm Step — Coupon / Gift Card

### UI (top of confirm step, above summary)

- Collapsed by default: link "هل لديك كود خصم أو بطاقة هدية؟"
- Expands to: text input + "تطبيق" button
- On success: shows green badge "خصم X ر.س مطبق" + X button to remove
- On error: inline red message "الكود غير صالح أو منتهي الصلاحية"

### API

`POST /coupons/validate` — requires patient JWT

Request:
```ts
{ code: string; serviceId: string; amount: number }
```

Response:
```ts
{ valid: boolean; discountAmount: number; type: "percentage" | "fixed"; couponId?: string; giftCardId?: string }
```

### Price Summary

```
السعر الأصلي:     X ر.س
الخصم:           -Y ر.س   (only if coupon applied)
ضريبة القيمة المضافة (15%): Z ر.س   (calculated on discounted amount)
الإجمالي:         W ر.س
```

`confirmBooking` payload includes `couponCode` or `giftCardCode` when applied.

---

## 4. Confirm Step — Payment Method

### Settings (clinic-level)

Two new boolean fields on clinic settings:
- `paymentMoyasarEnabled` (default: `false`)
- `paymentAtClinicEnabled` (default: `true`)

Widget fetches these alongside branding on mount.

### UI Rules

| Moyasar | At Clinic | UI |
|---------|-----------|-----|
| ✅ | ✅ | RadioGroup with two options |
| ✅ | ❌ | Auto-select Moyasar, no RadioGroup shown |
| ❌ | ✅ | Auto-select at clinic, no RadioGroup shown |
| ❌ | ❌ | No payment UI — booking created as `PENDING` |

RadioGroup options:
- **دفع إلكتروني** — Moyasar (credit/debit/Apple Pay)
- **الدفع في العيادة** — cash or POS

### Payment Flow

**At Clinic:**
1. `POST /bookings` with `payAtClinic: true` + optional `branchId`, `couponCode`/`giftCardCode`
2. → success screen directly

**Moyasar:**
1. `POST /bookings` → get `bookingId`
2. `POST /payments/moyasar` with `{ bookingId }` → get Moyasar `payment_url`
3. Redirect to Moyasar checkout (in same iframe/window)
4. Moyasar webhook updates booking status
5. On return URL → show success screen

**Both disabled (PENDING):**
1. `POST /bookings` with no payment flags → status `PENDING`
2. → success screen with note "سيتم التواصل معك لتأكيد الحجز"

---

## 5. Intake Form Popup

### Trigger

After booking is successfully created, the booking response includes:
```ts
intakeFormId: string | null
intakeFormAlreadySubmitted: boolean
```

Backend logic:
- `intakeFormId`: from `service.intakeFormId` (if exists)
- `intakeFormAlreadySubmitted`: check `IntakeFormResponse` table for `(patientId, formId)` pair

If `intakeFormId !== null && !intakeFormAlreadySubmitted` → show popup.

### UI

- Modal/sheet overlaid on top of the success screen (not replacing it)
- Header: "أكمل معلوماتك الطبية"
- Sub: "هذا النموذج يساعد الطبيب على الاستعداد لموعدك"
- Renders the intake form fields dynamically (existing field types)
- Submit button: "إرسال" → `POST /intake-forms/:formId/responses`
- On success: popup closes → success screen visible
- Dismiss (X button): shows inline warning "يُفضل تعبئة النموذج قبل موعدك" → closes after 2s

### Already Submitted

If `intakeFormAlreadySubmitted: true` → popup never mounts. Success screen shows directly.

---

## 6. Backend Changes

### 6.1 Prisma Schema — Clinic Settings

Add to whitelabel/clinic settings model:
```prisma
paymentMoyasarEnabled  Boolean @default(false)
paymentAtClinicEnabled Boolean @default(true)
```

New migration required.

### 6.2 `GET /branches/public`

```ts
@Get('public')
// No @UseGuards — public endpoint
async getPublicBranches(): Promise<PublicBranchDto[]>
```

Returns: `{ id, nameAr, nameEn, address, phone }[]` — active branches only.

### 6.3 `POST /coupons/validate`

```ts
@Post('validate')
@UseGuards(JwtAuthGuard)
async validateCoupon(@Body() dto: ValidateCouponDto, @CurrentUser('id') patientId: string)
```

Validates coupon or gift card code. Returns discount info or `{ valid: false }`.

### 6.4 Booking Response — Intake Info

Extend booking response (create + findOne) to include:
```ts
intakeFormId: string | null
intakeFormAlreadySubmitted: boolean
```

`bookings.service.ts`: after creating booking, check `service.intakeFormId` + query `IntakeFormResponse` for `(patientId, formId)`.

### 6.5 Widget Booking API — Coupon/Branch

Extend `CreateBookingDto` (already has `branchId`):
```ts
couponCode?: string
giftCardCode?: string
```

Bookings service applies discount before calculating final price.

---

## 7. Dashboard Widget — File Map

| File | Action | Change |
|------|--------|--------|
| `hooks/use-widget-booking.ts` | Modify | Add `branch` to state, `hasBranches` flag, coupon state, payment method state, intake popup state |
| `components/features/widget/booking-wizard.tsx` | Modify | Dynamic `STEP_ORDER` based on `hasBranches`; add `branch` step render |
| `components/features/widget/widget-steps-sidebar.tsx` | Modify | Accept dynamic steps array instead of hardcoded `STEPS` |
| `components/features/widget/widget-branch-step.tsx` | **New** | Branch grid selection UI |
| `components/features/widget/widget-confirm-step.tsx` | Modify | Add coupon section + payment RadioGroup |
| `components/features/widget/widget-intake-popup.tsx` | **New** | Intake form modal after booking success |
| `lib/api/widget.ts` | Modify | Add `fetchPublicBranches`, `validateCoupon`, update `widgetCreateBooking` payload |
| `hooks/use-widget-booking-queries.ts` | Modify | Add `branchesQuery` |

---

## 8. Dashboard Settings — File Map

| File | Action | Change |
|------|--------|--------|
| `components/features/settings/booking-tab.tsx` | Modify | Add "طرق الدفع" card with two toggle switches |
| `lib/api/clinic-settings.ts` | Modify | Add fetch/update for `paymentMoyasarEnabled` + `paymentAtClinicEnabled` |

---

## 9. Widget Branding API Extension

`GET /whitelabel/public` response extended with:
```ts
paymentMoyasarEnabled: boolean
paymentAtClinicEnabled: boolean
```

Widget fetches these on mount alongside clinic branding — no extra API call needed.

---

## 10. Out of Scope

- Recurring bookings payment (separate feature)
- Moyasar return URL handling for deep-link back to widget (handled by existing webhook)
- Multi-form intake (one service = one intake form only)
- Branch-level availability filtering (separate feature)
