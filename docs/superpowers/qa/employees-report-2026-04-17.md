# تقرير اختبار QA — صفحة الممارسين (Employees)

> **Date:** 2026-04-17
> **Tester:** Claude (Chrome DevTools MCP manual QA gate)
> **Plan:** [employees.md](./employees.md)
> **Branch:** `main`
> **Screenshots:** [screenshots/employees/](./screenshots/employees/)

## Verdict

🔴 **NOT READY TO MERGE.** The employees feature has broken contracts on both ends: the list renders English names on an Arabic UI, the create form is missing most of the fields the DTO declares (phone, gender, avatar, employmentType, specialtyIds, branchIds, serviceIds), three charts on the detail page fail with HTTP 400 because the client requests `limit=500` against a backend cap of 200, and the experience spinbutton is pinned at `valuemax="0"`. In short: you cannot create a complete employee record through the UI, you cannot see Arabic names in the list, and the detail page throws on load.

---

## Environment

- Backend `:5100` ✅ — seed inserted 3 employees, 3 services, 0 ratings, 0 inactive employees. Seed is **below spec** (plan wants 10+ employees, mixed active/inactive, 3+ specialties, 2+ branches, a rated employee, an employee without experience).
- Dashboard `:5103` ✅ — logged in as `admin@carekit-test.com` via dev auth.
- Kiwi duplicate product `CareKit Dashboard` (id=3) merged back into `CareKit` (id=1) before this session — fixed in container via `merge-playbook`.

---

## Findings

### 🔴 Blockers — cannot ship

#### E1 List table renders English names in an Arabic UI

Each row shows `Dr. Khalid Alsubaie` (`nameEn`) even though the API payload contains `nameAr: "د. خالد السبيعي"`. The table should prefer `nameAr` with `nameEn` as fallback.

Response snippet (reqid=52):
```json
{ "nameAr": "د. خالد السبيعي", "nameEn": "Dr. Khalid Alsubaie", "name": "د. خالد السبيعي" }
```

Screenshot: `list-light-rtl.png`.

#### E2 Three detail-page charts fail with HTTP 400

The detail page fires three parallel calls:

```
GET /api/v1/dashboard/bookings?limit=500&employeeId=…&fromDate=…&toDate=…
→ 400 {"message":["limit must not be greater than 200"]}
```

The client component asks for 500, the `ListBookingsDto` caps at 200. Either raise the cap for this caller, or ask for a server-side aggregation endpoint instead of paging 500 bookings client-side. All three of: "الحجوزات حسب الحالة", "الحجوزات حسب النوع", "الإيرادات" cards show 0/empty because the underlying query rejects.

reqids=144, 145, 146 on `/employees/00000000-0000-4000-8000-000000000003`.

#### E3 Create form is missing most required fields

The spec (plan §6.1–6.2) and the backend DTO both expect: `phone`, `gender`, `avatarUrl`, `employmentType`, `specialtyIds[]`, `branchIds[]`, `serviceIds[]`, plus `education*` and `bio*`. The current create form on tab «المعلومات الأساسية» exposes only: title, email, nameEn, nameAr, specialty (EN text), specialty (AR text), experience, education×2, bio×2. There is no way from the UI to assign the new employee to a branch, a service, or set a phone number.

Screenshot: `create-validation.png`.

#### E4 Experience number input is broken — `valuemax="0"`

Both the create and edit forms expose the "الخبرة (سنوات)" spinbutton with `valuemax="0"`. The UI will prevent any positive value from being entered through native stepper clicks; typing is accepted but the constraint is wrong. Should be unbounded (or a reasonable max like 60).

DOM (create + edit): `spinbutton "e.g. 5" valuemax="0" valuemin="0"`.

### 🟠 High-severity — clear fixes before re-test

#### E5 Delete dialog uses `nameEn` in Arabic copy

The dialog reads «حذف Dr. Khalid Alsubaie نهائياً؟ …». Copy is Arabic, name should be `nameAr` («د. خالد السبيعي»). Same root cause as E1.

Screenshot: `delete-dialog.png`.

#### E6 Breadcrumb shows truncated UUID instead of name

`/employees/{id}` and `/employees/{id}/edit` breadcrumbs show «00000000…» (first 8 chars of the UUID) as the leaf segment. Should render the employee's `nameAr`.

#### E7 Sortable column headers don't trigger backend sort

Clicking «الخبرة» column header does not fire a new request with `sortBy=experience&sortOrder=asc`. Either remove the sort affordance (misleading to show it) or wire it up to the list API.

#### E8 Validation error messages are partly English on an Arabic UI

Submit an empty create form and two of the four errors come back in English:

- «البريد الإلكتروني غير صالح» ✅
- «الاسم الكامل مطلوب» ✅
- `Full name (EN) is required` ❌
- `Specialty is required` ❌

#### E9 Detail page has no tabs — one long scroll

The plan §8 lists six sections (general info, services, weekly schedule, breaks, vacations, ratings) as tabs. Current page dumps all of them into a single scroll. The edit page already uses tabs — apply the same pattern to detail.

#### E10 Weekday grid does not respect Saudi weekStartDay

On the edit scheduler, days are laid out Sunday → Saturday left-to-right. Saudi clinics normally start the week on Saturday. The org-experience setting should drive `weekStartDay`; the grid should read it.

#### E11 No split-shift support on the scheduler

Each day shows one (start, end) pair plus an «إضافة استراحة» button. The plan §8.2 calls for adding a second *window* per day (e.g. 09:00–13:00 + 16:00–20:00), not just a break within a single window.

### 🟡 Nice-to-have — lower priority

#### E12 Specialty relation is empty even when the employee has a specialty

List payload has `specialty: "Dentistry"` / `specialtyAr: "أسنان"` (the denormalized fields) but `specialties: []` (the relation). Either populate the relation in seed, or drop the `specialties[]` relation from the API shape if the UI doesn't consume it.

#### E13 Seed data is far below plan spec

Plan asks for 10+ employees (mixed active/inactive), 3+ specialties, 2+ branches, 5+ services, at least one employee with ratings, and one without experience. Seed delivers 3 employees, all active, zero ratings, all from the same branch (`main-branch`). Several scenarios (inactive filter, avgRating != null, pagination) are untestable.

#### E14 Filter state not reflected in URL

`?search=…&status=…` would make pages shareable / reloadable. Currently the URL stays `/employees` no matter the filter state.

#### E15 Empty-state copy is wrong for filtered-empty

Searching `zzz` returns 0 results and the page shows «لا يوجد ممارسون حتى الآن. أضف ممارساً للبدء.» — the add-first-employee CTA is wrong when the list is empty because of a filter. Needs a second empty-state variant.

#### E16 List API leaks relation rows the UI ignores

Each employee payload ships the raw join-table rows `branches: [{ id, employeeId, branchId }]` and `services: [{ id, employeeId, serviceId }]`. The UI doesn't render them on the list. Either project the response to what the list needs, or hydrate the branch/service records so they're actually useful.

#### E17 "List page → detail page" breadcrumb link is present but detail page breadcrumb strip collapses too early on narrow widths

Minor — flagged for the design pass.

#### E18 Hard-coded three-row "الأسعار" section on the detail page

«زيارة العيادة / استشارة هاتفية / استشارة فيديو» are hardcoded rows, all showing «—». There is no backing field in the employee model; either wire it to the actual services the employee offers (with their prices) or remove the section.

#### E19 Detail stats are zero with no empty-state UX

"0 تقييم", "0 حجز", "—" for avgRating and experience. Page looks broken more than it looks new-employee. Could use friendlier copy.

#### E20 Service attached to seeded employee shows «غير نشط»

`Dr. Khalid Alsubaie` has `تنظيف أسنان` attached but it shows «غير نشط» on the detail page. The seed sets `isActive: true` on the service row but probably not on `EmployeeService.isActive`. Double-check seed.

#### E21 `valuemax="2"` on the time-picker AM/PM spinbutton is fine, but `valuemax="12"` on the hours spinbutton means users cannot roundtrip 00:00 as midnight — minor usability.

#### E22 Red flag from plan §14 still present: Multi-select onChange is moot because multi-selects aren't in the UI at all.

---

## What worked ✅

- Breadcrumbs, header, stats grid load cleanly with no console errors.
- `GET /dashboard/people/employees` and `/stats` both return correctly; 304 caching behaves.
- Status filter sends the right params: `isActive=true`, `isActive=false`, and omitted for «جميع الحالات».
- Search is debounced and hits the backend with `&search=zzz`.
- Delete dialog is the right component (AlertDialog with proper destructive styling) — just uses the wrong name.
- Edit page tab structure (Basic / Schedule & Breaks / Services & Pricing) is a clean pattern.
- Validation fires on empty submit (errors in the right places, even if partly English).
- Dark mode toggles; see `list-dark-rtl.png`.
- No console errors throughout the session except the 400s called out in E2.

---

## Kiwi TCMS

- Product: `CareKit` (id=1). Duplicate `CareKit Dashboard` merged before this session.
- Plan: `CareKit / Employees / Manual QA`
- Build: `manual-qa-2026-04-17`
- Plan JSON: [`data/kiwi/employees-2026-04-17.json`](../../../data/kiwi/employees-2026-04-17.json)
- Sync: `npm run kiwi:sync-manual data/kiwi/employees-2026-04-17.json`
- Plan URL: <https://localhost:6443/plan/46/>
- Run URL:  <https://localhost:6443/runs/121/>
- Result: 16 FAILED / 6 PASSED out of 22 cases.

---

## Suggested fix order

1. **E4** — unbind `valuemax=0` on the experience input (one-line fix).
2. **E2** — cap the detail-page bookings query at `limit=200` (or add an aggregation endpoint).
3. **E1 / E5** — switch list + delete dialog to `nameAr` with `nameEn` fallback.
4. **E3** — add phone/gender/avatar/employmentType/specialty/branch/service selectors to the create form; same for edit.
5. **E8** — finish Arabic translations on validation errors.
6. **E10 / E11** — scheduler: respect `weekStartDay`; allow multiple windows per day.
7. **E7 / E14** — wire column sorts and URL filters or drop them.
8. **E6 / E13 / E15** — polish breadcrumb name, expand seed, fix filter-empty copy.
9. Everything else — design pass.
