# CareKit Shared Component Specifications

Component specs shared across mobile and dashboard. Each component includes RTL behavior and bilingual examples.

---

## 1. Status Badge

Used across all platforms to display booking, payment, and verification statuses.

### Variants

| Status | Label (AR) | Label (EN) | BG Color | Text Color | Icon |
|--------|-----------|-----------|----------|-----------|------|
| pending | قيد الانتظار | Pending | amber-100 | amber-800 | Clock |
| confirmed | مؤكد | Confirmed | green-100 | green-800 | Check |
| completed | مكتمل | Completed | indigo-100 | indigo-800 | CheckCircle |
| cancelled | ملغي | Cancelled | red-100 | red-800 | XCircle |
| pending_cancellation | طلب إلغاء | Cancellation Requested | orange-100 | orange-800 | AlertCircle |
| paid | مدفوع | Paid | green-100 | green-800 | Check |
| refunded | مسترد | Refunded | purple-100 | purple-800 | RotateCcw |
| failed | فشل | Failed | red-100 | red-800 | XCircle |

### Spec

```
Height: 24px (mobile: 28px)
Padding: 4px 8px (mobile: 4px 12px)
Border-radius: --radius-full
Font: --text-xs, --font-medium
Icon: 12px, inline-start of text
```

### Accessibility

- `aria-label="Status: Confirmed"` / `aria-label="الحالة: مؤكد"`
- Icon is decorative (`aria-hidden="true"`) — text carries the meaning
- Sufficient color contrast on both light and dark backgrounds

---

## 2. Appointment Card

Used in: Home screen (mobile), Today's schedule (doctor), Dashboard home.

### Layout (Mobile — RTL)

```
┌──────────────────────────────────────┐
│  [Status Badge]                      │
│                                      │
│  [Type Icon]  اسم الطبيب / Client    │
│               التخصص / Service        │
│               التاريخ • الوقت         │
│                                      │
│  (optional: action button)           │
└──────────────────────────────────────┘
```

### Props

```typescript
interface AppointmentCardProps {
  id: string;
  clientName: string;        // or employeeName (context-dependent)
  serviceName: string;         // localized
  specialtyName: string;       // localized
  date: string;                // formatted to locale
  startTime: string;
  endTime: string;
  type: 'clinic_visit' | 'phone_consultation' | 'video_consultation';
  status: BookingStatus;
  zoomJoinUrl?: string;        // for video
  clientPhone?: string;       // for phone (doctor view)
  onPress?: () => void;
}
```

### Type Icons

| Type | Icon | Label (AR) | Label (EN) |
|------|------|-----------|-----------|
| clinic_visit | Building2 | زيارة عيادة | Clinic Visit |
| phone_consultation | Phone | استشارة هاتفية | Phone Consultation |
| video_consultation | Video | استشارة مرئية | Video Consultation |

### RTL Behavior
- Icon on inline-end (right in RTL)
- Text aligned to inline-start (right in RTL)
- Action buttons at inline-end

---

## 3. Employee Card

Used in: Employee List (mobile), Home featured employees.

### Layout (RTL)

```
┌──────────────────────────────────────┐
│  [Chevron] اسم الطبيب      [Avatar]  │
│           التخصص                     │
│           ⭐ 4.8 (120 تقييم)         │
│           🏥 150  📞 100  📹 200 ر.س │
└──────────────────────────────────────┘
```

### Props

```typescript
interface EmployeeCardProps {
  id: string;
  name: string;
  avatarUrl?: string;
  specialtyName: string;      // localized
  rating: number;
  reviewCount: number;
  priceClinic: number;        // in halalat
  pricePhone: number;         // in halalat
  priceVideo: number;         // in halalat
  onPress?: () => void;
}
```

### Price Display
- Convert from halalat to SAR: `amount / 100`
- Format: `150.00 ر.س` (AR) / `SAR 150.00` (EN)
- Show all three prices with type icons

### RTL Behavior
- Avatar on inline-end (right in RTL)
- Navigation chevron on inline-start (left in RTL, pointing left)
- Prices flow inline (same direction in both)

---

## 4. Specialty Card

Used in: Home screen carousel, Specialty List.

### Layout

```
┌──────────┐
│  [Icon]  │
│  اسم     │
│ (count)  │
└──────────┘
```

### Props

```typescript
interface SpecialtyCardProps {
  id: string;
  nameAr: string;
  nameEn: string;
  iconUrl?: string;
  employeeCount: number;
  onPress?: () => void;
}
```

### Sizing
- Carousel: 80x100 px (mobile)
- Grid: flexible width, min 140px

---

## 5. Service Card

Used in: Service List, Home services preview.

### Layout

```
┌──────────────────────────────────────┐
│  اسم الخدمة / Service Name           │
│  30 دقيقة  •  150 ر.س               │
│  وصف قصير... (optional)              │
└──────────────────────────────────────┘
```

### Props

```typescript
interface ServiceCardProps {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  duration: number;           // minutes
  price: number;              // halalat
  categoryName: string;       // localized
  onPress?: () => void;
}
```

### Duration Display
- `30 دقيقة` (AR) / `30 min` (EN)

---

## 6. Notification Item

Used in: Notification list (mobile + dashboard).

### Layout (RTL)

```
┌──────────────────────────────────────┐
│  [Icon]  عنوان الإشعار               │
│          وصف قصير...                 │
│          منذ 5 دقائق            [●]  │
└──────────────────────────────────────┘
```

### Props

```typescript
interface NotificationItemProps {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;  // for navigation
  onPress?: () => void;
}
```

### Type-to-Icon Mapping

| Type | Icon | Color |
|------|------|-------|
| booking_confirmed | CalendarCheck | green |
| booking_cancelled | CalendarX | red |
| reminder | Clock | blue |
| payment_received | CreditCard | green |
| new_rating | Star | amber |
| problem_report | AlertTriangle | red |

### Read/Unread State
- Unread: accent dot on inline-end, slightly highlighted background
- Read: no dot, standard background

---

## 7. Rating Component

Used in: Appointment detail (after completion), Employee profile, Rating screen.

### Input Mode (Client submits rating)

```
┌──────────────────────────────────────┐
│  قيّم تجربتك / Rate your experience  │
│                                      │
│      ☆  ☆  ☆  ☆  ☆                  │
│                                      │
│  تعليق (اختياري)                     │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  ☐ أريد الإبلاغ عن مشكلة            │
│                                      │
│  [إرسال التقييم / Submit]            │
└──────────────────────────────────────┘
```

### Display Mode (Showing existing rating)

```
⭐⭐⭐⭐☆  4.0
```

### Props

```typescript
// Input mode
interface RatingInputProps {
  onSubmit: (data: { stars: number; comment?: string; reportProblem?: boolean }) => void;
  isLoading: boolean;
}

// Display mode
interface RatingDisplayProps {
  rating: number;        // 1-5
  reviewCount?: number;
  size?: 'sm' | 'md' | 'lg';
}
```

### Stars
- Tappable in input mode
- Half-star display supported (e.g., 4.5)
- Color: amber-500 (filled), grey-300 (empty)

---

## 8. Chat Bubble

Used in: AI Chat screen (mobile).

### Layout

```
Bot message (RTL — right side):
┌──────────────────────────────────────┐
│                                      │
│  ┌──────────────────────┐            │
│  │ 🤖 رسالة من المساعد  │            │
│  │    الذكي...           │            │
│  │              12:30 م  │            │
│  └──────────────────────┘            │
│                                      │
│            ┌──────────────────────┐  │
│            │ رسالة المستخدم      │  │
│            │              12:31 م│  │
│            └──────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### Styling

| Element | Bot | User |
|---------|-----|------|
| Background | `--color-bg-secondary` | `--color-primary` |
| Text color | `--color-text-primary` | `--color-text-inverse` |
| Border-radius | `--radius-lg` with inline-start flat | `--radius-lg` with inline-end flat |
| Max width | 80% of container | 80% of container |
| Alignment | inline-start | inline-end |

### Special Content in Bot Messages

Bot messages can contain:
1. **Plain text** — standard message
2. **Action cards** — embedded booking/appointment cards with CTAs
3. **Typing indicator** — animated dots while AI responds
4. **Handoff prompt** — "Would you like to talk to a human?" with buttons

---

## 9. Time Slot Picker

Used in: Booking flow (date/time selection).

### Layout

```
Available time slots grid:
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│09:00 │ │09:30 │ │10:00 │ │10:30 │
└──────┘ └──────┘ └──────┘ └──────┘
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│11:00 │ │11:30 │ │14:00 │ │14:30 │
└──────┘ └──────┘ └──────┘ └──────┘
```

### States

| State | Background | Border | Text |
|-------|-----------|--------|------|
| Available | `--color-bg-primary` | `--color-border` | `--color-text-primary` |
| Selected | `--color-primary` | `--color-primary` | `--color-text-inverse` |
| Unavailable | `--color-bg-tertiary` | none | `--color-text-tertiary` + strikethrough |

### Props

```typescript
interface TimeSlotPickerProps {
  slots: Array<{
    time: string;      // "09:00"
    available: boolean;
  }>;
  selectedTime: string | null;
  onSelect: (time: string) => void;
}
```

### Sizing
- Each slot: min 72px width, 40px height (mobile: 48px height)
- Grid: 3-4 columns depending on screen width
- Gap: 8px

---

## 10. Payment Method Card

Used in: Payment screen (mobile).

### Layout

```
┌──────────────────────────────────────┐
│  [Logo]   اسم الطريقة / Method Name  │
│           وصف قصير                   │
└──────────────────────────────────────┘
```

### Variants

| Method | Logo | Label (AR) | Label (EN) |
|--------|------|-----------|-----------|
| mada | Mada logo | مدى | Mada |
| apple_pay | Apple Pay logo | Apple Pay | Apple Pay |
| credit_card | Visa/MC logo | بطاقة ائتمانية | Credit Card |
| bank_transfer | Bank icon | تحويل بنكي | Bank Transfer |

### States
- Default: standard card
- Selected: primary border + primary light background
- Disabled: muted colors, not tappable

---

## 11. Empty State

Used across all list screens when no data exists.

### Layout

```
┌──────────────────────────────────────┐
│                                      │
│         [Illustration]               │
│                                      │
│    لا توجد مواعيد حالياً              │
│    No appointments yet                │
│                                      │
│    يمكنك حجز موعدك الأول الآن         │
│                                      │
│    [حجز موعد / Book Appointment]     │
│                                      │
└──────────────────────────────────────┘
```

### Variants by Context

| Context | Title (AR) | Title (EN) | CTA |
|---------|-----------|-----------|-----|
| Appointments | لا توجد مواعيد | No appointments | Book Appointment |
| Notifications | لا توجد إشعارات | No notifications | - |
| Clients (doctor) | لا يوجد مرضى | No clients yet | - |
| Chat | ابدأ محادثة | Start a conversation | Send a message |
| Search | لا توجد نتائج | No results found | Try different search |

---

## 12. Confirmation Dialog

Used for destructive or significant actions.

### Layout

```
┌──────────────────────────────────────┐
│                                      │
│  هل أنت متأكد؟                       │
│  Are you sure?                        │
│                                      │
│  سيتم إلغاء الموعد ولا يمكن          │
│  التراجع عن هذا الإجراء               │
│                                      │
│  [إلغاء / Cancel]  [تأكيد / Confirm] │
│                                      │
└──────────────────────────────────────┘
```

### Variants

| Type | Confirm Button | Color |
|------|---------------|-------|
| Destructive (delete, cancel) | Destructive variant (red) | `--color-error` |
| Important (approve, process) | Primary variant | `--color-primary` |

### Behavior
- Overlay backdrop (click outside to close)
- Focus trapped within dialog
- Escape to close
- Primary action on inline-end (right in LTR, left in RTL)

---

## 13. Progress Steps

Used in: Booking flow (4 steps).

### Layout

```
Step 1        Step 2        Step 3        Step 4
  ●─────────────●─────────────○─────────────○
النوع        الموعد         التأكيد       الدفع
Type        Schedule       Confirm       Payment
```

### States
- Completed: primary color fill
- Current: primary color with pulse animation
- Upcoming: grey outline

### RTL
- Steps flow right-to-left
- Progress bar fills from right

---

## 14. Price Display Component

Standardized price formatting across all platforms.

### Rules

1. **Storage:** All prices in halalat (integer)
2. **Display:** Converted to SAR with 2 decimal places
3. **Format (AR):** `150.00 ر.س`
4. **Format (EN):** `SAR 150.00`
5. **With VAT:** Show subtotal, VAT (15%), total separately
6. **Free:** `مجاناً` (AR) / `Free` (EN)

### Props

```typescript
interface PriceDisplayProps {
  amount: number;          // in halalat
  showVat?: boolean;       // show VAT breakdown
  vatRate?: number;        // default 0.15 (15%)
  size?: 'sm' | 'md' | 'lg';
  strikethrough?: boolean; // for discounts
}
```

### VAT Breakdown

```
المبلغ / Amount:       150.00 ر.س
الضريبة (15%) / VAT:    22.50 ر.س
─────────────────────────────────
الإجمالي / Total:      172.50 ر.س
```
