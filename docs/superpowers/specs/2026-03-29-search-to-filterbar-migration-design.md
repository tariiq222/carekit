# Search → FilterBar Migration Design

**Date:** 2026-03-29
**Status:** Approved
**Goal:** Move search input from `PageHeader` (and custom `.glass` divs) to `FilterBar` across all list pages, matching the Services page pattern.

---

## Problem

Search input placement is inconsistent across dashboard list pages:

- **Patients / Practitioners**: search already in `FilterBar` ✓
- **Invoices / Payments**: search in `PageHeader`, selects in `FilterBar` — split
- **Gift Cards / Coupons / Branches**: search in `PageHeader`, selects in custom `div.glass` — no `FilterBar` at all
- **Users / Bookings / Intake Forms**: search in `PageHeader`, no `FilterBar`

Visual result: search floats above the page, disconnected from filters (see Payments screenshot).

---

## Target Pattern (Services Reference)

```tsx
// PageHeader — title, description, export, add only
<PageHeader title={...} description={...}>
  <Button variant="outline">تصدير</Button>
  <Button>+ إضافة</Button>
</PageHeader>

// FilterBar — search + all selects unified
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: "..." }}
  selects={[...]}
  hasFilters={hasFilters}
  onReset={resetFilters}
  resultCount={...}
/>
```

**Rules:**
- `PageHeader` never receives a `search` prop after this migration
- All filter selects move from `div.glass` / standalone `<Select>` → `FilterBar`
- `hasFilters` must include `search.length > 0` in its logic

---

## Pages & Required Changes

### Agent 1 — Patients, Practitioners, Users

#### Patients (`components/features/patients/patient-list-page.tsx`)
- **Status**: Search already in FilterBar — `hasFilters` logic needs to include `search.length > 0`
- **Change**: Verify `hasFilters` includes search. Likely already correct, confirm only.

#### Practitioners (`components/features/practitioners/practitioners-list-content.tsx`)
- **Status**: Search already in FilterBar — same as Patients
- **Change**: Verify `hasFilters` includes search.

#### Users (`components/features/users/user-list-page.tsx`)
- **Status**: Search in `PageHeader` via `search` prop, no `FilterBar`
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - Add `<FilterBar>` below `StatsGrid` in the users tab only (wrap with `{isUsersTab && ...}`)
  - Pass `search={{ value: search, onChange: setSearch, placeholder: ... }}`
  - `hasFilters={search.length > 0}`, `onReset={() => setSearch("")}`

---

### Agent 2 — Invoices, Payments, Bookings

#### Invoices (`components/features/invoices/invoice-list-page.tsx`)
- **Status**: Search in `PageHeader`, ZATCA select in `FilterBar`
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - Add `search` prop to existing `<FilterBar>`

#### Payments (`components/features/payments/payment-list-page.tsx`)
- **Status**: Search in `PageHeader`, status+method selects in `FilterBar`
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - Add `search` prop to existing `<FilterBar>`

#### Bookings (`app/(dashboard)/bookings/page.tsx`)
- **Status**: Search in `PageHeader`, no `FilterBar` — tabs handled by `BookingsTabContent`
- **Investigation needed**: Confirm if `BookingsTabContent` already has a `FilterBar` for its own filters. If yes, pass `search` down. If no, add `FilterBar` at the top level (above tabs).
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - If `BookingsTabContent` has FilterBar: pass `search` + `setSearch` as props
  - If not: add `<FilterBar search={...} hasFilters={search.length > 0} onReset={() => setSearch("")} />` between PageHeader and Tabs

---

### Agent 3 — Gift Cards, Coupons, Branches, Intake Forms

#### Gift Cards (`components/features/gift-cards/gift-card-list-page.tsx`)
- **Status**: Search in `PageHeader`, status in `div.glass` with raw `<Select>`
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - Remove `div.glass` with `<Select>` entirely
  - Add `<FilterBar>` with:
    - `search={{ value: search, onChange: setSearch, placeholder: ... }}`
    - `selects={[{ key: "status", value: status ?? "all", options: [...], onValueChange: ... }]}`
    - `hasFilters={search.length > 0 || !!status}`, `onReset={() => { setSearch(""); setStatus(undefined); setPage(1) }}`
  - Add `import { FilterBar } from "@/components/features/filter-bar"`

#### Coupons (`components/features/coupons/coupon-list-page.tsx`)
- **Status**: Same as Gift Cards
- **Change**: Same as Gift Cards (status options: active/inactive/expired)

#### Branches (`components/features/branches/branch-list-page.tsx`)
- **Status**: Same as Gift Cards
- **Change**: Same as Gift Cards (status: active/inactive via `isActive` boolean)

#### Intake Forms (`app/(dashboard)/intake-forms/page.tsx`)
- **Status**: Search in `PageHeader`, client-side filtering, no `FilterBar`
- **Change**:
  - Remove `search` prop from `<PageHeader>`
  - Add `<FilterBar search={...} hasFilters={search.length > 0} onReset={() => setSearch("")} />` between PageHeader and content
  - Keep existing client-side `filteredForms` logic — only move UI, not filtering logic
  - Add `import { FilterBar } from "@/components/features/filter-bar"`

---

## PageHeader `search` Prop

After this migration, `PageHeader` should no longer receive a `search` prop on any list page.

> **Note for Lead**: Check if `PageHeader` component has a `search` prop defined. If it's used only in these pages, it can be removed after migration. Flag if other pages use it.

---

## Agent Team Split

| Agent | Files | Key work |
|-------|-------|----------|
| **Agent 1** | patients, practitioners, users | Verify existing + add FilterBar to users |
| **Agent 2** | invoices, payments, bookings | Move search from PageHeader to FilterBar |
| **Agent 3** | gift-cards, coupons, branches, intake-forms | Replace div.glass + add FilterBar |

**Lead responsibilities:**
- Assign files, review each delivery
- After all agents done: check if `PageHeader` `search` prop can be removed
- Run `npm run typecheck` in dashboard after all changes

---

## Acceptance Criteria

- [ ] All list pages: search input is inside `FilterBar`, not `PageHeader`
- [ ] All list pages: filter selects are inside `FilterBar` (no standalone `div.glass` selects)
- [ ] Reset button appears when any filter or search is active
- [ ] `resultCount` shows total where previously shown
- [ ] `npm run typecheck` passes with zero errors
- [ ] No `any` types introduced
