# Leadboard — CareKit Admin Dashboard Design Spec
**Date:** 2026-04-11  
**Status:** Approved  
**Replaces:** `dashboard/` (dashboard-v2 prototype + existing Next.js dashboard)

---

## Context

CareKit is a white-label SaaS clinic management system. The current dashboard exists only as an HTML prototype (`dashboard-v2.html`) with a partially built Next.js app. Leadboard is a greenfield admin dashboard built for:

1. **Clinic Admins & Receptionists** — daily operations (bookings, patients, payments, etc.)
2. **Super Admin (future phase)** — platform-level management of clinic licenses and white-label configs

The dashboard must support white-label visual identity per clinic, feature flags that fully enable/disable backend capabilities, and a file architecture that enables future code sharing with an Expo mobile app.

---

## Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 6 |
| Framework | React 19 |
| Routing | TanStack Router v1 (file-based, fully type-safe) |
| Server state | TanStack Query v5 |
| Client state | Zustand |
| Styling | Tailwind 4 + CSS custom properties |
| Components | shadcn/ui (headless, never modified) |
| Forms | React Hook Form + Zod |
| HTTP | fetch wrapper (Axios-compatible interface) |
| Font | IBM Plex Sans Arabic (RTL-first) |
| Icons | HugeIcons (stroke-rounded) |
| i18n | AR (default) + EN via shared i18n tokens |

**Why Vite SPA over Next.js:** Admin dashboard has no SEO requirement, no need for SSR. Vite SPA is simpler DX, faster builds, and easier code sharing with Expo (no server/client component boundary). Static deployment to CDN.

---

## Monorepo Placement

```
CareKit/
├── apps/
│   ├── leaderboard/              ← this project
│   └── (mobile — Expo, future)
├── packages/
│   ├── shared/                 ← existing: types, enums, i18n tokens
│   └── api-client/             ← new: Axios client shared with Expo
├── backend/
└── dashboard/                  ← keep until leaderboard is stable, then delete
```

The `packages/api-client/` package extracts all HTTP logic so it can be consumed by both leaderboard and Expo without duplication.

> **Note:** Uses a fetch-based wrapper (not Axios) to ensure React Native compatibility. Axios works in RN but is not native — fetch is universal.

---

## White-label System

Every clinic has a visual identity config loaded from the backend at login:

```ts
interface BrandingConfig {
  clinicName: string
  logo: string           // MinIO URL
  favicon: string        // MinIO URL
  primaryColor: string   // hex
  accentColor: string    // hex
  fontFamily: string     // Google Fonts family name or 'default'
  borderRadius: 'compact' | 'default' | 'relaxed'
  direction: 'rtl' | 'ltr'
  locale: 'ar' | 'en'
}
```

> **Edge case — direction/locale mismatch:** `direction` controls layout only (RTL/LTR). `locale` controls date formatting and translations. They are independent. An Arabic-speaking clinic with `direction: ltr` is valid — Sidebar, DataTable, and all layout components must respect `direction` via `dir` attribute on `<html>`, not infer it from `locale`.

Applied immediately on login via `lib/whitelabel/apply.ts`:
- Sets CSS custom properties on `document.documentElement`
- Updates `<title>` to clinic name
- Swaps `<link rel="icon">` to clinic favicon
- Custom font loaded lazily with `font-display: swap` — IBM Plex Sans Arabic preloaded as default to prevent FOUT

All color usage in components must use CSS custom properties (`--primary`, `--accent`, `--surface`, etc.) — never hardcoded hex values.

---

## Feature Flag System

Feature flags are per-clinic boolean values returned by the backend at login. They represent the contractual agreement between CareKit and the clinic. A flag being `false` means the feature **does not exist** in the system for that clinic — not just hidden.

### Enforcement levels (all must be active when flag is false):
1. **Sidebar** — item not rendered at all
2. **Route** — redirect to `/` if accessed directly
3. **Component** — any button, link, stat card, or widget referencing the feature is not rendered
4. **API** — backend enforces independently (defense in depth)

### Feature flag map:

```ts
interface FeatureFlags {
  // Core — always true
  bookings: boolean
  patients: boolean
  practitioners: boolean
  services: boolean
  branches: boolean
  reports: boolean
  users: boolean
  organizationSettings: boolean
  activityLog: boolean

  // Extended
  groupSessions: boolean
  payments: boolean
  invoices: boolean
  coupons: boolean
  giftCards: boolean
  zatca: boolean
  intakeForms: boolean
  chatbot: boolean
  whitelabel: boolean
  ratings: boolean
  notifications: boolean
  integrations: boolean
  emailTemplates: boolean
  departments: boolean
}
```

Guard implementation: `lib/guards/feature-guard.tsx` — a `<FeatureGuard flag="payments">` wrapper component that returns `null` when flag is false. Used at route level and component level.

---

## Auth Flow

```
Login form
  → POST /auth/login
  → Response: { accessToken, refreshToken, user, clinic, featureFlags, brandingConfig }
  → Zustand store hydrated
  → BrandingConfig applied to DOM
  → Redirect to /dashboard
```

**Zustand store (`stores/auth.ts`):**
```ts
{
  user: User | null
  clinic: Clinic | null
  featureFlags: FeatureFlags
  brandingConfig: BrandingConfig | null
  accessToken: string | null
}
```

**HTTP interceptor:** Attaches Bearer token to every request. On 401, attempts silent refresh via `/auth/refresh`. On refresh failure, clears store and redirects to `/login`.

> **Race condition guard:** Refresh uses a mutex (single in-flight promise). If multiple requests fail with 401 simultaneously, only one refresh call is made — others queue and retry with the new token. Implemented in `packages/api-client/src/refresh-mutex.ts`.

---

## Information Architecture — Sidebar

Sidebar sections are driven by feature flags. Items not enabled are not rendered.

```
─── الرئيسية ───
  Dashboard

─── العمليات ───
  الحجوزات              [bookings]
  المرضى                [patients]
  الممارسون             [practitioners]
  الجلسات الجماعية      [groupSessions]
  الأقسام               [departments]

─── المالية ───
  المدفوعات             [payments]
  الفواتير              [invoices]
  كوبونات الخصم         [coupons]
  بطاقات الهدايا        [giftCards]
  ZATCA                 [zatca]

─── المحتوى ───
  الخدمات               [services]
  الفروع                [branches]
  نماذج الاستقبال       [intakeForms]
  الشاتبوت              [chatbot]

─── التقارير ───
  التقارير والإحصاء     [reports]

─── الإعدادات ───
  المستخدمون والأدوار   [users]
  إعدادات العيادة       [organizationSettings]
  الهوية البصرية        [whitelabel]
  التكاملات             [integrations]
  قوالب البريد          [emailTemplates]
  التقييمات             [ratings]
  الإشعارات             [notifications]
  سجل النشاط            [activityLog]
```

Sidebar supports collapsed mode (icons only) with tooltip labels.

---

## Page Anatomy (Law — no exceptions)

Every list page follows this exact structure:

```
Breadcrumbs
PageHeader: Title + Description | [Export outline] [+ Add primary]
StatsGrid: 4× StatCard
FilterBar (glass): [Search] [Filters] [Reset]
DataTable (no Card wrapper)
Pagination (only if totalPages > 1)
Dialogs/Sheets (at bottom)
```

**Add/Edit pages:** Always separate routes — never dialogs/popups. This is a hard rule.

**Table actions:** Icon-only buttons (size-9, rounded-sm) + Tooltip.

**Dates:** `toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })`

**Status badges:** `bg-success/10 text-success border-success/30` (active) / `bg-muted text-muted-foreground` (inactive)

**Skeleton loading:** 4× `h-[100px]` for StatsGrid, 5× `h-12` for table rows.

---

## Dashboard Overview Page

Stats row (driven by feature flags — only show enabled ones):
- حجوزات اليوم
- إيرادات الشهر `[payments]`
- مرضى جدد هذا الأسبوع
- حجوزات معلقة

Quick actions: حجز جديد، إضافة مريض

Charts `[reports]`:
- حجوزات الأسبوع (bar chart)
- إيرادات الشهر (line chart)

Recent activity feed `[activityLog]`

---

## File Structure

```
apps/leaderboard/
├── src/
│   ├── routes/
│   │   ├── __root.tsx           # root layout
│   │   ├── _auth/
│   │   │   ├── login.tsx
│   │   │   └── forgot-password.tsx
│   │   └── _dashboard/
│   │       ├── route.tsx        # dashboard shell (sidebar + topbar)
│   │       ├── index.tsx        # overview
│   │       ├── bookings/
│   │       │   ├── index.tsx    # list
   │       │   ├── new.tsx      # create
│   │       │   └── $id.tsx     # edit/detail
│   │       └── ... (one folder per feature)
│   ├── components/
│   │   ├── ui/                  # shadcn — never modify
│   │   ├── features/            # per-domain components
│   │   │   ├── bookings/
│   │   │   └── ...
│   │   └── shared/              # used across 3+ features
│   │       ├── page-header.tsx
│   │       ├── stats-grid.tsx
│   │       ├── data-table.tsx
│   │       ├── filter-bar.tsx
│   │       └── sidebar/
│   ├── hooks/                   # TanStack Query hooks (use-[feature].ts)
│   ├── lib/
│   │   ├── api/                 # Axios calls per domain
│   │   ├── stores/              # Zustand stores
│   │   ├── guards/              # FeatureGuard, AuthGuard
│   │   ├── whitelabel/          # CSS vars applicator
│   │   ├── schemas/             # Zod schemas
│   │   └── types/               # TypeScript types
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── package.json

packages/api-client/
├── src/
│   ├── client.ts                # Axios instance + interceptors
│   ├── modules/                 # one file per backend module
│   └── types/                   # request/response types
└── package.json
```

---

## Design Tokens

```css
:root {
  --primary: [from whitelabel];
  --accent: [from whitelabel];
  --bg: #EEF1F8;
  --surface: rgba(255,255,255,0.75);
  --surface-solid: #FFFFFF;
  --glass-border: rgba(255,255,255,0.55);
  --fg: #1B2026;
  --fg-2: #3D4754;
  --muted: #667085;
  --success: #16A34A;
  --warning: #D97706;
  --error: #DC2626;
  --sidebar-w: 252px;
  --sidebar-w-collapsed: 68px;
  --topbar-h: 60px;
  --radius: 14px;
  --radius-sm: 9px;
  --radius-lg: 18px;
}
```

Animated background: radial gradient mesh + 3 drifting blobs (same as dashboard-v2).

---

## File Size Limits (inherited from project rules)

| Type | Max lines |
|------|-----------|
| Route page | 150 |
| Feature component | 300 |
| Hook | 200 |
| API function | 200 |
| Type file | 250 |
| Zod schema | 150 |
| Any file (absolute) | 350 |

---

## Out of Scope (Phase 1)

- Super Admin panel (future phase — needs backend work first)
- Self-service license upgrade flow
- Mobile app (Expo) — packages/api-client lays the foundation
- Dark mode
- Push notifications UI
