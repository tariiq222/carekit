# Search → FilterBar Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move search input from `PageHeader` (and custom `.glass` divs) into `FilterBar` across all dashboard list pages, matching the Services page pattern.

**Architecture:** Each page gets a unified `FilterBar` holding both search + selects. `PageHeader` keeps only title, description, export, and add buttons. The `FilterBar` component already supports a `search` prop — no new components needed.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, shadcn/ui, `FilterBar` at `components/features/filter-bar.tsx`

---

## Agent Team Split

| Agent | Task(s) | Files owned |
|-------|---------|-------------|
| **Agent 1** | Tasks 1–2 | clients, employees, users |
| **Agent 2** | Tasks 3–5 | invoices, payments, bookings/page.tsx |
| **Agent 3** | Tasks 6–9 | gift-cards, coupons, branches, intake-forms |
| **Lead** | Task 10 | review + typecheck |

---

## Task 1: Clients — fix `hasFilters` to include search

**Files:**
- Modify: `dashboard/components/features/clients/client-list-page.tsx:53`

**Context:** Clients already has `FilterBar` with `search` prop (line 156). But `hasFilters` on line 53 is `isActive !== undefined` — it does NOT include `search.length > 0`. This means the Reset button won't show when only a search term is active.

- [ ] **Step 1: Fix `hasFilters` on line 53**

Change:
```tsx
const hasFilters = isActive !== undefined
```
To:
```tsx
const hasFilters = isActive !== undefined || search.length > 0
```

- [ ] **Step 2: Fix `onReset` to also clear isActive**

The current `onReset` on line 158:
```tsx
onReset={() => { resetSearch() }}
```
`resetSearch` only clears search. It should also clear `isActive`. Change to:
```tsx
onReset={() => { resetSearch(); setIsActive(undefined) }}
```

- [ ] **Step 3: Verify no `search` prop on `<PageHeader>` (line 84–110)**

Confirm `<PageHeader>` on line 84 has no `search` prop — it already doesn't. No change needed.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/clients/client-list-page.tsx
git commit -m "fix(clients): include search in hasFilters + fix onReset"
```

---

## Task 2: Users — add `FilterBar` with search, remove from `PageHeader`

**Files:**
- Modify: `dashboard/components/features/users/user-list-page.tsx`

**Context:** Users page has search in `PageHeader` via `search` prop (line 66). No `FilterBar` exists. The search is conditional: only shown when `isUsersTab`. The `FilterBar` should also be conditional — only in the users tab.

- [ ] **Step 1: Add `FilterBar` import**

Add to imports (after `import { DataTable }` line):
```tsx
import { FilterBar } from "@/components/features/filter-bar"
```

- [ ] **Step 2: Remove `search` prop from `<PageHeader>`**

Change lines 63–80 from:
```tsx
<PageHeader
  title={t("users.title")}
  description={t("users.description")}
  search={isUsersTab ? { value: search, onChange: setSearch, placeholder: t("users.searchPlaceholder") } : undefined}
>
```
To:
```tsx
<PageHeader
  title={t("users.title")}
  description={t("users.description")}
>
```

- [ ] **Step 3: Add `FilterBar` inside the users `TabsContent`**

In `<TabsContent value="users">` (line 89), add `FilterBar` after `{error && <ErrorBanner ...>}` and before the skeleton/table block:

```tsx
<TabsContent value="users" className="mt-6 flex flex-col gap-6">
  {isLoading && !meta ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
    </div>
  ) : (
    <StatsGrid>
      <StatCard title={t("users.stats.total")} value={meta?.total ?? 0} icon={UserMultiple02Icon} iconColor="primary" />
      <StatCard title={t("users.stats.active")} value={users.filter((u) => u.isActive).length} icon={UserCheck01Icon} iconColor="success" />
      <StatCard title={t("users.stats.roles")} value={roles?.length ?? 0} icon={ShieldKeyIcon} iconColor="accent" />
      <StatCard title={t("users.stats.verified")} value={users.filter((u) => u.emailVerified).length} icon={UserCheck01Icon} iconColor="success" />
    </StatsGrid>
  )}

  {error && <ErrorBanner message={error} />}

  <FilterBar
    search={{ value: search, onChange: setSearch, placeholder: t("users.searchPlaceholder") }}
    hasFilters={search.length > 0}
    onReset={() => setSearch("")}
    resultCount={meta && !isLoading ? `${meta.total} ${t("users.stats.total")}` : undefined}
  />

  {isLoading && users.length === 0 ? (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
    </div>
  ) : (
    <DataTable columns={columns} data={users} emptyTitle={t("users.empty.title")} emptyDescription={t("users.empty.description")} emptyAction={{ label: t("users.addUser"), onClick: () => router.push("/users/create") }} />
  )}
</TabsContent>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/users/user-list-page.tsx
git commit -m "feat(users): move search from PageHeader to FilterBar"
```

---

## Task 3: Invoices — move search from `PageHeader` to `FilterBar`

**Files:**
- Modify: `dashboard/components/features/invoices/invoice-list-page.tsx`

**Context:** `PageHeader` on line 50–54 has `search` prop. `FilterBar` on line 70–74 exists but has no `search`. Simple: remove from header, add to FilterBar.

- [ ] **Step 1: Remove `search` prop from `<PageHeader>`**

Change lines 50–54 from:
```tsx
<PageHeader
  title={t("invoices.title")}
  description={t("invoices.description")}
  search={{ value: search, onChange: setSearch, placeholder: t("invoices.searchPlaceholder") }}
/>
```
To:
```tsx
<PageHeader
  title={t("invoices.title")}
  description={t("invoices.description")}
/>
```

- [ ] **Step 2: Add `search` prop to `<FilterBar>` (line 70–74)**

Change from:
```tsx
<FilterBar
  selects={[{ key: "zatcaStatus", value: zatcaStatus, placeholder: t("invoices.filters.zatcaStatus"), options: [{ value: "all", label: t("invoices.filters.allStatuses") }, { value: "pending", label: t("invoices.filters.pending") }, { value: "submitted", label: t("invoices.filters.submitted") }, { value: "accepted", label: t("invoices.filters.accepted") }, { value: "rejected", label: t("invoices.filters.rejected") }], onValueChange: (v) => setZatcaStatus(v as typeof zatcaStatus) }]}
  hasFilters={hasFilters}
  onReset={resetFilters}
/>
```
To:
```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("invoices.searchPlaceholder") }}
  selects={[{ key: "zatcaStatus", value: zatcaStatus, placeholder: t("invoices.filters.zatcaStatus"), options: [{ value: "all", label: t("invoices.filters.allStatuses") }, { value: "pending", label: t("invoices.filters.pending") }, { value: "submitted", label: t("invoices.filters.submitted") }, { value: "accepted", label: t("invoices.filters.accepted") }, { value: "rejected", label: t("invoices.filters.rejected") }], onValueChange: (v) => setZatcaStatus(v as typeof zatcaStatus) }]}
  hasFilters={hasFilters}
  onReset={resetFilters}
/>
```

- [ ] **Step 3: Verify `hasFilters` in `useInvoices` includes search**

Check `dashboard/hooks/use-invoices.ts` — find `hasFilters` definition. If it only checks `zatcaStatus`, update it to also include `search.length > 0`. If it already includes search, no change needed.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/invoices/invoice-list-page.tsx
git commit -m "feat(invoices): move search from PageHeader to FilterBar"
```

---

## Task 4: Payments — move search from `PageHeader` to `FilterBar`

**Files:**
- Modify: `dashboard/components/features/payments/payment-list-page.tsx`

**Context:** `PageHeader` on line 39–43 has `search` prop. `FilterBar` on line 58–65 has selects but no search.

- [ ] **Step 1: Remove `search` prop from `<PageHeader>`**

Change lines 39–43 from:
```tsx
<PageHeader
  title={t("payments.title")}
  description={t("payments.description")}
  search={{ value: search, onChange: setSearch, placeholder: t("payments.searchPlaceholder") ?? "بحث باسم المريض، رقم الفاتورة..." }}
/>
```
To:
```tsx
<PageHeader
  title={t("payments.title")}
  description={t("payments.description")}
/>
```

- [ ] **Step 2: Add `search` prop to `<FilterBar>` (line 58)**

Change from:
```tsx
<FilterBar
  selects={[
    { key: "status", value: status, placeholder: t("payments.filters.status"), options: [{ value: "all", label: t("payments.filters.allStatuses") }, { value: "pending", label: t("payments.filters.pending") }, { value: "paid", label: t("payments.filters.paid") }, { value: "refunded", label: t("payments.filters.refunded") }, { value: "failed", label: t("payments.filters.failed") }], onValueChange: (v) => setStatus(v as typeof status) },
    { key: "method", value: method, placeholder: t("payments.filters.method"), options: [{ value: "all", label: t("payments.filters.allMethods") }, { value: "moyasar", label: "Moyasar" }, { value: "bank_transfer", label: t("payments.filters.bankTransfer") }], onValueChange: (v) => setMethod(v as typeof method) },
  ]}
  hasFilters={hasFilters}
  onReset={resetFilters}
/>
```
To:
```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("payments.searchPlaceholder") ?? "بحث باسم المريض، رقم الفاتورة..." }}
  selects={[
    { key: "status", value: status, placeholder: t("payments.filters.status"), options: [{ value: "all", label: t("payments.filters.allStatuses") }, { value: "pending", label: t("payments.filters.pending") }, { value: "paid", label: t("payments.filters.paid") }, { value: "refunded", label: t("payments.filters.refunded") }, { value: "failed", label: t("payments.filters.failed") }], onValueChange: (v) => setStatus(v as typeof status) },
    { key: "method", value: method, placeholder: t("payments.filters.method"), options: [{ value: "all", label: t("payments.filters.allMethods") }, { value: "moyasar", label: "Moyasar" }, { value: "bank_transfer", label: t("payments.filters.bankTransfer") }], onValueChange: (v) => setMethod(v as typeof method) },
  ]}
  hasFilters={hasFilters}
  onReset={resetFilters}
/>
```

- [ ] **Step 3: Verify `hasFilters` in `usePayments` includes search**

Check `dashboard/hooks/use-payments.ts` — find `hasFilters`. If it doesn't include `search.length > 0`, add it.

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/payments/payment-list-page.tsx
git commit -m "feat(payments): move search from PageHeader to FilterBar"
```

---

## Task 5: Bookings — move search from `PageHeader` to `BookingsTabContent` FilterBar

**Files:**
- Modify: `dashboard/app/(dashboard)/bookings/page.tsx`
- Modify: `dashboard/components/features/bookings/bookings-tab-content.tsx`

**Context:** `bookings/page.tsx` has `search` state + passes it via `PageHeader` (line 69–73). `BookingsTabContent` already has its own `FilterBar` (line 106–172) with tabs/selects/dateRange but no search. The search must move from the page's PageHeader into BookingsTabContent's FilterBar.

- [ ] **Step 1: Remove search state + PageHeader search from `bookings/page.tsx`**

In `bookings/page.tsx`:
- Remove line 43: `const [search, setSearch] = useState("")`
- Remove the `search` import from React's useState if it's now unused (keep useState for other state)
- Remove lines 68–73 from `<PageHeader>`:
```tsx
search={{
  value: search,
  onChange: setSearch,
  placeholder: t("bookings.searchPlaceholder") ?? "بحث بالاسم، رقم الحجز...",
}}
```

The PageHeader becomes:
```tsx
<PageHeader
  title={t("bookings.title")}
  description={t("bookings.description")}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => setCreateOpen(true)}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("bookings.newBooking")}
  </Button>
</PageHeader>
```

- [ ] **Step 2: Add `search` to `BookingsTabContent` internally**

In `bookings-tab-content.tsx`, add local search state (line 33, after existing useState declarations):
```tsx
const [searchValue, setSearchValue] = useState("")
```

Pass it to FilterBar's `search` prop (add to FilterBar on line 106):
```tsx
<FilterBar
  search={{ value: searchValue, onChange: setSearchValue, placeholder: t("bookings.searchPlaceholder") ?? "بحث بالاسم، رقم الحجز..." }}
  tabs={{ ... }}  // keep existing tabs unchanged
  selects={[ ... ]}  // keep existing selects unchanged
  dateRange={{ ... }}  // keep existing dateRange unchanged
  hasFilters={hasFilters || searchValue.length > 0}
  onReset={() => { resetFilters(); setActiveTimeTab("all"); setSearchValue("") }}
/>
```

- [ ] **Step 3: Pass `searchValue` to `useBookings` filter**

Check `dashboard/hooks/use-bookings.ts` to see if `useBookings` accepts a `search` filter. If it does, pass `searchValue` via `setFilters({ search: searchValue })` on change. If the hook doesn't support search yet, the search prop on FilterBar is still correct UI — it will filter via the hook's existing pattern once connected.

> **Note:** If `useBookings` doesn't have a `search` filter parameter, add `search: searchValue` to the `setFilters` call pattern. Check the hook's `filters` type definition in `hooks/use-bookings.ts` before editing.

- [ ] **Step 4: Commit**

```bash
git add dashboard/app/(dashboard)/bookings/page.tsx dashboard/components/features/bookings/bookings-tab-content.tsx
git commit -m "feat(bookings): move search from PageHeader into BookingsTabContent FilterBar"
```

---

## Task 6: Gift Cards — replace `div.glass` + PageHeader search with `FilterBar`

**Files:**
- Modify: `dashboard/components/features/gift-cards/gift-card-list-page.tsx`

**Context:** Has `search` in PageHeader (line 48) and a `div.glass` with raw `<Select>` for status (lines 69–82). Both must be replaced by a single `FilterBar`. The `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` imports can be removed after.

- [ ] **Step 1: Add `FilterBar` import, remove Select imports**

Change:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```
To:
```tsx
import { FilterBar } from "@/components/features/filter-bar"
```

- [ ] **Step 2: Remove `search` prop from `<PageHeader>` (line 45–54)**

Change:
```tsx
<PageHeader
  title={t("giftCards.title")}
  description={t("giftCards.description")}
  search={{ value: search, onChange: setSearch, placeholder: t("giftCards.searchPlaceholder") }}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/gift-cards/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("giftCards.addCard")}
  </Button>
</PageHeader>
```
To:
```tsx
<PageHeader
  title={t("giftCards.title")}
  description={t("giftCards.description")}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/gift-cards/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("giftCards.addCard")}
  </Button>
</PageHeader>
```

- [ ] **Step 3: Replace `div.glass` block (lines 69–82) with `FilterBar`**

Remove:
```tsx
<div className="glass flex flex-wrap items-center gap-3 rounded-lg p-4">
  <Select value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder={t("giftCards.filters.allStatuses")} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t("giftCards.filters.allStatuses")}</SelectItem>
      <SelectItem value="active">{t("giftCards.status.active")}</SelectItem>
      <SelectItem value="inactive">{t("giftCards.status.inactive")}</SelectItem>
      <SelectItem value="expired">{t("giftCards.status.expired")}</SelectItem>
      <SelectItem value="depleted">{t("giftCards.status.depleted")}</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Add in its place:
```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("giftCards.searchPlaceholder") }}
  selects={[
    {
      key: "status",
      value: status ?? "all",
      placeholder: t("giftCards.filters.allStatuses"),
      options: [
        { value: "all", label: t("giftCards.filters.allStatuses") },
        { value: "active", label: t("giftCards.status.active") },
        { value: "inactive", label: t("giftCards.status.inactive") },
        { value: "expired", label: t("giftCards.status.expired") },
        { value: "depleted", label: t("giftCards.status.depleted") },
      ],
      onValueChange: (v) => { setStatus(v === "all" ? undefined : v); setPage(1) },
    },
  ]}
  hasFilters={search.length > 0 || !!status}
  onReset={() => { setSearch(""); setStatus(undefined); setPage(1) }}
  resultCount={meta && !isLoading ? `${meta.total} ${t("giftCards.stats.total")}` : undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/gift-cards/gift-card-list-page.tsx
git commit -m "feat(gift-cards): replace div.glass Select with FilterBar"
```

---

## Task 7: Coupons — replace `div.glass` + PageHeader search with `FilterBar`

**Files:**
- Modify: `dashboard/components/features/coupons/coupon-list-page.tsx`

**Context:** Same pattern as Gift Cards. `search` in PageHeader (line 45), `div.glass` with `<Select>` for status (lines 66–78).

- [ ] **Step 1: Add `FilterBar` import, remove Select imports**

Change:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```
To:
```tsx
import { FilterBar } from "@/components/features/filter-bar"
```

- [ ] **Step 2: Remove `search` prop from `<PageHeader>` (line 42–51)**

Change:
```tsx
<PageHeader
  title={t("coupons.title")}
  description={t("coupons.description")}
  search={{ value: search, onChange: setSearch, placeholder: t("coupons.searchPlaceholder") }}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/coupons/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("coupons.addCoupon")}
  </Button>
</PageHeader>
```
To:
```tsx
<PageHeader
  title={t("coupons.title")}
  description={t("coupons.description")}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/coupons/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("coupons.addCoupon")}
  </Button>
</PageHeader>
```

- [ ] **Step 3: Replace `div.glass` block (lines 66–78) with `FilterBar`**

Remove:
```tsx
<div className="glass flex flex-wrap items-center gap-3 rounded-lg p-4">
  <Select value={status ?? "all"} onValueChange={(v) => setStatus(v === "all" ? undefined : v)}>
    <SelectTrigger className="w-48">
      <SelectValue placeholder={t("coupons.filters.allStatuses")} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t("coupons.filters.allStatuses")}</SelectItem>
      <SelectItem value="active">{t("coupons.status.active")}</SelectItem>
      <SelectItem value="inactive">{t("coupons.status.inactive")}</SelectItem>
      <SelectItem value="expired">{t("coupons.status.expired")}</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Add in its place:
```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("coupons.searchPlaceholder") }}
  selects={[
    {
      key: "status",
      value: status ?? "all",
      placeholder: t("coupons.filters.allStatuses"),
      options: [
        { value: "all", label: t("coupons.filters.allStatuses") },
        { value: "active", label: t("coupons.status.active") },
        { value: "inactive", label: t("coupons.status.inactive") },
        { value: "expired", label: t("coupons.status.expired") },
      ],
      onValueChange: (v) => { setStatus(v === "all" ? undefined : v); setPage(1) },
    },
  ]}
  hasFilters={search.length > 0 || !!status}
  onReset={() => { setSearch(""); setStatus(undefined); setPage(1) }}
  resultCount={meta && !isLoading ? `${meta.total} ${t("coupons.stats.total")}` : undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/coupons/coupon-list-page.tsx
git commit -m "feat(coupons): replace div.glass Select with FilterBar"
```

---

## Task 8: Branches — replace `div.glass` + PageHeader search with `FilterBar`

**Files:**
- Modify: `dashboard/components/features/branches/branch-list-page.tsx`

**Context:** `search` in PageHeader (line 51), `div.glass` with `<Select>` for isActive (lines 71–88). `isActive` is a boolean, not a string — convert on `onValueChange`.

- [ ] **Step 1: Add `FilterBar` import, remove Select imports**

Change:
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
```
To:
```tsx
import { FilterBar } from "@/components/features/filter-bar"
```

- [ ] **Step 2: Remove `search` prop from `<PageHeader>` (line 48–57)**

Change:
```tsx
<PageHeader
  title={t("branches.title")}
  description={t("branches.description")}
  search={{ value: search, onChange: setSearch, placeholder: t("branches.searchPlaceholder") }}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/branches/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("branches.addBranch")}
  </Button>
</PageHeader>
```
To:
```tsx
<PageHeader
  title={t("branches.title")}
  description={t("branches.description")}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/branches/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("branches.addBranch")}
  </Button>
</PageHeader>
```

- [ ] **Step 3: Replace `div.glass` block (lines 71–88) with `FilterBar`**

Remove:
```tsx
<div className="glass flex flex-wrap items-center gap-3 rounded-lg p-4">
  <Select
    value={isActive === undefined ? "all" : isActive ? "active" : "inactive"}
    onValueChange={(v) => {
      if (v === "all") setIsActive(undefined)
      else setIsActive(v === "active")
    }}
  >
    <SelectTrigger className="w-48">
      <SelectValue placeholder={t("branches.filters.allStatuses")} />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">{t("branches.filters.allStatuses")}</SelectItem>
      <SelectItem value="active">{t("branches.status.active")}</SelectItem>
      <SelectItem value="inactive">{t("branches.status.inactive")}</SelectItem>
    </SelectContent>
  </Select>
</div>
```

Add in its place:
```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("branches.searchPlaceholder") }}
  selects={[
    {
      key: "status",
      value: isActive === undefined ? "all" : isActive ? "active" : "inactive",
      placeholder: t("branches.filters.allStatuses"),
      options: [
        { value: "all", label: t("branches.filters.allStatuses") },
        { value: "active", label: t("branches.status.active") },
        { value: "inactive", label: t("branches.status.inactive") },
      ],
      onValueChange: (v) => {
        if (v === "all") setIsActive(undefined)
        else setIsActive(v === "active")
        setPage(1)
      },
    },
  ]}
  hasFilters={search.length > 0 || isActive !== undefined}
  onReset={() => { setSearch(""); setIsActive(undefined); setPage(1) }}
  resultCount={meta && !isLoading ? `${meta.total} ${t("branches.stats.total")}` : undefined}
/>
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/components/features/branches/branch-list-page.tsx
git commit -m "feat(branches): replace div.glass Select with FilterBar"
```

---

## Task 9: Intake Forms — move search from `PageHeader` to `FilterBar`

**Files:**
- Modify: `dashboard/app/(dashboard)/intake-forms/page.tsx`

**Context:** `search` state exists (line 59), used for client-side filtering (line 71–80). `PageHeader` has `search` prop (lines 117–122). No `FilterBar` exists. Add one — keep client-side filtering logic unchanged.

- [ ] **Step 1: Add `FilterBar` import**

Add after existing imports:
```tsx
import { FilterBar } from "@/components/features/filter-bar"
```

- [ ] **Step 2: Remove `search` prop from `<PageHeader>` (lines 115–128)**

Change:
```tsx
<PageHeader
  title={t("intakeForms.title")}
  description={t("intakeForms.description")}
  search={{
    value: search,
    onChange: setSearch,
    placeholder: t("intakeForms.searchPlaceholder"),
  }}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/intake-forms/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("intakeForms.newForm")}
  </Button>
</PageHeader>
```
To:
```tsx
<PageHeader
  title={t("intakeForms.title")}
  description={t("intakeForms.description")}
>
  <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/intake-forms/create")}>
    <HugeiconsIcon icon={Add01Icon} size={16} />
    {t("intakeForms.newForm")}
  </Button>
</PageHeader>
```

- [ ] **Step 3: Add `FilterBar` between `<PageHeader>` and `<StatsGrid>`**

```tsx
<FilterBar
  search={{ value: search, onChange: setSearch, placeholder: t("intakeForms.searchPlaceholder") }}
  hasFilters={search.length > 0}
  onReset={() => setSearch("")}
  resultCount={!isLoading ? `${filteredForms.length} ${t("intakeForms.stats.total")}` : undefined}
/>
```

The `filteredForms` variable (line 71) remains unchanged — only the UI location moves.

- [ ] **Step 4: Verify page stays under 120 lines**

Run: `wc -l dashboard/app/(dashboard)/intake-forms/page.tsx`

Expected: under 120 lines (currently 165 — removing ~4 lines from PageHeader + adding ~7 for FilterBar = ~168 lines).

> **If over 120 lines:** Extract the `mapApiForm` function and `IntakeFormsPage` body into `components/features/intake-forms/intake-forms-list-page.tsx` and import it in `page.tsx`. The `page.tsx` becomes:
> ```tsx
> import { IntakeFormsListPage } from "@/components/features/intake-forms/intake-forms-list-page"
> export default function IntakeFormsPage() { return <IntakeFormsListPage /> }
> ```

- [ ] **Step 5: Commit**

```bash
git add dashboard/app/(dashboard)/intake-forms/page.tsx
git commit -m "feat(intake-forms): move search from PageHeader to FilterBar"
```

---

## Task 10: Lead Review — typecheck + cleanup

**Files:**
- Read: `dashboard/components/ui/page-header.tsx`
- Run: `npm run typecheck` in `dashboard/`

- [ ] **Step 1: Check `PageHeader` component for `search` prop**

Read `dashboard/components/ui/page-header.tsx`. If `search` prop is defined and no longer used by any page after this migration, remove it from the component's interface and implementation.

To verify no pages still use it:
```bash
grep -r "search={{" dashboard/app dashboard/components --include="*.tsx" | grep "PageHeader" | grep -v "FilterBar"
```
Expected: no results (all search props removed from PageHeader).

- [ ] **Step 2: Run typecheck**

```bash
cd dashboard && npm run typecheck
```
Expected: `Found 0 errors.`

If errors appear, fix them before continuing.

- [ ] **Step 3: Run lint**

```bash
cd dashboard && npm run lint
```
Expected: no errors.

- [ ] **Step 4: Commit cleanup if PageHeader was modified**

```bash
git add dashboard/components/ui/page-header.tsx
git commit -m "refactor(page-header): remove unused search prop"
```

- [ ] **Step 5: Final verification checklist**

Confirm for each page:
- [ ] Clients: search in FilterBar, hasFilters includes search
- [ ] Employees: search in FilterBar, hasFilters includes search
- [ ] Users: search in FilterBar (users tab only), no search in PageHeader
- [ ] Invoices: search in FilterBar, no search in PageHeader
- [ ] Payments: search in FilterBar, no search in PageHeader
- [ ] Bookings: search in BookingsTabContent FilterBar, no search in page.tsx PageHeader
- [ ] Gift Cards: FilterBar replaces div.glass, search + status unified
- [ ] Coupons: FilterBar replaces div.glass, search + status unified
- [ ] Branches: FilterBar replaces div.glass, search + isActive unified
- [ ] Intake Forms: search in FilterBar, client-side filtering unchanged
