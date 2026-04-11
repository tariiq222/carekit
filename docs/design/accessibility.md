# CareKit Accessibility Guidelines (WCAG AA)

All CareKit interfaces must meet WCAG 2.1 Level AA compliance minimum.

---

## 1. Color & Contrast

### 1.1 Minimum Contrast Ratios

| Element | Ratio | Standard |
|---------|-------|----------|
| Normal text (< 18px) | 4.5:1 | WCAG AA |
| Large text (>= 18px bold or >= 24px) | 3:1 | WCAG AA |
| UI components (borders, icons) | 3:1 | WCAG AA |
| Focus indicators | 3:1 | WCAG AA |

### 1.2 Color Independence

- Never convey information through color alone
- Status badges must include text label, not just color
- Form errors must have text message + icon, not just red border
- Charts must use patterns/shapes in addition to color

Example:
```
BAD:  <Badge color="green" />                    (color only)
GOOD: <Badge color="green" icon={Check}>Confirmed / مؤكد</Badge>  (color + icon + text)
```

### 1.3 Dark Mode Considerations (Dashboard)

- All text must meet contrast ratios in both light and dark mode
- Test status badge colors against dark backgrounds
- Ensure focus rings are visible on dark backgrounds
- Charts must be readable in dark mode

---

## 2. Keyboard Navigation

### 2.1 Focus Management

- All interactive elements must be focusable via Tab key
- Focus order must follow visual reading order (RTL-aware)
- Focus ring: `2px solid --color-border-focus` with `2px offset`
- Never remove focus outlines without providing alternative indicator
- Skip links: provide "Skip to content" link on dashboard pages

### 2.2 Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| Tab | Move to next focusable element | Global |
| Shift+Tab | Move to previous focusable element | Global |
| Enter | Activate button/link | Buttons, links |
| Space | Toggle checkbox, activate button | Checkboxes, buttons |
| Escape | Close modal/dropdown/popover | Overlays |
| Arrow keys | Navigate menu items, tabs, calendar | Menus, tabs, calendars |
| Home/End | Jump to first/last item | Lists, menus |

### 2.3 Focus Trapping

Modals and dialogs must trap focus within them:
- Tab cycles through focusable elements inside the modal
- Escape closes the modal
- Focus returns to the triggering element on close

---

## 3. Screen Reader Support

### 3.1 Semantic HTML (Dashboard)

```html
<!-- Use semantic elements -->
<nav>           <!-- Navigation areas -->
<main>          <!-- Main content -->
<article>       <!-- Self-contained content -->
<section>       <!-- Thematic grouping -->
<aside>         <!-- Sidebar content -->
<header>        <!-- Page/section header -->
<footer>        <!-- Page/section footer -->
<button>        <!-- Interactive actions (NEVER use div/span as button) -->
<a href="">     <!-- Navigation links -->
```

### 3.2 ARIA Labels

| Component | Required ARIA | Example (EN) | Example (AR) |
|-----------|--------------|--------------|--------------|
| Icon-only button | `aria-label` | `aria-label="Close"` | `aria-label="إغلاق"` |
| Navigation | `aria-label` | `aria-label="Main navigation"` | `aria-label="القائمة الرئيسية"` |
| Search input | `aria-label` | `aria-label="Search clients"` | `aria-label="بحث المرضى"` |
| Status badge | `aria-label` | `aria-label="Status: Confirmed"` | `aria-label="الحالة: مؤكد"` |
| Data table | `aria-label` | `aria-label="Appointments table"` | `aria-label="جدول المواعيد"` |
| Loading state | `aria-live="polite"` | `aria-label="Loading..."` | `aria-label="جاري التحميل..."` |
| Toast notification | `role="alert"` | Auto-announced | Auto-announced |
| Tab panel | `role="tabpanel"` | `aria-labelledby` | `aria-labelledby` |
| Dialog | `role="dialog"` | `aria-labelledby` + `aria-describedby` | Same |

### 3.3 React Native Accessibility (Mobile)

```typescript
// Every interactive element needs:
<TouchableOpacity
  accessible={true}
  accessibilityLabel={t('booking.confirm')}  // i18n-aware
  accessibilityRole="button"
  accessibilityState={{ disabled: isLoading }}
>

// Images need:
<Image
  accessibilityLabel={t('employee.photo', { name: doctor.name })}
/>

// Status indicators:
<View accessibilityLabel={t(`status.${booking.status}`)}>
  <StatusBadge status={booking.status} />
</View>
```

### 3.4 Live Regions

Use live regions for dynamic content updates:

```html
<!-- Toast notifications -->
<div role="alert" aria-live="assertive">
  Payment confirmed successfully / تم تأكيد الدفع بنجاح
</div>

<!-- Loading indicators -->
<div aria-live="polite" aria-busy="true">
  Loading appointments... / جاري تحميل المواعيد...
</div>

<!-- Form errors -->
<div role="alert" aria-live="polite">
  Please enter a valid email / الرجاء إدخال بريد إلكتروني صحيح
</div>
```

---

## 4. Form Accessibility

### 4.1 Label Association

Every form input must have a visible `<label>` associated via `htmlFor`/`id`:

```html
<label htmlFor="email">البريد الإلكتروني / Email</label>
<input id="email" type="email" aria-required="true" />
```

### 4.2 Error Messages

- Error messages must be programmatically associated with the input
- Use `aria-describedby` to link error to input
- Error messages must be announced by screen readers

```html
<input
  id="email"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<p id="email-error" role="alert">
  هذا الحقل مطلوب / This field is required
</p>
```

### 4.3 Required Fields

- Mark required fields with `aria-required="true"`
- Show visual asterisk (*) and include "required" in label for screen readers
- Never rely solely on placeholder text as a label

### 4.4 Form Instructions

- Place instructions before the form, not after
- Group related fields with `<fieldset>` and `<legend>`
- Provide clear submission feedback

---

## 5. Touch Targets (Mobile)

### 5.1 Minimum Sizes

| Element | Minimum Size | Recommended |
|---------|-------------|-------------|
| Buttons | 44x44 px | 48x48 px |
| Links in text | 44px height | 48px height |
| Checkboxes/Radio | 44x44 px | 48x48 px |
| List items (tappable) | 44px height | 56px height |
| Tab bar items | 44x44 px | 48px width |
| Close buttons | 44x44 px | 44x44 px |

### 5.2 Spacing Between Targets

- Minimum 8px gap between adjacent touch targets
- Avoid placing destructive actions next to frequently used actions
- Cancel/Delete should be visually distant from Confirm/Save

---

## 6. Motion & Animation

### 6.1 Reduced Motion

Respect `prefers-reduced-motion` media query:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6.2 Animation Guidelines

- No auto-playing animations that last more than 5 seconds
- Provide pause/stop controls for any continuous animation
- Avoid flashing content (max 3 flashes per second)
- Keep UI transition animations under 300ms

---

## 7. Content Accessibility

### 7.1 Language Attributes

```html
<!-- Set document language -->
<html lang="ar" dir="rtl">

<!-- Mark inline language switches -->
<p>اسم الطبيب: <span lang="en">Dr. Ahmed</span></p>
```

### 7.2 Headings Hierarchy

Every page must have a logical heading structure:

```
h1: Page title (one per page)
  h2: Section headings
    h3: Subsection headings
      h4: Card/item headings (if needed)
```

Never skip heading levels (no h1 then h3).

### 7.3 Link Text

```
BAD:  "Click here" / "اضغط هنا"
GOOD: "View appointment details" / "عرض تفاصيل الموعد"
```

### 7.4 Images & Media

- All informational images need `alt` text in current language
- Decorative images: `alt=""`  and `aria-hidden="true"`
- Complex images (charts, diagrams): provide text alternative nearby

---

## 8. Accessibility Testing Checklist

### Per Component

- [ ] Keyboard navigable (Tab, Enter, Space, Escape, Arrow keys)
- [ ] Focus indicator visible
- [ ] Screen reader announces correctly (role, name, state)
- [ ] Color contrast meets 4.5:1 (text) and 3:1 (UI)
- [ ] Works in both light and dark mode
- [ ] Works in both RTL and LTR
- [ ] Touch target >= 44x44px (mobile)
- [ ] No information conveyed by color alone
- [ ] Respects prefers-reduced-motion

### Per Page

- [ ] Has proper heading hierarchy (h1 > h2 > h3)
- [ ] Has page title in `<title>` / navigation header
- [ ] Skip link available (dashboard)
- [ ] All images have appropriate alt text
- [ ] All form inputs have labels
- [ ] Error messages are announced
- [ ] Loading states are announced
- [ ] Language attribute matches content

### Tools

- axe DevTools (Chrome extension) for dashboard
- Accessibility Inspector (Xcode) for iOS
- Accessibility Scanner (Android Studio) for Android
- VoiceOver (iOS/macOS) for screen reader testing
- TalkBack (Android) for screen reader testing
- NVDA / JAWS (Windows) for dashboard screen reader testing
