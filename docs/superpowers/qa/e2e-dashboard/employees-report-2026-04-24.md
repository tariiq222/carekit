# E2E QA Report — Phase 2: Employees (الممارسون)

**Date:** 2026-04-24
**Tester:** Claude (Chrome DevTools MCP)
**Dashboard URL:** http://localhost:5103/employees
**Backend endpoints touched:**
- `GET /api/v1/dashboard/people/employees`
- `GET /api/v1/dashboard/people/employees/stats`
- `POST /api/v1/dashboard/people/employees/onboarding` (create — **NEVER CALLED**, see Bug #3)
- `PATCH /api/v1/dashboard/people/employees/:id` (edit — works)

## Results Summary

| # | Test Case | Route | Status | Severity |
|---|-----------|-------|--------|----------|
| 2.1 | List employees | `/employees` | ⚠️ PASS with issues | Medium (labels) |
| 2.2 | **Create employee** | `/employees/create` | 🛑 **FAIL** | **HIGH** |
| 2.3 | View details | `/employees/[id]` | ✅ PASS | — |
| 2.4 | Edit employee | `/employees/[id]/edit` | ⚠️ PASS with issue | Low (missing field) |
| 2.5 | Delete (with confirm) | `/employees` | ✅ Dialog renders correctly (not actually deleted — cancelled) | — |
| 2.6 | Search | `/employees` | ✅ PASS | — |

---

## 🐛 BUG #3 — Create-employee submit silently does nothing (HIGH)

### Severity: **HIGH** (blocks the entire create flow)

### Reproduction
1. Login and navigate to `/employees/create`.
2. Fill all required fields in the "المعلومات الأساسية" tab:
   - البريد الإلكتروني: `qa.tester@deqah-test.com`
   - الاسم الكامل (EN): `QA Tester`
   - الاسم الكامل (AR): `مختبر الجودة`
   - التخصص (EN): `QA Specialist`
3. Leave the other two tabs at defaults (Schedule tab has sensible defaults, Services tab is empty).
4. Click "إنشاء الممارس".

### Expected
- A `POST /api/v1/dashboard/people/employees/onboarding` request fires.
- On success: toast "تم إنشاء الممارس" + redirect to `/employees`.
- On validation error: a visible error message appears on the offending field.

### Actual
- **Zero network requests** fire (confirmed via DevTools network panel — no XHR/fetch leaves the page after clicking submit).
- **Zero toast** messages (success or error) appear.
- **Zero console errors/warnings.**
- **No `aria-invalid`** fields and **no FormMessage** error nodes visible in the DOM.
- Native `submit` event fires on the `<form>` element (confirmed by attaching a DOM listener — so the button → form wiring is correct).
- The user is left on the same page with no feedback whatsoever.

### Verification
```js
// 1. Native form submit fires: YES
form.addEventListener('submit', e => console.log('fired'));
form.requestSubmit();  // → "fired"

// 2. React onSubmit prop exists and is a function: YES
form[__reactProps].onSubmit   // → function

// 3. After requestSubmit():
//    - Network: 0 requests
//    - Toasts: 0
//    - aria-invalid fields: 0
//    - [role="alert"] or .text-destructive error text: 0
```

This means **`form.handleSubmit`'s callback (`submitCreate`) is never invoked** — the zod schema validation rejects the input silently but:
1. No field shows a `FormMessage` (the field is either not wrapped in `<FormField>`, or the schema error is on an unrendered field),
2. No `toast.error` is shown for the validation failure itself,
3. RHF's `onError` handler is not supplied so nothing surfaces.

### Suspects (for developer)

Files:
- `apps/dashboard/components/features/employees/employee-form-page.tsx` — form wrapper (line 145 `<form onSubmit={onSubmit} …>`)
- `apps/dashboard/components/features/employees/use-employee-form.ts` — `const onSubmit = form.handleSubmit(async (data) => { await submitCreate(data) })` (line 280) — **no `onInvalid` callback passed**
- `apps/dashboard/components/features/employees/create/form-schema.ts` — zod schema (line 15-34)

Likely root causes to check in order:
1. **`z.coerce.number().int().min(0).optional()` on `experience`** — the raw HTML spinbutton has `valuemax="0"` (see Bug #4), so if the user types anything, the coerced number might collide with schema. Even with default `undefined`, verify that zod `.coerce.number()` on `""` doesn't throw.
2. **`avatarUrl: z.string().url().optional().or(z.literal(""))`** — should pass for `""` default, but confirm.
3. **`avatarFile: z.instanceof(File).optional()`** — RHF initializes this as `undefined`. `z.instanceof(File)` with no value should pass. Confirm by inspecting `form.formState.errors` right after submit.
4. **Hidden required field with no `FormField` wrapper** — search the JSX for every field in the schema and make sure each has an associated `FormMessage`.

### Diagnostic recommendation

Add an `onInvalid` handler as the second argument to `form.handleSubmit`:

```ts
const onSubmit = form.handleSubmit(
  async (data) => { ... },
  (errors) => {
    console.warn("Employee form validation failed", errors);
    toast.error(t("common.validationFailed"));
  },
);
```

This single change will surface the real reason for the silent rejection and likely pinpoint the bad field.

### Evidence
- `apps/dashboard/.../use-employee-form.ts:280` shows single-arg `handleSubmit` (no error handler).
- Network log confirmed: the 13 fetch/xhr requests on the create page are all GETs (branding, me, subscription, services, settings). Zero POST.

---

## 🐛 BUG #4 — "Experience (years)" spinbutton has `valuemax="0"`

### Severity: **LOW** (misleading but non-blocking)

### Reproduction
1. On `/employees/create` or `/employees/[id]/edit`, inspect the "الخبرة (سنوات)" numeric field.
2. The accessibility snapshot reports `valuemax="0"` on the `<input type="number">`.

### Expected
Max should be an open range (no `max` attribute), or at least a reasonable upper bound like 70.

### Actual
`valuemax="0"` — which, if the browser or assistive tech actually enforced it, would reject any positive experience. Manual entry still works today (value `1` saved successfully on edit), but the attribute is wrong and likely originates from a misread of the zod schema `.min(0)` as `.max(0)`.

### Location
Probably in `apps/dashboard/components/features/employees/create/basic-info-tab.tsx` or wherever the experience input is rendered. Check for `max={0}` or `max={maxExperience}` where the source is the zod `.min(0)` constraint.

---

## 🐛 BUG #5 — Email field missing on edit form

### Severity: **LOW** (inconsistent UX)

### Reproduction
1. Open `/employees/[id]/edit`.
2. Compare the "المعلومات الأساسية" tab with the same tab in `/employees/create`.

### Expected
The email field should be visible (editable or at least read-only) on edit, matching the create form shape — or there should be a deliberate note explaining why it's not editable.

### Actual
The email input is simply absent from edit mode. The create form has it as a **required** field (with `*` star), which makes its disappearance on edit surprising.

### Suggested fix
Either:
- Render the email field as **read-only** (`<Input readOnly />`) showing the current email, OR
- Render it as editable if the backend supports updating it.

Either way, do not silently drop the field — users expect to see or edit their email.

### Location
`apps/dashboard/components/features/employees/employee-form-page.tsx` — the JSX that conditionally renders fields based on `isEdit`.

---

## 🐛 BUG #6 — Stats card label "غير متاح" does not match row badge "موقوف"

### Severity: **MEDIUM** (user confusion)

### Reproduction
1. Open `/employees`.
2. Observe: stats card 3 is titled **"غير متاح"** with count **2**.
3. In the table, the two employees with that non-active status show the badge text **"موقوف"**.

### Expected
Stats-card label and row-badge label should use the **same term** for the same state. Either both "غير متاح", or both "موقوف", or both whatever the single source of truth dictates.

### Actual
Two different Arabic terms for the same concept, right next to each other on the same page.

### Suggested fix
1. Grep translation files for both keys and unify.
   - `apps/dashboard/lib/translations/ar.employees.ts`
   - `apps/dashboard/lib/translations/en.employees.ts`
2. Pick the correct one ("موقوف" reads like "suspended" — probably the right one if it means the employee is temporarily not accepting bookings).
3. Run `npm run i18n:verify` after change.

---

## 🐛 BUG #7 — "متوسط التقييم 4.5" shown while every row's rating column shows "—"

### Severity: **MEDIUM** (data integrity / honesty)

### Reproduction
1. Open `/employees`.
2. Observe stats card 4: "متوسط التقييم" = **4.5**.
3. Scan the "التقييم" column in the table: all 10 rows show "—" (no rating).

### Expected
If no employee has any rating, the stats card should show "—" (or "0.0 · 0 تقييم"). An average of 4.5 implies there are ratings somewhere — but the table shows none.

### Actual
Contradiction visible to the user — either the stat is stale/fake/hardcoded, or the table column is not populated with actual rating values.

### Possible causes to investigate
1. **Stale stat:** the backend may be computing avg over deleted/soft-deleted ratings. Check `GET /api/v1/dashboard/people/employees/stats` response.
2. **Unpopulated column:** the list endpoint doesn't return `averageRating`/`ratingCount` per employee, so the UI just falls back to "—" even when ratings exist.
3. **Hardcoded UI:** the "4.5" may be placeholder text left from development.

Check: `apps/backend/src/modules/people/employees/get-employee-stats.handler.ts` (or equivalent), and compare its query against actual `Rating` rows in the DB.

---

## ✅ Working flows (baseline)

### 2.1 — List page
- 10 employees, 8 active, 2 "موقوف"/"غير متاح" (see Bug #6), avg rating 4.5 (see Bug #7).
- Columns: الممارس (avatar+name), البريد الإلكتروني, الخبرة, التقييم, الحالة, الإجراءات.
- Row actions: معاينة / تعديل / حذف (icon-only).
- Fits on one page (no pagination shown with 10 rows).
- PageHeader uses "التقييمات والمراجعات" as the secondary action (different pattern from Clients' "تصدير" — **intentional? confirm with design**).

### 2.3 — Details page (`/employees/[id]`)
- 5 tabs: نظرة عامة / الخدمات / الجدول / التقييمات / الملف العام.
- Hero card: avatar initials, title, status badge, avg rating + rating count, total bookings, years of experience.
- Overview tab: 4 charts (bookings by status, bookings by type, bookings count, revenue) with month / 3-month / 6-month toggles.
- Sections: بيانات التواصل · المعلومات المهنية · معلومات الحساب · الأسعار.
- Dates render in Arabic locale numerals (٢٤‏/٤‏/٢٠٢٦) — consistent with spec.

### 2.4 — Edit page (successful save path)
- Data pre-fills correctly.
- Save → `PATCH /api/v1/dashboard/people/employees/:id` → redirects to list.
- Toast success visible.
- See Bug #5 for email-field issue.

### 2.5 — Delete dialog
- Alert dialog renders in Arabic: "حذف الممارس · حذف د. <name> نهائياً؟ سيتم إزالة حجوزاته وجدوله وملفه الشخصي. لا يمكن التراجع عن هذا الإجراء."
- **Note:** Uses **hard-delete wording** ("لا يمكن التراجع") vs. Clients which uses **soft-delete wording** ("يمكن استعادته من قِبَل فريق الدعم"). Verify this is intentional semantics, not just copy drift.

### 2.6 — Search
- URL updates (`?search=ليان&page=1`) — good (shareable links).
- Reset button "إعادة تعيين" appears.
- Result count: `10 الإجمالي` → `1 الإجمالي` when searching "ليان".
- Stats cards remain unfiltered (showing global totals) — intentional? Or should stats reflect current filter? Confirm with design.

---

## Next phase

Phase 3 — Bookings (الحجوزات) — `/bookings` CRUD, recurring, waitlist.
