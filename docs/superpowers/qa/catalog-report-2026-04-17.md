# QA Report — Catalog domains (Categories · Departments · Coupons · Intake Forms)

- **Date:** 2026-04-17
- **Build:** `manual-qa-2026-04-17`
- **Environment:** localhost:5103 (dashboard) · localhost:5100 (backend)
- **Tester:** Chrome DevTools MCP walkthrough
- **Seed:** empty seed for all four domains (test data created during run)

## Scoreboard

| Domain | PASS | FAIL | Plan | Run |
|--------|------|------|------|-----|
| Categories | 7 | 1 | [plan/52](https://localhost:6443/plan/52/) | [run/131](https://localhost:6443/runs/131/) |
| Departments | 6 | 1 | [plan/53](https://localhost:6443/plan/53/) | [run/132](https://localhost:6443/runs/132/) |
| Coupons | 2 | 2 | [plan/50](https://localhost:6443/plan/50/) | [run/129](https://localhost:6443/runs/129/) |
| Intake Forms | 1 | 2 | [plan/51](https://localhost:6443/plan/51/) | [run/130](https://localhost:6443/runs/130/) |
| **Total** | **16** | **6** | | |

## Bugs

### BUG-1 — Search is not debounced (Categories + Departments) [HIGH]

Same pattern as branches. `useCategoriesList` and the departments hook both key the query directly on `search`, so every keystroke triggers an HTTP request.

**Fix:** mirror `useServices` — add `debouncedSearch` state + 300ms `useEffect`, and use `debouncedSearch` in the query payload. Same shape already applied to [use-branches.ts](apps/dashboard/hooks/use-branches.ts) earlier today.

### BUG-2 — Coupon create payload mismatch [HIGH]

`POST /dashboard/finance/coupons` with a valid-looking payload returns 400:

```
property minAmount should not exist
discountType must be one of the following values: PERCENTAGE, FIXED
```

The frontend sends `discountType: "percentage"` (lowercase) and `minAmount`, but the backend `CreateCouponDto` enum is `PERCENTAGE | FIXED` and the field is `minOrderAmt`. Coupons cannot be created from the dashboard at all.

**Fix:** in the dashboard coupon schema/API client — uppercase the enum on submit (or expose `PERCENTAGE|FIXED` values to the select directly) and rename the field from `minAmount` to `minOrderAmt` (or rename the DTO property to match). Either end works; pick the side that matches the Prisma column.

### BUG-3 — Intake form create payload mismatch [HIGH]

`POST /dashboard/organization/intake-forms` returns 400:

```
property type should not exist
property scope should not exist
property isActive should not exist
```

The backend `CreateIntakeFormDto` only accepts `{ nameAr, nameEn?, fields? }`, but the frontend sends `type`, `scope`, `isActive` (matching the form UI). This is a significantly deeper divergence than the coupon bug — the backend model appears to not support scoping/typing/activation state on create.

**Fix options:** (a) extend the backend DTO + Prisma model to store `type`, `scope`, `scopeId`, and `isActive` (most likely desired, given the UI spec and plan §7), or (b) drop those fields from the dashboard UI until the backend supports them. Pick one deliberately — this is a product question.

### BUG-4 — Coupon form card headings use field labels [MEDIUM]

Same `SectionHeader` misuse as branches had. H2s render "الكود", "أقصى استخدام", "الوصف (EN)" instead of section titles.

**Fix:** introduce `coupons.section.{basic|usage|description}` + `...Description` translation keys and pass them into the three `SectionHeader` components on the create/edit page, same pattern as the branches fix committed earlier.

### BUG-5 — Intake forms list page breaks Page Anatomy Law [MEDIUM]

`/intake-forms` renders without breadcrumbs. The rest of the page (PageHeader, 3-card StatsGrid, FilterBar, DataTable) is intact, but the missing breadcrumb violates the dashboard anatomy.

**Fix:** add `<Breadcrumbs />` above `<PageHeader />` in the intake-forms page.

## Minor notes

- Departments table renders 3 columns (Name / Categories / Status) vs the plan's 7 — not a bug, but the plan is stale; either the plan or the table should be aligned.
- All 4 dashboards have seeds of 0 records — meaningful coverage of "data rendering" cases requires seeding real data (especially for coupons, where the seed blocker compounds with the schema blocker).

## Kiwi links

- Categories — [plan/52](https://localhost:6443/plan/52/) · [run/131](https://localhost:6443/runs/131/)
- Departments — [plan/53](https://localhost:6443/plan/53/) · [run/132](https://localhost:6443/runs/132/)
- Coupons — [plan/50](https://localhost:6443/plan/50/) · [run/129](https://localhost:6443/runs/129/)
- Intake Forms — [plan/51](https://localhost:6443/plan/51/) · [run/130](https://localhost:6443/runs/130/)
