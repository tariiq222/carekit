# CareKit Design System — Frosted Glass

> **قانون التصميم** — يُقرأ قبل أي عمل على Dashboard.

## Visual Identity

CareKit uses an **iOS-inspired Frosted Glass** aesthetic:
- Semi-transparent surfaces with `backdrop-filter: blur(24px)`
- Animated gradient blobs in the background (primary blue + accent green)
- Soft shadows, not heavy drop-shadows
- 8px spacing grid, generous padding
- IBM Plex Sans Arabic font (RTL-first)

## Color Tokens

### Primary Palette
| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--primary` | `#354FD8` | `#9ADB40` | CTAs, active states, links |
| `--primary-light` | `#5B72E8` | `#B0EF60` | Hover states |
| `--primary-ultra-light` | `rgba(53,79,216,0.08)` | `rgba(154,219,64,0.10)` | Icon backgrounds, subtle fills |
| `--accent` | `#82CC17` | `#9ADB40` | Secondary actions, charts |

### Surfaces (Glassmorphism)
| Token | Light | Usage |
|-------|-------|-------|
| `--surface` | `rgba(255,255,255,0.72)` | Cards, panels — glass surface |
| `--surface-solid` | `#FFFFFF` | Inputs, dropdowns — solid surface |
| `--surface-muted` | `#F7F9FC` | Nested sections, table rows |
| `--card` | `rgba(255,255,255,0.72)` | Card component |
| `--sidebar` | `rgba(255,255,255,0.72)` | Sidebar background |
| `--background` | `#F2F4F8` | Page background |

### Borders
| Token | Light | Usage |
|-------|-------|-------|
| `--border` | `rgba(0,0,0,0.06)` | Default borders — subtle |
| `--border-strong` | `rgba(0,0,0,0.12)` | Emphasized borders |
| `--glass-border` | `rgba(0,0,0,0.06)` | Glass surface borders |

### Status Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#16A34A` | Confirmed, paid, active |
| `--warning` | `#D97706` | Pending, awaiting |
| `--error` | `#DC2626` | Cancelled, failed, alerts |
| `--info` | `#2563EB` | Informational, links |

## Glassmorphism Classes

```css
/* Standard glass surface — cards, sidebar, panels */
.glass {
    background: var(--glass-bg);           /* rgba(255,255,255,0.72) */
    backdrop-filter: blur(var(--glass-blur)); /* 24px */
    border: 1px solid var(--glass-border);
}

/* Solid glass — popover, dropdown — higher opacity */
.glass-solid {
    background: var(--glass-bg-solid);     /* rgba(255,255,255,0.88) */
    backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
}
```

### Usage in code:
```tsx
// Card already has glass built-in via bg-card + backdrop-blur
<Card className="card-lift" />

// Custom glass surface
<div className="glass rounded-lg p-4" />

// Solid glass for menus/popovers
<div className="glass-solid rounded-lg p-4" />
```

## Shadows

| Class | Value | Usage |
|-------|-------|-------|
| `shadow-sm` | `0 1px 3px rgba(16,24,40,0.04)` | Default card rest state |
| `shadow-md` | `0 8px 24px rgba(16,24,40,0.06)` | Card hover, dropdowns |
| `shadow-lg` | `0 20px 60px rgba(16,24,40,0.08)` | Modals only |
| `shadow-primary` | `0 4px 12px rgba(53,79,216,0.25)` | Primary CTA buttons |

## Border Radius

| Token | Size | Usage |
|-------|------|-------|
| `rounded-sm` | 8px | Chips, small pills |
| `rounded-md` | 12px | Inputs, buttons |
| `rounded-lg` | 16px | Cards |
| `rounded-xl` | 20px | Modals, large surfaces |

## Typography

- **Font**: IBM Plex Sans Arabic
- **H1**: `text-xl font-semibold` (page titles)
- **H2**: `text-base font-medium` (card titles)
- **Body**: `text-sm` (default text)
- **Caption**: `text-xs text-muted-foreground`
- **Numbers/Amounts**: always add `tabular-nums` class

## Spacing

8px grid system. Use Tailwind spacing:
- `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px), `gap-8` (32px)
- `p-4` (16px) for card padding
- `p-6` (24px) for section spacing

## Component Patterns

### Card (Glass)
```tsx
<Card className="card-lift">
  <CardHeader>
    <CardTitle>العنوان</CardTitle>
    <CardAction><Button variant="ghost">عرض الكل</Button></CardAction>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Stat Card
```tsx
<StatCard
  title="حجوزات اليوم"
  value={18}
  icon={CalendarIcon}
  iconColor="primary"
  trend={{ value: 12, direction: "up" }}
/>
```

### Page Structure
```tsx
<ListPageShell>
  <PageHeader title="..." subtitle="..." actions={...} />
  <StatsGrid>...</StatsGrid>
  <Card><DataTable ... /></Card>
</ListPageShell>
```

### States
- Loading: `<Skeleton />` or `<ListSkeleton />`
- Error: `<ErrorBanner />`
- Empty: `<EmptyState />`

## Hover Effects

- Cards: `translateY(-2px)` + `shadow-md` + `border-color: rgba(53,79,216,0.15)`
- Buttons: `translateY(-1px)` + `shadow-primary-hover`
- Use `.card-lift` class for automatic hover animation

## RTL Rules (MANDATORY)

- Use `start`/`end` (not `left`/`right`)
- Use `ps-`/`pe-`, `ms-`/`me-` (not `pl-`/`pr-`/`ml-`/`mr-`)
- Do NOT hardcode directions
- Sidebar is on the right side in RTL

## Background Blobs

Animated gradient blobs are applied globally via `body::before` and `body::after`.
They create the frosted glass depth effect. **Do not remove them.**

## Icon Library

- **Hugeicons** (`@hugeicons/react`) — primary icon library
- Usage: `<HugeiconsIcon icon={IconName} size={20} strokeWidth={2} />`
- Do NOT use Lucide, Font Awesome, or Material Icons

## STRICT RULES

1. Do NOT use hex colors directly — use semantic tokens only
2. Do NOT use solid white backgrounds on cards — they must be glass (semi-transparent)
3. Do NOT use heavy shadows — keep them subtle
4. Do NOT skip `backdrop-filter` on glass surfaces
5. Do NOT use `left`/`right` — use `start`/`end` for RTL
6. Do NOT create new design tokens without updating this file
7. Do NOT use raw HTML inputs — use shadcn components
8. Numbers and amounts MUST use `tabular-nums`
