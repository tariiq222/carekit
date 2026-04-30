# Dashboard Overview — Visual Parity with `dashboard-v2.html` Prototype

**Date:** 2026-04-11
**Scope:** `apps/leaderboard` — overview page only (`/_dashboard/`)
**Reference prototype:** [docs/design-prototypes/dashboard-v2.html](../../design-prototypes/dashboard-v2.html)

## Problem

The live dashboard overview ([apps/leaderboard/src/routes/_dashboard/index.tsx](../../../apps/leaderboard/src/routes/_dashboard/index.tsx)) looks flat and empty compared to the `dashboard-v2.html` prototype. The gap is not a missing design system — the tokens, glass classes, `bg-scene`, `blob`, and `bg-mesh` all exist in [globals.css](../../../apps/leaderboard/src/globals.css). The gap is purely in **composition and visual density**.

### Root causes (from investigation)

1. **Background scene is mounted but invisible.** `__root.tsx` already renders `<div class="bg-scene">` with mesh + 3 blobs. But the Topbar uses `glass-solid` (opaque white) and the Sidebar is solid primary, leaving only the main content area to show the scene. The blobs have opacity `0.09–0.12` — too subtle against `#EEF1F8`. Result: page reads as flat white.
2. **Stat values use `text-[var(--fg)]`** (black) instead of the variant color. All 4 cards look identical and dead. No trend badges.
3. **No `greeting-banner`.** The current header is a plain `<h1>` + `<p>` in the corner. The prototype has a full-width banner with date + contextual pills.
4. **Only 3 stat cards visible** (payments flag off) → `xl:grid-cols-4` leaves an awkward empty slot.
5. **Timeline is visually spartan** even when data exists — no colored dots per status, no action buttons, no proper vertical rhythm.
6. **Quick Actions and Alerts are thin** — small icons, little hierarchy.

## Non-goals

- Adding new API endpoints (revenue, attendance rate, etc.)
- Touching sidebar or topbar styling
- Dark mode work
- Mobile-first redesign of the overview (keep current breakpoints)

## Data strategy: Hybrid (user-approved)

- **Real API** for: today's bookings count, pending bookings, patient counts, alerts, timeline items — these hooks exist (`useBookingStats`, `usePatientStats`, `useBookings`).
- **Mock / static** for: revenue figures, attendance %, trend deltas (±X%). These will be marked clearly in code with `// TODO(deqah): wire when revenue endpoint lands` and rendered with muted copy (e.g. "الهدف المتوقع" rather than fake historic deltas) so the UI doesn't lie to the user — it shows targets and structure, not fabricated numbers.
- **Explicit rule:** no fake patient names, no fake booking rows. If `useBookings` returns empty, show a richer empty state — not mock timeline items.

## Design — 3 operations

### Operation #1 — Background scene visibility fix

**Files:**
- [apps/leaderboard/src/globals.css](../../../apps/leaderboard/src/globals.css) (edit)

**Changes:**
- Bump blob opacity from `0.09–0.12` → `0.18–0.22` so they actually read against `#EEF1F8`.
- Strengthen `bg-mesh` radial gradients by ~40% (`0.13 → 0.18`, `0.10 → 0.14`).
- No structural changes — `__root.tsx` already mounts the scene.

**Acceptance:** Opening `/` shows visible blue/green/purple soft blobs drifting behind the content. The blobs must be perceptible but not distracting — a quick A/B by toggling the `.bg-scene` element must feel like a "different page."

**Out of scope:** fixing the Topbar opacity (leave `glass-solid` — that's intentional separation).

---

### Operation #2 — Greeting banner + Stats parity

**Files:**
- `apps/leaderboard/src/components/features/overview/greeting-banner.tsx` (new, ~80 lines)
- [apps/leaderboard/src/components/features/overview/overview-stats.tsx](../../../apps/leaderboard/src/components/features/overview/overview-stats.tsx) (edit)
- [apps/leaderboard/src/routes/_dashboard/index.tsx](../../../apps/leaderboard/src/routes/_dashboard/index.tsx) (edit — wire the banner in)

**greeting-banner.tsx:**
- Full-width glass card, `rounded-[var(--radius)]`, `p-6`
- Left side: greeting (`صباح الخير، {name}`) + Arabic-formatted today's date + bookings-today count subtitle
- Right side: 2 contextual pills — `حجوزات اليوم: N` and `حجوزات معلقة: N` (real data from `useBookingStats`)
- Greeting adapts to time of day (`صباح الخير` / `مساء الخير` / `مساء النور`) based on `new Date().getHours()`
- No revenue pill until endpoint exists. Keep it honest.
- Gracefully collapses on mobile (pills wrap below greeting)

**overview-stats.tsx refactor:**
- Keep the existing `StatCard` interface shape, but:
  - Add `trend?: { value: string; direction: 'up' | 'down' }` (optional — only shown when backend sends it; for now always undefined → badge hidden)
  - Change `StatCardView` so the **value color matches the variant** (`text-[var(--primary)]` etc.), not `text-[var(--fg)]`
  - Move icon + optional trend badge into a `stat-top` flex row
  - Bump value from `text-[28px]` → `text-[32px]`, keep `font-extrabold tracking-tight`
  - Sub-line stays in `text-[var(--muted)]`
- **Always render 4 cards.** Replace the feature-flag conditional logic so the grid is always `grid-cols-4` on xl:
  - Card 1 — "حجوزات اليوم" (primary) — real
  - Card 2 — "حجوزات معلقة" (warning) — real
  - Card 3 — "إجمالي المرضى" (success) — real if `patients` flag on, else "قريباً" placeholder styled the same way
  - Card 4 — "الإيراد (قريباً)" (accent) — placeholder card with `—` and muted sub "يُفعّل مع نظام المدفوعات" if payments flag off
- Feature-flag gating stays, but instead of hiding cards it switches them to a visually consistent "coming soon" variant so the grid never has holes. Visual balance is a permanent quality gate per user's persistent memory.

**index.tsx edit:** Insert `<GreetingBanner />` above `<OverviewStats />`, drop the plain `<header>`.

**Acceptance:**
- 4 stat cards render at all flag combinations (no empty grid slots)
- Each card's number is colored (blue / orange / green / lime-green)
- Greeting shows user's Arabic name and time-of-day variant
- Pills reflect real booking counts

---

### Operation #3 — Timeline + QuickActions + Alerts visual upgrade

**Files:**
- [apps/leaderboard/src/components/features/overview/overview-timeline.tsx](../../../apps/leaderboard/src/components/features/overview/overview-timeline.tsx) (edit)
- [apps/leaderboard/src/components/features/overview/quick-actions.tsx](../../../apps/leaderboard/src/components/features/overview/quick-actions.tsx) (edit)
- [apps/leaderboard/src/components/features/overview/overview-alerts.tsx](../../../apps/leaderboard/src/components/features/overview/overview-alerts.tsx) (edit)

**overview-timeline.tsx:**
- Replace current list with the prototype's `.tl-item` layout: `[time column] [dot + connector] [body]`
- Dot color maps to booking status: confirmed→success, inProgress→primary (with glow ring), pending→warning, cancelled→muted, completed→success
- Add a "now" time pill (primary bg) if the booking's `startTime` is within 15 min of `new Date()`
- Keep the header exactly as it is, but replace "عرض الكل" text-link with a small `btn btn-primary btn-sm` "+ حجز جديد" plus a muted "عرض الكل" text-link next to it
- Empty state: keep the existing one but soften it — reduce icon size to `text-2xl`, add muted subtitle "ستظهر حجوزات اليوم هنا فور إنشائها"
- Skeleton: 4 items with time/dot/body shimmer

**quick-actions.tsx:**
- Increase card vertical padding (`p-4` → `p-5`), add subtle hover lift (`hover:-translate-y-0.5 transition-transform`)
- Change label from `text-xs` → `text-[13px]`, add thin descriptive sub-line below (e.g., "إضافة حجز جديد للمريض") — muted, 11px
- Icon container: 48px → 44px but add tinted border using the variant color at 15% opacity
- Keep 2-column grid. Disabled cards stay 50% opacity with clear `cursor-not-allowed`.

**overview-alerts.tsx:**
- No structural change. Just tighten the icon container (round → square-rounded `rounded-[var(--radius-sm)]`) and bump title weight to `font-bold text-[13px]`.
- Empty state: keep but add a subtle success tint background on the icon (`bg-[var(--success-bg)] text-[var(--success)]`).

**Acceptance:** Inspect overview at `/_dashboard/` with real data (at least 1 booking today). Timeline reads as a proper schedule with colored status dots. Quick Actions look like deliberate buttons, not filler. Empty states feel intentional.

## What could go wrong

- **Blob opacity too strong → distracting.** Mitigation: if 0.22 feels loud, drop to 0.16. Judgment call made live.
- **Greeting banner clashes with page `<h1>`.** We're removing the plain `<h1>` — banner provides that role.
- **Stat card "coming soon" variants look patronizing.** Mitigation: use neutral copy ("قريباً" / "يُفعّل مع…") not cute copy. No emoji, no icons-of-shame.
- **Timeline skeleton/empty state mismatch.** Make sure both use the same overall height so the page doesn't jump when data arrives.
- **RTL ordering of pills in greeting banner.** All layout uses logical properties (`ps-`/`pe-`/`start`/`end`). Manually test with DevTools set to LTR + RTL.

## File-size & commit boundaries

Three separate commits, one per operation, conforming to the project's 10-file / 500-line / single-system rule:

| Commit | Files | Max lines touched |
|---|---|---|
| `fix(leaderboard): strengthen background scene visibility` | 1 (`globals.css`) | ~10 |
| `feat(leaderboard): overview greeting banner + balanced stats grid` | 3 | ~260 |
| `feat(leaderboard): overview timeline + quick actions + alerts polish` | 3 | ~250 |

All three commits are frontend-only, no backend changes, no migrations.

## Test plan

- **Manual:** Open `http://localhost:5101/` in RTL. Check at 375 / 768 / 1280 / 1920. Verify blob visibility, stat colors, greeting name, timeline layout.
- **Flag matrix:** Toggle `featureFlags.payments` and `featureFlags.patients` off/on — the stats grid must always render 4 cards without empty slots.
- **Empty state:** Temporarily point the bookings API to an empty day — timeline empty state must match the skeleton's height (no layout jump).
- **No new unit tests.** All changes are presentational composition. Existing `overview-stats` hook logic unchanged.

## Out of scope (explicit)

- Adding revenue / attendance API endpoints
- Command-K search bar (left in prototype topbar, not part of overview page)
- Sidebar redesign
- Any work on other pages (patients, bookings, etc.)
- Dark mode
