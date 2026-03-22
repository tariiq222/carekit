# CareKit Design System

## 1. Design Tokens

Design tokens are the atomic values that drive the visual language across all platforms. They are the single source of truth for the White Label system.

### 1.1 Color Palette

All colors are defined as CSS custom properties and mapped to Tailwind classes. White Label overrides replace these values per client.

#### Default Brand Colors

```
--color-primary:        #0066CC    /* Primary actions, links, active states */
--color-primary-hover:  #0052A3    /* Hover state for primary */
--color-primary-light:  #E6F0FA    /* Primary background tint */
--color-primary-dark:   #003D7A    /* Dark mode primary */

--color-secondary:      #00B894    /* Success states, confirmations */
--color-secondary-hover:#009B7D    /* Hover state for secondary */
--color-secondary-light:#E6F9F4    /* Secondary background tint */

--color-accent:         #FF6B35    /* Attention, badges, highlights */
```

#### Semantic Colors

```
--color-success:   #10B981    /* Confirmed, paid, completed */
--color-warning:   #F59E0B    /* Pending, needs attention */
--color-error:     #EF4444    /* Failed, cancelled, errors */
--color-info:      #3B82F6    /* Informational messages */
```

#### Neutral Colors

```
--color-text-primary:    #1A1A2E    /* Main text — light mode */
--color-text-secondary:  #6B7280    /* Secondary text */
--color-text-tertiary:   #9CA3AF    /* Placeholder, disabled */
--color-text-inverse:    #FFFFFF    /* Text on dark backgrounds */

--color-bg-primary:      #FFFFFF    /* Main background — light mode */
--color-bg-secondary:    #F9FAFB    /* Cards, sections */
--color-bg-tertiary:     #F3F4F6    /* Input backgrounds, hover */

--color-border:          #E5E7EB    /* Default borders */
--color-border-focus:    #0066CC    /* Focused input borders */
--color-divider:         #F3F4F6    /* Section dividers */
```

#### Dark Mode Colors

```
--color-dm-text-primary:    #F9FAFB
--color-dm-text-secondary:  #9CA3AF
--color-dm-bg-primary:      #111827
--color-dm-bg-secondary:    #1F2937
--color-dm-bg-tertiary:     #374151
--color-dm-border:          #374151
```

#### Status-specific Colors (Booking & Payment)

```
/* Booking Status */
--color-status-pending:              #F59E0B    /* Amber */
--color-status-confirmed:            #10B981    /* Green */
--color-status-completed:            #6366F1    /* Indigo */
--color-status-cancelled:            #EF4444    /* Red */
--color-status-pending-cancellation: #F97316    /* Orange */

/* Payment Status */
--color-payment-pending:  #F59E0B
--color-payment-paid:     #10B981
--color-payment-refunded: #8B5CF6
--color-payment-failed:   #EF4444

/* Transfer Verification */
--color-transfer-matched:        #10B981
--color-transfer-amount-differs: #F59E0B
--color-transfer-suspicious:     #EF4444
--color-transfer-old-date:       #F97316
--color-transfer-unreadable:     #6B7280
```

### 1.2 Typography

#### Font Families

```
--font-family-ar: 'IBM Plex Sans Arabic', 'Noto Sans Arabic', sans-serif
--font-family-en: 'Inter', 'IBM Plex Sans', sans-serif
--font-family-mono: 'IBM Plex Mono', monospace
```

White Label clients can override with their own font pair (one Arabic, one English).

#### Font Scale

| Token | Size (px) | Line Height | Weight | Usage |
|-------|----------|-------------|--------|-------|
| `--text-xs` | 12 | 16 | 400 | Captions, badges, metadata |
| `--text-sm` | 14 | 20 | 400 | Secondary text, helper text |
| `--text-base` | 16 | 24 | 400 | Body text, form inputs |
| `--text-lg` | 18 | 28 | 500 | Subheadings, card titles |
| `--text-xl` | 20 | 28 | 600 | Section headings |
| `--text-2xl` | 24 | 32 | 600 | Page headings |
| `--text-3xl` | 30 | 36 | 700 | Dashboard stats, hero text |
| `--text-4xl` | 36 | 40 | 700 | Mobile hero, splash |

#### Font Weight

```
--font-regular: 400
--font-medium:  500
--font-semibold: 600
--font-bold:    700
```

### 1.3 Spacing Scale

Based on 4px grid. All spacing uses multiples of 4px.

```
--space-0:   0px
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
--space-24:  96px
```

### 1.4 Border Radius

```
--radius-none: 0
--radius-sm:   4px     /* Badges, small chips */
--radius-md:   8px     /* Buttons, inputs, cards */
--radius-lg:   12px    /* Modals, dropdown menus */
--radius-xl:   16px    /* Mobile cards, bottom sheets */
--radius-2xl:  24px    /* Mobile floating buttons */
--radius-full: 9999px  /* Avatars, circular buttons */
```

### 1.5 Shadows

```
--shadow-sm:   0 1px 2px rgba(0,0,0,0.05)           /* Cards, buttons */
--shadow-md:   0 4px 6px -1px rgba(0,0,0,0.1)       /* Dropdowns, popovers */
--shadow-lg:   0 10px 15px -3px rgba(0,0,0,0.1)     /* Modals, sheets */
--shadow-xl:   0 20px 25px -5px rgba(0,0,0,0.1)     /* Overlays */
```

### 1.6 Z-Index Scale

```
--z-base:      0
--z-dropdown:  10
--z-sticky:    20
--z-overlay:   30
--z-modal:     40
--z-toast:     50
--z-tooltip:   60
```

### 1.7 Breakpoints (Dashboard)

```
--bp-sm:   640px    /* Small tablets */
--bp-md:   768px    /* Tablets */
--bp-lg:   1024px   /* Laptop */
--bp-xl:   1280px   /* Desktop */
--bp-2xl:  1536px   /* Large screens */
```

### 1.8 Animation Tokens

```
--duration-fast:    100ms
--duration-normal:  200ms
--duration-slow:    300ms
--easing-default:   cubic-bezier(0.4, 0, 0.2, 1)
--easing-in:        cubic-bezier(0.4, 0, 1, 1)
--easing-out:       cubic-bezier(0, 0, 0.2, 1)
```

---

## 2. Component Token Mapping

### 2.1 Buttons

| Variant | Background | Text | Border | Hover BG |
|---------|-----------|------|--------|----------|
| Primary | `--color-primary` | `--color-text-inverse` | none | `--color-primary-hover` |
| Secondary | transparent | `--color-primary` | `--color-primary` | `--color-primary-light` |
| Destructive | `--color-error` | `--color-text-inverse` | none | darker error |
| Ghost | transparent | `--color-text-primary` | none | `--color-bg-tertiary` |
| Link | transparent | `--color-primary` | none | underline |

Button sizes:
| Size | Height | Padding X | Font Size | Icon Size |
|------|--------|-----------|-----------|-----------|
| sm | 32px | 12px | 14px | 16px |
| md | 40px | 16px | 14px | 18px |
| lg | 48px | 24px | 16px | 20px |

### 2.2 Inputs

| State | Border | Background | Text |
|-------|--------|-----------|------|
| Default | `--color-border` | `--color-bg-primary` | `--color-text-primary` |
| Focus | `--color-border-focus` | `--color-bg-primary` | `--color-text-primary` |
| Error | `--color-error` | `--color-bg-primary` | `--color-text-primary` |
| Disabled | `--color-border` | `--color-bg-tertiary` | `--color-text-tertiary` |

Input height: 40px (mobile: 48px for touch targets)

### 2.3 Cards

```
Background: --color-bg-primary (dark mode: --color-dm-bg-secondary)
Border: --color-border
Border-radius: --radius-lg (mobile: --radius-xl)
Padding: --space-4 (mobile: --space-4)
Shadow: --shadow-sm
```

### 2.4 Status Badges

| Status | Background | Text |
|--------|-----------|------|
| pending | amber-100 | amber-800 |
| confirmed | green-100 | green-800 |
| completed | indigo-100 | indigo-800 |
| cancelled | red-100 | red-800 |
| pending_cancellation | orange-100 | orange-800 |
| paid | green-100 | green-800 |
| refunded | purple-100 | purple-800 |
| failed | red-100 | red-800 |

---

## 3. Iconography

- **Library:** Lucide React (dashboard), Lucide React Native (mobile)
- **Default size:** 20px
- **Stroke width:** 1.75
- **Color:** inherits from parent text color

### Icon Mapping (Key Actions)

| Action | Icon | Notes |
|--------|------|-------|
| Home | `Home` | |
| Appointments | `Calendar` | |
| Chat | `MessageCircle` | |
| Profile | `User` | |
| Settings | `Settings` | |
| Notifications | `Bell` | |
| Search | `Search` | |
| Back (LTR) | `ChevronLeft` | Mirrors in RTL |
| Back (RTL) | `ChevronRight` | Mirrors in LTR |
| Add | `Plus` | |
| Edit | `Pencil` | |
| Delete | `Trash2` | |
| Video call | `Video` | |
| Phone call | `Phone` | |
| Clinic visit | `Building2` | |
| Payment | `CreditCard` | |
| Invoice | `FileText` | |
| Star rating | `Star` | Filled/outlined |
| Close | `X` | |
| Menu | `Menu` | |
| Filter | `SlidersHorizontal` | |
| Sort | `ArrowUpDown` | |
| Download | `Download` | |
| Upload | `Upload` | |
| Clock | `Clock` | |
| Check | `Check` | |
| Warning | `AlertTriangle` | |
| Info | `Info` | |

---

## 4. White Label Token Override Structure

All design tokens are stored in `WhiteLabelConfig` table and loaded at app initialization.

```typescript
interface WhiteLabelTheme {
  logo: string;               // URL to logo image (MinIO)
  primaryColor: string;       // Hex color
  secondaryColor: string;     // Hex color
  accentColor: string;        // Hex color
  fontArabic: string;         // Google Font name or custom font URL
  fontEnglish: string;        // Google Font name or custom font URL
  appName: string;            // Displayed in header, splash screen
  borderRadius: 'rounded' | 'sharp' | 'pill';  // Global radius style
}
```

When the app loads, it fetches `/api/v1/whitelabel/theme` and applies the tokens as CSS custom properties (dashboard/website) or React Native style overrides (mobile).
