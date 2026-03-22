# CareKit RTL-First Design Guidelines

Arabic is the primary language. All designs start in RTL and adapt to LTR for English.

---

## 1. Core RTL Rules

### 1.1 Layout Direction

| Element | RTL (Arabic) | LTR (English) |
|---------|-------------|----------------|
| Text alignment | Right-aligned | Left-aligned |
| Reading flow | Right to left | Left to right |
| Sidebar | Right side | Left side |
| Back button | `ChevronRight` (points right → goes back) | `ChevronLeft` (points left → goes back) |
| Progress bar fill | Fills from right | Fills from left |
| Breadcrumb | Home > Page (arrows reversed) | Home > Page |
| List item actions | Actions on left | Actions on right |
| Form labels | Right-aligned above input | Left-aligned above input |
| Tab navigation | Tabs flow from right | Tabs flow from left |
| Carousel/slider | Swipe right = next | Swipe left = next |

### 1.2 What Does NOT Mirror

These elements remain the same in both directions:

- **Playback controls** — Play, pause, forward, rewind keep their positions
- **Clocks and timestamps** — Numbers always read left-to-right
- **Phone numbers** — Always left-to-right
- **Media controls** — Volume slider, progress bars for media
- **Logos** — Never mirror the client logo
- **Charts** — X-axis direction stays the same (left-to-right for time)
- **Mathematical operators** — +, -, =, etc.
- **Code/technical text** — Always LTR
- **Currency amounts** — Number is LTR, currency label follows locale (ر.س 150 or SAR 150)

### 1.3 Icons That Must Mirror

| Icon | RTL | LTR | Reason |
|------|-----|-----|--------|
| `ChevronLeft` / `ChevronRight` | Swap | Normal | Directional navigation |
| `ArrowLeft` / `ArrowRight` | Swap | Normal | Directional navigation |
| `Undo` / `Redo` | Swap | Normal | Action direction |
| `ExternalLink` | Mirror | Normal | Arrow points opposite |
| `Reply` / `Forward` | Swap | Normal | Communication direction |
| `Indent` / `Outdent` | Swap | Normal | Text direction |

Icons that represent physical objects (scissors, phone, search) do NOT mirror.

---

## 2. Implementation Patterns

### 2.1 CSS / Tailwind

```css
/* Use logical properties instead of physical */

/* BAD */
.card { margin-left: 16px; padding-right: 12px; text-align: left; }

/* GOOD */
.card { margin-inline-start: 16px; padding-inline-end: 12px; text-align: start; }
```

Tailwind RTL classes (with `tailwindcss-rtl` or built-in support):
```html
<!-- Use ms-/me- instead of ml-/mr- -->
<div class="ms-4 me-2 text-start">Content</div>

<!-- Use ps-/pe- instead of pl-/pr- -->
<div class="ps-4 pe-2">Content</div>

<!-- RTL-specific overrides -->
<div class="rtl:flex-row-reverse">Content</div>
```

### 2.2 React Native (Expo)

```typescript
// Set app-wide direction
import { I18nManager } from 'react-native';

// On language change:
I18nManager.forceRTL(isArabic);
// Requires app restart on React Native

// Use start/end instead of left/right
const styles = StyleSheet.create({
  container: {
    paddingStart: 16,    // Not paddingLeft
    paddingEnd: 8,       // Not paddingRight
    alignItems: 'flex-start', // Adapts to direction
  },
  text: {
    textAlign: 'auto',   // Follows I18nManager direction
    writingDirection: 'auto',
  },
});
```

### 2.3 Next.js (Dashboard)

```html
<!-- Set dir on html element -->
<html lang="ar" dir="rtl">

<!-- Or dynamically -->
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

shadcn/ui components automatically respect `dir` attribute when using logical CSS properties.

---

## 3. Component-Level RTL Patterns

### 3.1 Navigation — Sidebar (Dashboard)

```
RTL Layout:
┌─────────────────────────────┬──────────┐
│         Main Content        │ Sidebar  │
│                             │          │
│                             │ القائمة  │
│                             │ الرئيسية │
│                             │          │
└─────────────────────────────┴──────────┘

LTR Layout:
┌──────────┬─────────────────────────────┐
│ Sidebar  │         Main Content        │
│          │                             │
│ Main     │                             │
│ Menu     │                             │
│          │                             │
└──────────┴─────────────────────────────┘
```

### 3.2 Navigation — Tab Bar (Mobile)

```
RTL Tab Order (right to left):
┌──────────────────────────────────────────┐
│  الملف   │  المحادثة  │  المواعيد  │ الرئيسية│
│ Profile  │   Chat    │  Bookings  │  Home  │
└──────────────────────────────────────────┘

LTR Tab Order (left to right):
┌──────────────────────────────────────────┐
│  Home   │  Bookings  │   Chat    │ Profile │
│ الرئيسية│  المواعيد  │  المحادثة  │  الملف  │
└──────────────────────────────────────────┘
```

### 3.3 List Items

```
RTL:
┌──────────────────────────────────────────┐
│  ←  │  د. أحمد محمد         │ صورة │
│ سهم │  طبيب أسنان           │ رمزية │
│     │  ⭐ 4.8 (120 تقييم)    │       │
└──────────────────────────────────────────┘

LTR:
┌──────────────────────────────────────────┐
│ Avatar │  Dr. Ahmed Mohammed    │  →  │
│        │  Dentist               │ Arrow│
│        │  ⭐ 4.8 (120 reviews)  │      │
└──────────────────────────────────────────┘
```

### 3.4 Form Layout

```
RTL:
┌──────────────────────────────────────────┐
│                              :البريد الإلكتروني │
│          ┌────────────────────────────┐  │
│          │              ahmed@email.com│  │
│          └────────────────────────────┘  │
│                   أدخل بريدك الإلكتروني │
└──────────────────────────────────────────┘

LTR:
┌──────────────────────────────────────────┐
│ Email:                                   │
│  ┌────────────────────────────┐          │
│  │ahmed@email.com              │          │
│  └────────────────────────────┘          │
│  Enter your email address                │
└──────────────────────────────────────────┘
```

### 3.5 Data Tables (Dashboard)

```
RTL:
┌───────────┬──────────┬─────────────┬──────────┐
│  الإجراءات │  الحالة   │  الطبيب      │ الموعد    │
├───────────┼──────────┼─────────────┼──────────┤
│ تعديل حذف │  مؤكد    │  د. أحمد    │ #1234    │
│ تعديل حذف │  قيد الانتظار│  د. سارة │ #1235    │
└───────────┴──────────┴─────────────┴──────────┘

LTR:
┌──────────┬─────────────┬──────────┬───────────┐
│ Booking  │  Doctor      │  Status  │  Actions  │
├──────────┼─────────────┼──────────┼───────────┤
│ #1234    │  Dr. Ahmed   │ Confirmed│ Edit Delete│
│ #1235    │  Dr. Sara    │ Pending  │ Edit Delete│
└──────────┴─────────────┴──────────┴───────────┘
```

---

## 4. Bidirectional Text (BiDi) Handling

### 4.1 Mixed Content

When Arabic and English text appear together, use Unicode BiDi marks:

```
// User name in a sentence
"مرحبا Dr. Ahmed"          → Correct: Arabic wraps English name
"Welcome د. أحمد"           → Correct: English wraps Arabic name
```

### 4.2 Numbers in Arabic Context

Numbers are always displayed LTR, even in Arabic:

```
"عدد المواعيد: 25"          → Number is LTR
"المبلغ: 150.00 ر.س"       → Amount and currency LTR
"التاريخ: 2026/03/22"      → Date is LTR
"الهاتف: +966 50 123 4567" → Phone number is LTR
```

### 4.3 Input Fields

- Email, phone, and number inputs: always `dir="ltr"` regardless of app language
- Name inputs: follow app language direction
- Search: follow app language, but preserve user input direction
- Textarea: `dir="auto"` to detect content direction

---

## 5. Testing Checklist

For every screen and component, verify:

- [ ] Text is aligned correctly in RTL
- [ ] Text is aligned correctly in LTR
- [ ] Icons that should mirror are mirrored (chevrons, arrows)
- [ ] Icons that should NOT mirror are unchanged (phone, search, etc.)
- [ ] Navigation flows in correct direction
- [ ] Forms read correctly in both directions
- [ ] Numbers and dates display correctly in Arabic context
- [ ] No text overflow or truncation in either language
- [ ] Padding/margins are symmetric and correct
- [ ] Scroll direction is correct
- [ ] Swipe gestures work in correct direction
- [ ] Modal/sheet animations slide from correct side
- [ ] Sidebar is on correct side
- [ ] Tab order is correct for keyboard navigation
- [ ] No hardcoded left/right in styles (use start/end)
