# Departments Page — Interactive Audit Report

**Date:** 2026-04-16
**Tester:** Claude (Chrome DevTools MCP)
**Environment:** dashboard :5103 · backend :5100 · tenant `b46accb4-dd8a-...`
**Page:** `/departments`
**Coverage:** list · search · filter · reset · create · validation · duplicate · edit · edit-reset · delete · toggle active · pagination · mobile view

---

## Summary

| Status | Count |
|---|---|
| ✅ Pass | 10 operations |
| 🔴 Bugs (must fix) | 5 |
| 🟡 UX / polish | 4 |

Core CRUD works. **One critical backend DTO bug** causes silent failures when users edit description/icon fields. Several smaller issues around error feedback, RTL field ordering, and stats-during-filter semantics.

---

## 🔴 Bugs (must fix)

### #1 — Update with description/icon fails silently · **CRITICAL**

- **Repro:** Click ⋯ → تعديل on any department → type anything in *الوصف (عربي)* or *الأيقونة* → حفظ.
- **Observed:** `PATCH /api/v1/dashboard/organization/departments/:id` → **400 Bad Request**. Dialog stays open. No toast. No visible feedback. User thinks the save is hanging.
- **Backend response:**
  ```json
  {"statusCode":400,"message":[
    "property descriptionAr should not exist",
    "property descriptionEn should not exist",
    "property icon should not exist"
  ]}
  ```
- **Root cause:** [apps/backend/src/modules/org-config/departments/update-department.dto.ts](apps/backend/src/modules/org-config/departments/update-department.dto.ts) is missing `descriptionAr`, `descriptionEn`, `icon` fields. Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` rejects them.
- **Fix:** Add the three `@IsOptional() @IsString() @MaxLength(...)` properties to `UpdateDepartmentDto` (mirror the create DTO). Update the handler's `data` block too.
- **Proof (from create):** Create works because `CreateDepartmentDto` *does* have these fields.

### #2 — Update errors swallowed in UI

- **Repro:** same as #1.
- **Observed:** 400 returns, dialog stays open, no `toast.error(...)`. The only feedback was the *previous* duplicate-name toast still showing.
- **Root cause:** [apps/dashboard/components/features/departments/edit-department-dialog.tsx](apps/dashboard/components/features/departments/edit-department-dialog.tsx) likely does not `try/catch` the mutation and does not call `toast.error`. Delete dialog does this correctly — mirror it.

### #3 — Search ignores English name

- **Repro:** reset, type `EN_PW` into search → 0 results, empty state shown.
- **Expected:** should match the 4 departments whose `nameEn` starts with `EN_PW`.
- **Root cause:** [apps/backend/src/modules/org-config/departments/list-departments.handler.ts:14-18](apps/backend/src/modules/org-config/departments/list-departments.handler.ts) only searches `nameAr`. Should OR across `nameAr`, `nameEn`, and ideally `descriptionAr`/`descriptionEn`.
- **Suggested where:**
  ```ts
  ...(dto.search && {
    OR: [
      { nameAr: { contains: dto.search, mode: 'insensitive' } },
      { nameEn: { contains: dto.search, mode: 'insensitive' } },
    ],
  }),
  ```

### #4 — `sortOrder` spinbutton `max=0`

- **Repro:** open add/edit dialog → focus *ترتيب العرض* → try arrow-up.
- **Observed:** value stuck at 0. a11y tree shows `valuemax="0"`.
- **Root cause:** `<Input type="number" max={0} />` somewhere in the shared form component. Remove `max` or set a sane ceiling (e.g., 9999).

### #5 — Duplicate-name error not localized

- **Repro:** create a department with an `nameAr` that already exists.
- **Observed:** toast reads `"Department with this Arabic name already exists"` — English inside an Arabic UI.
- **Fix:** Either map on the FE (`err.message === '...'` → `t('departments.create.duplicate')`) or return a translation key/code from the backend. Preferred: backend returns an error code (e.g., `DEPARTMENT_NAME_EXISTS`) and the FE resolves it to the locale.

---

## 🟡 UX / polish

### #6 — Empty state during filter = "create a department"

- Filter by غير نشط when none exist → UI suggests *"أنشئ قسماً لتنظيم خدماتك"* with a big "إضافة قسم" button. Misleading — user doesn't want to *create* an inactive one; they want their filter explained.
- **Fix:** branch the empty state on `hasActiveFilters`. Show *"لا توجد نتائج مطابقة للفلتر"* + *"إعادة تعيين"* instead.

### #7 — Form field order is English-first

- Dialog shows *الاسم (إنجليزي)* above *الاسم (عربي)*. Violates the project's RTL-first / Arabic-first rule (root CLAUDE.md).
- **Fix:** swap order in [add-department-dialog.tsx](apps/dashboard/components/features/departments/add-department-dialog.tsx) and edit dialog.

### #8 — Delete confirmation shows `&quot;` literal

- Text reads: `حذف &quot;قسم الاختبار التفاعلي&quot;؟`.
- **Root cause:** translation string uses `&quot;` but renders inside a React text node (not `dangerouslySetInnerHTML`). Replace with actual `"` (U+0022) or use Arabic quotes `«»`.

### #9 — StatsGrid is filter-scoped, not system-scoped

- With فلتر "غير نشط" active, StatsGrid shows `الإجمالي=1, نشط=0, غير نشط=1, جديد هذا الشهر=1`. Stats lose their meaning when filtered.
- **Decision needed:** either
  - **A)** Compute stats from an unfiltered query (separate TanStack query with `isActive` omitted), *or*
  - **B)** Keep filter-scoped but label cards as *"المطابقة"* to avoid confusion.
- Recommend **A** — stats cards are for system overview, not filter feedback.

---

## ✅ What works

| Operation | Status | Notes |
|---|---|---|
| List (6 rows) | ✅ | No console errors. Requests 200/304. |
| Page Anatomy | ✅ | Breadcrumbs → PageHeader → StatsGrid(4) → FilterBar → Table. Matches the Law. |
| Search (Arabic) | ✅ | "PW" → 4 results, StatsGrid updates. |
| Status filter (نشط / غير نشط) | ✅ | Correct results both ways. |
| Reset button | ✅ | Clears search + filter, restores list. |
| Create department (happy) | ✅ | "قسم الاختبار التفاعلي" created, appears top of list, stats refresh 6→7. |
| Create validation (empty) | ✅ | "هذا الحقل مطلوب" on both name fields. |
| Duplicate detection | ✅ | 409 returned, toast shown (but untranslated — see #5). |
| Edit (partial — name only) | ✅ | "كشف عام" → "كشف عام (محدّث)" persisted. |
| Edit form reset on open | ✅ | Opening a different row shows that row's data, not previous row's. |
| Delete (happy) | ✅ | Row removed, dialog closes, stats refresh 7→6. |
| Toggle isActive | ✅ | Switch flips, PATCH 200, row badge changes, stats update. |
| Mobile layout (390×844) | ✅ | Sidebar collapses to toggle. Table horizontally scrolls. No visual breakage. |
| Pagination | N/A | Only 6 rows (< 20). Can't exercise. |

---

## Data notes (not bugs)

- Row `??? ???` / `General Checkup` → corrupt `nameAr` in DB from a seed written before terminal encoding was fixed. Reseed or UPDATE directly. Doesn't block anything.

---

## Console + network

- **Console errors during session:**
  - `409 Conflict` (expected — duplicate test).
  - `400 Bad Request` (bug #1).
  - 2× `Missing Description or aria-describedby for DialogContent` warnings → a11y debt on add/edit dialogs. Add `<DialogDescription>` or set `aria-describedby`.
- **Network:** every `GET /departments` request carries `x-tenant-id`. Tenant isolation headers OK.

---

## Screenshots

- [departments-initial.png](docs/audits/departments-initial.png) — first load, 6 rows.
- [delete-dialog.png](docs/audits/delete-dialog.png) — delete confirmation with `&quot;` artifact.
- [departments-with-inactive.png](docs/audits/departments-with-inactive.png) — after toggling one to inactive.
- [departments-mobile.png](docs/audits/departments-mobile.png) — 390px viewport.

---

## Recommended fix order

1. **#1 (update DTO)** — blocks real usage. Backend fix, 5 lines.
2. **#2 (swallow error)** — needed so #1 and future failures are visible.
3. **#5 (i18n error)** — cheap, user-facing.
4. **#3 (search nameEn)** — improves discoverability significantly.
5. **#4 (sortOrder max=0)** — trivial.
6. **#7 (RTL field order)** — respects project rules.
7. **#8, #9, #6** — polish.
