# Booking Legacy Features — Design Spec

> **Date**: 2026-04-12
> **Status**: Draft
> **Scope**: Restore 5 legacy features into the new CQRS booking system

## Overview

The new booking system (CQRS, handler-per-use-case) dropped 5 operational features that existed in the old monolithic system. This spec defines how to reintroduce them within the new architecture without breaking its clean separation.

### Features

1. **Pay at Clinic** — tenant setting to allow deferred in-person payment
2. **Online Booking Type** — `ONLINE` added to `BookingType` enum for video consultations
3. **Coupon/Gift Card at Booking** — validate and preview discount before confirmation
4. **Zoom Integration** — auto-create meeting on booking confirmation
5. **Graduated Cancellation Workflow** — client requests → admin approves/rejects

---

## 1. Schema Changes

### Booking Model — New Fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `payAtClinic` | `Boolean` | `false` | Client chose to pay at clinic |
| `couponCode` | `String?` | `null` | Coupon code entered at booking time |
| `giftCardCode` | `String?` | `null` | Gift card code entered at booking time |
| `discountedPrice` | `Decimal?` | `null` | Price after discount (computed at creation) |
| `zoomMeetingId` | `String?` | `null` | Zoom meeting ID |
| `zoomJoinUrl` | `String?` | `null` | Zoom join link for client |
| `zoomHostUrl` | `String?` | `null` | Zoom host link for employee |

### BookingType Enum

```
INDIVIDUAL | WALK_IN | GROUP | ONLINE
```

`ONLINE` is a standalone type (not a modifier on other types).

### BookingStatus Enum

```
PENDING | CONFIRMED | CANCELLED | COMPLETED | NO_SHOW | EXPIRED | CANCEL_REQUESTED
```

`CANCEL_REQUESTED` is the intermediate state when graduated cancellation is enabled.

### ClinicSettings — New Fields

| Field | Type | Default | Purpose |
|---|---|---|---|
| `payAtClinicEnabled` | `Boolean` | `false` | Allow clients to defer payment to clinic visit |
| `requireCancelApproval` | `Boolean` | `false` | Client cancellations require admin approval |
| `autoRefundOnCancel` | `Boolean` | `true` | Auto-refund on approved cancellation (vs manual) |

These are easily extensible — future settings are just new fields + migration.

---

## 2. Handlers

### New Handlers (4)

#### `RequestCancelBookingHandler`
- **Path**: `request-cancel-booking/`
- **Input**: `{ tenantId, bookingId, reason, cancelNotes? }`
- **Guard**: Only when `requireCancelApproval === true` AND request source is client
- **Action**: `status → CANCEL_REQUESTED`, save reason/notes
- **Event**: `bookings.booking.cancel_requested`

#### `ApproveCancelBookingHandler`
- **Path**: `approve-cancel-booking/`
- **Input**: `{ tenantId, bookingId, approverNotes? }`
- **Guard**: Only `CANCEL_REQUESTED` bookings
- **Action**: `status → CANCELLED`, `cancelledAt = now()`
- **Refund**: If `autoRefundOnCancel === true` → trigger automatic refund. If `false` → mark for manual refund.
- **Event**: `bookings.booking.cancel_approved`

#### `RejectCancelBookingHandler`
- **Path**: `reject-cancel-booking/`
- **Input**: `{ tenantId, bookingId, rejectReason }`
- **Guard**: Only `CANCEL_REQUESTED` bookings
- **Action**: `status → CONFIRMED` (restores previous state), save rejection reason
- **Event**: `bookings.booking.cancel_rejected`

#### `CreateZoomMeetingHandler`
- **Path**: `create-zoom-meeting/`
- **Input**: `{ tenantId, bookingId }`
- **Guard**: `bookingType === ONLINE`, Zoom integration must be connected
- **Action**: Fetch Zoom credentials from `Integration` model, create meeting via Zoom API, update booking with `zoomMeetingId`, `zoomJoinUrl`, `zoomHostUrl`

### Modified Handlers (4)

#### `CreateBookingHandler`
- Accepts new fields: `couponCode`, `giftCardCode`, `payAtClinic`
- **payAtClinic**: Validates `payAtClinicEnabled === true` in ClinicSettings. If `false` → reject.
- **couponCode**: Validates coupon (active, not expired, min order amount, usage limits). Computes `discountedPrice`. Does NOT consume the coupon yet (booking is PENDING, may be cancelled).
- **giftCardCode**: Validates card (active, sufficient balance). Computes `discountedPrice`. Does NOT deduct balance yet.
- **bookingType ONLINE**: Validates Zoom integration is connected for this tenant. No Zoom meeting created yet.

#### `CancelBookingHandler`
- Checks `requireCancelApproval` from ClinicSettings.
- If `true` AND request source is client → rejects with message directing to `RequestCancelBooking`.
- If `false` OR request source is admin/employee → proceeds with direct cancellation (current behavior).
- If booking has `zoomMeetingId` → deletes Zoom meeting via API.

#### `ConfirmBookingHandler`
- After confirming, if `bookingType === ONLINE` → invokes `CreateZoomMeetingHandler`.
- If booking has `couponCode` → consumes the coupon (creates `CouponRedemption`).
- If booking has `giftCardCode` → deducts gift card balance (creates `GiftCardRedemption`).
- Passes `discountedPrice` to invoice creation.

#### `CheckAvailabilityHandler`
- If `bookingType === ONLINE` → skips room/location conflict checks (no physical space needed). Still checks employee time conflicts.

---

## 3. Settings (Backend + Dashboard)

### Backend

`UpdateBookingSettingsHandler` updates the three new ClinicSettings fields. Existing settings infrastructure handles the rest.

Each handler reads settings at execution time:
- `CreateBookingHandler` → checks `payAtClinicEnabled`
- `CancelBookingHandler` → checks `requireCancelApproval`
- `ApproveCancelBookingHandler` → checks `autoRefundOnCancel`

### Dashboard — Settings Pages

**Settings > Booking** (`settings/booking`):

| Setting | Control | Default | Description |
|---|---|---|---|
| السماح بالدفع بالعيادة | Switch | Off | يتيح للعميل اختيار الدفع عند الوصول |

**Settings > Cancellation** (`settings/cancellation`):

| Setting | Control | Default | Description |
|---|---|---|---|
| طلب موافقة للإلغاء | Switch | Off | إلغاء العميل يحتاج موافقة الأدمن |
| استرجاع تلقائي | Switch | On | عند الموافقة على الإلغاء يُسترجع المبلغ تلقائياً |

**Settings > Integrations** (`settings/integrations`):

- Zoom integration status indicator
- Warning: "مطلوب لتفعيل الحجز الأونلاين" when Zoom is not connected
- `bookingType: ONLINE` creation rejected if Zoom not connected

### Validation Rules

- `payAtClinic: true` + `payAtClinicEnabled: false` → **reject**
- `bookingType: ONLINE` + Zoom not connected → **reject** with clear message
- `requireCancelApproval` only restricts client-initiated cancellations — admin/employee can always cancel directly

---

## 4. Events

### New Events (3)

| Event | Source | Subscribers |
|---|---|---|
| `bookings.booking.cancel_requested` | `RequestCancelBookingHandler` | Notifications → alert admin of pending cancel request |
| `bookings.booking.cancel_approved` | `ApproveCancelBookingHandler` | Finance → refund (if auto) · Notifications → inform client |
| `bookings.booking.cancel_rejected` | `RejectCancelBookingHandler` | Notifications → inform client with rejection reason |

### Modified Events (2)

| Event | Changes |
|---|---|
| `bookings.booking.confirmed` | If `ONLINE` → triggers Zoom meeting creation · If `couponCode` → passes discount data to invoice |
| `bookings.booking.cancelled` | If `zoomMeetingId` exists → deletes Zoom meeting |

---

## 5. Flows

### Coupon at Booking

```
1. Create booking + couponCode
   → validate only (active? not expired? min amount?)
   → compute discountedPrice, save on booking
   → coupon NOT consumed yet (booking is PENDING)

2. Confirm booking → create invoice
   → invoice uses discountedPrice from booking
   → NOW consume coupon (CouponRedemption record)

3. Cancel before confirm
   → coupon was never consumed — nothing to reverse
```

### Zoom Integration

```
1. Create booking ONLINE → PENDING (no Zoom)

2. Confirm → BookingConfirmedEvent
   → check: bookingType === ONLINE?
   → yes → fetch Zoom credentials from Integration
   → create Zoom meeting via API
   → update booking: zoomMeetingId, zoomJoinUrl, zoomHostUrl
   → notify client + employee with links

3. Cancel → BookingCancelledEvent
   → if zoomMeetingId exists → delete meeting from Zoom
   → clear fields
```

### Graduated Cancellation

```
Client requests cancel
  → requireCancelApproval === false? → direct cancel (current behavior)
  → requireCancelApproval === true?  → CANCEL_REQUESTED
    → Admin approves → CANCELLED + refund per autoRefundOnCancel
    → Admin rejects  → CONFIRMED + rejection reason sent to client
```

### Pay at Clinic

```
1. payAtClinicEnabled === true in ClinicSettings

2. Client creates booking with payAtClinic: true → PENDING

3. Client arrives at clinic, pays

4. Receptionist confirms booking manually → CONFIRMED

5. Invoice created on confirmation
```

---

## 6. Notifications

### Notification Matrix

| Event | Client | Reception | Admin/Owner |
|---|---|---|---|
| `booking.created` | "تم استلام حجزك بانتظار التأكيد" | "حجز جديد بانتظار التأكيد" | — |
| `booking.confirmed` | "تم تأكيد حجزك" + details | "تم تأكيد الحجز" | — |
| `booking.confirmed` + ONLINE | ↑ + Zoom join link | ↑ + Zoom host link | — |
| `booking.completed` | "شكراً لزيارتك — نتطلع لخدمتك مجدداً" | — | — |
| `booking.cancelled` | "تم إلغاء حجزك" + reason | "تم إلغاء حجز" | — |
| `booking.cancel_requested` | "تم استلام طلب الإلغاء بانتظار الموافقة" | "طلب إلغاء جديد بانتظار موافقتك" | "طلب إلغاء معلّق" |
| `booking.cancel_approved` | "تمت الموافقة على إلغاء حجزك" + refund status | "تم إلغاء الحجز بعد الموافقة" | — |
| `booking.cancel_rejected` | "تم رفض طلب الإلغاء" + reason | "تم رفض طلب الإلغاء" | — |
| `booking.no_show` | "تم تسجيلك كغياب" | — | — |
| `booking.expired` | "انتهت صلاحية حجزك — يمكنك الحجز مجدداً" | — | — |
| `booking.created` + payAtClinic | "تم حجزك — الدفع عند الوصول" | "حجز جديد — الدفع بالعيادة" | — |
| `booking.created` + coupon applied | "تم حجزك — خصم [X] مطبّق" | — | — |

### Channels

| Recipient | Channel |
|---|---|
| Client | Push (FCM) + In-app |
| Reception | In-app + alert sound for pending requests |
| Admin/Owner | In-app (pending cancel requests only) |

### Notes

- Notifications use existing `EmailTemplate` system — each event maps to an editable template in dashboard
- If clinic has email enabled → same events also send email
- Reception pending cancel requests show as badge/counter in dashboard

---

## 7. Layer Summary

### Prisma Schema (1 migration)

- `BookingType` enum: add `ONLINE`
- `BookingStatus` enum: add `CANCEL_REQUESTED`
- `Booking` model: 7 new fields
- `ClinicSettings` model: 3 new fields

### Backend — Handlers

| New (4) | Modified (4) |
|---|---|
| `RequestCancelBookingHandler` | `CreateBookingHandler` |
| `ApproveCancelBookingHandler` | `CancelBookingHandler` |
| `RejectCancelBookingHandler` | `ConfirmBookingHandler` |
| `CreateZoomMeetingHandler` | `CheckAvailabilityHandler` |

Plus `UpdateBookingSettingsHandler` for settings.

### Backend — Events

| New (3) | Modified (2) |
|---|---|
| `booking.cancel_requested` | `booking.confirmed` |
| `booking.cancel_approved` | `booking.cancelled` |
| `booking.cancel_rejected` | |

### Dashboard

| Location | Change |
|---|---|
| `settings/booking` | Pay-at-clinic switch |
| `settings/cancellation` | Cancel approval + auto-refund switches |
| `settings/integrations` | Zoom connection status + warning |
| Bookings list | `CANCEL_REQUESTED` badge + approve/reject buttons |
| Booking details | Zoom links + pay-at-clinic status |

### Mobile

| Change |
|---|
| `ONLINE` option in booking creation |
| Coupon/gift card code input + discounted price preview |
| "Pay at clinic" option (when enabled) |
| Zoom join link in confirmed booking details |
| "Request cancel" button (when `requireCancelApproval` enabled) |

### Notifications

12 notification types across 3 channels (FCM, In-app, Email) as defined in section 6.
