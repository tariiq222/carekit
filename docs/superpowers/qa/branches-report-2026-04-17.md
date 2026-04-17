# QA Report — Branches dashboard

- **Date:** 2026-04-17
- **Build:** `manual-qa-2026-04-17`
- **Plan:** CareKit / Branches / Manual QA
- **Environment:** localhost:5103 (dashboard) · localhost:5100 (backend)
- **Tester:** Chrome DevTools MCP walkthrough
- **Seed:** 3 branches (Main Branch `isMain=true`, Al Rawdah, "للللل")

## Summary

| # | Area | Result |
|---|------|--------|
| 1 | Initial load + StatsGrid + no console errors | PASS |
| 2 | Status filter `isActive=false` | PASS |
| 3 | Search input debounce (300ms) | **FAIL** — 1 request per keystroke |
| 4 | DataTable columns + Main badge scoped to main row | PASS |
| 5 | Row actions menu hides "Set as primary" on main branch | PASS |
| 6 | Set as primary (swap) | **FAIL** — backend rejects instead of swapping; error toast in English |
| 7 | BranchEmployeesDialog assign/unassign | PASS |
| 8 | Create form — empty submit validation (Arabic) | PASS |
| 9 | Create form — submit + redirect + data persisted | PASS |
| 10 | Edit form — prefill | PASS (breadcrumb shows UUID, not branch name) |
| 11 | Delete dialog shows branch name in description | PASS |
| 12 | Delete — row removed + StatsGrid updated | PASS |
| 13 | Card headings on Create/Edit form | **FAIL** — h2 renders first field's label instead of card title |

**Totals:** 10 PASS · 3 FAIL

## Bugs

### BUG-1 — Search is not debounced (HIGH)

`apps/dashboard/hooks/use-branches.ts` stores `search` directly and uses it in the query key. Typing "الرياض" (6 chars) fired 6 sequential requests. Compare `apps/dashboard/hooks/use-services.ts` which uses a `debouncedSearch` state + 300ms `setTimeout`.

**Fix:** mirror the services hook — add `const [debouncedSearch, setDebouncedSearch] = useState("")` plus a `useEffect` that debounces `search` by 300ms, then use `debouncedSearch` inside the `BranchListQuery`.

### BUG-2 — "Set as primary" does not auto-swap (HIGH)

Attempting to set a non-main branch as primary while another branch already has `isMain=true` returns 409 with `"Another branch is already primary (الفرع الرئيسي). Unset it first."`.

Two problems:
- The test plan (§5.1, §11.6) specifies an atomic swap — there should never be zero or two primary branches. Requiring the user to manually unset first breaks the "transaction atomic" expectation and leaves the org momentarily without a main branch.
- The error message is hard-coded English; the rest of the UI is Arabic.

**Fix:** in the branch update handler, when `isMain=true` is set on branch B, wrap the operation in a transaction that sets `isMain=false` on the currently-primary branch before setting `isMain=true` on B. Remove the 409 guard (or keep it as a lower-level safety net but make the handler swap preemptively).

### BUG-3 — Card h2 renders field label instead of card title (MEDIUM)

On `/branches/create` and `/branches/[id]/edit`, the three form cards show:
- Card 1 h2: `الاسم (EN)` (first field label) — should be "الأسماء" or similar
- Card 2 h2: `نشط` (last field) — should be "الإعدادات"
- Card 3 h2: `العنوان` (first field) — should be "معلومات الاتصال"

Also, the page-level description `إضافة فرع جديد للعيادة.` is repeated inside card 1.

**Fix:** the branches form-page component is passing the first `FormField`'s `label` as the `CardTitle`, or mis-using the `CardHeader` slot. Inspect `components/features/branches/branch-form-page.tsx` (or similar) and pass explicit per-card titles (reuse pattern from services form cards).

## Minor notes (not bugs, worth tracking)

- **Breadcrumb on edit page** shows the UUID (`61a8fdc4…`) instead of the branch name. Minor polish — match the services edit breadcrumb which uses the localized name.
- **Query `limit=50`** in list requests (plan expected 20). Current implementation is intentional (`perPage: 50` in `use-branches.ts`), but is inconsistent with services (`limit=20`). Decide on one value across list pages.

## Screenshots

- `screenshots/branches/list-light-rtl.png`
- `screenshots/branches/list-dark-rtl.png`

## Kiwi links

- Plan: https://localhost:6443/plan/49/
- Run: https://localhost:6443/runs/127/
