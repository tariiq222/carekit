# Departments — Edge Cases Audit (Session 1: UI)

**Date:** 2026-04-16 (session 2 of same-day audit)
**Tester:** Claude (Chrome DevTools MCP)
**Environment:** dashboard :5103 · backend :5100 · tenant `b46accb4-dd8a-…`
**Page:** `/departments`
**Coverage:** UI validation + edge cases (10 scenarios). Tenant/RBAC in next session.

---

## Summary

| Status | Count |
|---|---|
| ✅ Pass | 4 |
| 🔴 Bugs (must fix) | 5 |
| 🟡 UX / polish | 4 |

The module survives exotic input (emoji, Unicode, HTML) without XSS or crashes — React escaping holds. But **whitespace-only names are accepted**, **Zod/DTO maxLength disagree**, **error toasts can go missing**, **long names break the table layout**, and **the delete dialog lets you submit the same delete three times**.

---

## 🔴 Bugs

### #E1 — Whitespace-only nameAr is saved · **data integrity**

- **Repro:** Add department → nameAr = `"     "` (5 spaces) → nameEn = `"Whitespace"` → Create.
- **Observed:** 201 Created. Row appears with a visibly empty Arabic-name cell (id `2f5b3002-…`, cleaned up).
- **Root cause:** Zod `.min(1)` checks length, not `trim().length`. Backend DTO `@IsString() @MaxLength(200)` has no minimum at all.
- **Fix:** 
  - FE: `z.string().trim().min(1, …).max(200, …)` (also aligns max with backend).
  - BE: add `@MinLength(1)` **after** a trim transform, or `@Matches(/\S/)` to reject whitespace-only.

### #E2 — Zod (255) and backend DTO (200) disagree on maxLength · **UX**

- **Repro:** Enter 201 chars in nameAr → Create → 400 back from server.
- **Observed:** Toast shows the raw English sentence `nameAr must be shorter than or equal to 200 characters` inside an Arabic UI.
- **Root cause:** 
  - FE `department.schema.ts` uses `.max(255)`; BE DTO uses `@MaxLength(200)` → FE never triggers its own error, server speaks English.
  - `ApiError.message` falls through to `rawMessage.join(", ")` with no locale mapping.
- **Fix:** 
  - Align FE Zod `.max(200)` with backend.
  - Optional: map common ValidationPipe phrases (`must be shorter than or equal to N characters`) to a generic `t("validation.tooLong")` toast, since the backend sentence bypasses FE validation only when FE is wrong.

### #E3 — Form-level errors for non-name fields are invisible · **UX**

- **Repro:** `descriptionAr` 1001 chars → Create.
- **Observed:** No POST sent (Zod blocks), no toast, no red text under the field. Submit button silently does nothing. User has no idea what's wrong.
- **Root cause:** [create-department-dialog.tsx](apps/dashboard/components/features/departments/create-department-dialog.tsx) only renders `formState.errors.nameAr` and `formState.errors.nameEn`. `descriptionAr/En/icon/sortOrder` errors are computed by Zod but never displayed.
- **Fix:** Render `<p className="text-xs text-destructive">` under every field that can fail, or show a form-level error summary at the top of the dialog.

### #E4 — Delete button can fire 3× for the same row · **race**

- **Repro:** Open delete dialog → click the destructive action three times rapidly (real click events, not auto-repeat).
- **Observed:** 
  - `DELETE /…/:id → 200` (succeeds)
  - `DELETE /…/:id → 404` (already gone)
  - `DELETE /…/:id → 404`
- Even though `disabled={deleteMut.isPending}` is set, React's state commit lags behind the synchronous click event loop, so the first 2–3 clicks land before `isPending` flips.
- **Fix:** Close the dialog (set `onOpenChange(false)`) **immediately** on the first click, before awaiting. Or use a `useRef<boolean>` lock set synchronously inside the click handler. Both patterns are race-proof.

### #E5 — Create dialog retains previous input after Cancel · **UX**

- **Repro:** Open add dialog → type anything → Cancel → Open add dialog again.
- **Observed:** Prior values still in the fields.
- **Root cause:** [create-department-dialog.tsx](apps/dashboard/components/features/departments/create-department-dialog.tsx) only calls `form.reset()` on success. No `useEffect` tied to `open` like the edit dialog has.
- **Fix:** Mirror the edit dialog pattern:
  ```tsx
  useEffect(() => { if (!open) form.reset(defaults) }, [open])
  ```

---

## 🟡 UX / polish

### #E6 — sortOrder negative triggers native browser alert

- `-50` entered → Firefox/Chrome native popup *"Value must be greater than or equal to 0"* (English) overlays the form. The input gets `aria-invalid="true"` but no React-rendered error.
- **Fix:** Let Zod handle it (already `.min(0)`). Make sure the Zod error is rendered (see #E3). Remove reliance on native HTML5 validation dialog.

### #E7 — Icon field accepts `../../etc/passwd`, `<script>`, null-byte escapes

- Any garbage passes because Zod is `z.string().max(100)` with no pattern. It's only displayed as text, so no immediate exploit — but if this ever feeds into an `<img src={icon} />` or a filesystem path, we have problems.
- **Fix:** Restrict to the icon set you actually support: `z.string().regex(/^[a-z-]{1,50}$/)` or a controlled picker. Defense-in-depth even if today's renderer is safe.

### #E8 — Long names break the table layout

- A 138-char Arabic name stretches the name column to 837px, pushing the other columns (categories, status, actions) off-screen on smaller viewports. No `truncate`, no `line-clamp`, no tooltip.
- **Fix:** Add `truncate max-w-[280px]` to the name span and set `title={nameAr}` for hover disclosure. Keep the bilingual stacked layout.

### #E9 — Delete confirmation says `« »` for whitespace names

- Direct consequence of #E1 — but even after #E1 is fixed, consider rendering a fallback like `«(بدون اسم)»` when `nameAr.trim() === ""` for existing corrupt data in the DB.

---

## ✅ Passes

| # | Scenario | Notes |
|---|---|---|
| P1 | XSS via name / description | React escapes — `<script>` rendered as literal text, no execution. Console stayed clean. |
| P2 | Emoji + ZWJ + Arabic diacritics | `طِبّ 🏥👨‍⚕️` round-trips through DB and table unchanged. |
| P3 | Backend 409 duplicate | Structured error body (`error: DEPARTMENT_NAME_EXISTS`) still triggers the localized Arabic toast from the previous fix. |
| P4 | sortOrder Zod rejection | `.min(0)` prevents the POST. (Only gripe: no visible FE message — #E6.) |

---

## Data hygiene note

One DB row still reads `nameAr = "??? ???"` from an earlier terminal-encoding accident (documented in the prior audit). Not a bug in today's code, but will keep confusing testers and screen-reader users until it's either reseeded or cleaned in a migration.

---

## Fix order (recommended)

1. **#E4 (delete race)** — user-facing false error toasts, and leaks 2 pointless DELETE requests.
2. **#E1 (whitespace name)** — silently creates unusable data; cheap two-line FE+BE fix.
3. **#E2 (maxLength mismatch)** — align Zod `.max(200)` with backend so local validation fires first.
4. **#E5 (cancel doesn't reset)** — one `useEffect`.
5. **#E3 (invisible errors)** — render errors for every field.
6. **#E8 (long-name truncation)** — one Tailwind class + title attr.
7. **#E6, #E7, #E9** — polish.
