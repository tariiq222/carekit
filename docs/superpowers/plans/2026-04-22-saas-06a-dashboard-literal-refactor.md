# SaaS-06a — Dashboard Literal Refactor Implementation Plan

> **2026-04-25 update:** Re-audit on `main` showed the original "434 literals across 65 files" estimate was stale — most domains had already been migrated in earlier sprints. Tasks 1, 2, and 15 from the original scope are **complete** (commits `0bc516fc`, `d4b39a0a`, `5b11170c` on `main`). The remainder of this plan reflects the actual remaining work as of 2026-04-25. Original 16-task structure is preserved below for historical reference but most tasks are now no-ops.

**Goal (revised):** Drive the dashboard's user-facing string surface to 100% locale-aware. The bulk of the migration already shipped in Plan 06 + earlier sprints; this plan now closes the long tail.

**Tech Stack:** Next.js 15 App Router, React 19, custom `LocaleProvider` + flat `t(key)` (dashboard does NOT use next-intl at runtime — see `apps/dashboard/CLAUDE.md`), Vitest. Parity gate: `cd apps/dashboard && npm run i18n:verify`.

---

## Reality on `main` (2026-04-25 audit)

```bash
# Authoritative scan
grep -rn $'[؀-ۿ]' apps/dashboard/app apps/dashboard/components \
  | grep -v lib/translations | grep -v node_modules
```

Returns **8 files, ~12 lines** of Arabic — far smaller than the original "65 files / 434 literals" estimate. Distribution:

| File | Lines w/ Arabic | Category | Action |
|---|---:|---|---|
| `components/features/bookings/booking-employee-section.tsx` | 1 (line 157) | **User-facing** — `(${duration} د)` minute abbreviation | **Migrate to `t()`** |
| `components/features/bookings/booking-walkin-form.tsx` | 2 (lines 194, 196) | **User-facing** — `defaultValue="السعودية"` for nationality | **Migrate to config / `t()`** |
| `components/features/settings/bank-account-card.tsx` | 27 | Bilingual data (`nameAr`/`nameEn` rows) | Keep — already locale-switched at consumers |
| `components/features/command-palette.tsx` | 9 | Bilingual fuzzy-search hints (`searchTerms`) | Keep — marked `i18n-allow:` |
| `components/features/clients/client-detail-page.tsx` | 4 | JSX comments (`{/* ── Tab N: ... ── */}`) | Cosmetic — translate to EN if touched |
| `components/features/payments/refund-dialog.tsx` | 1 | JSDoc | Cosmetic — translate to EN if touched |
| `components/features/shared/sar-symbol.tsx` | 2 | Default `alt="ريال"` + locale-aware override | Keep — fallback shape is fine |
| `components/features/employees/employee-bookings-chart.tsx` | 1 | JSDoc example (`"يناير"`) | Keep — pedagogical |
| `app/(dashboard)/page.tsx` | 1 | date-fns format string with `،` | Keep — Arabic-comma is a glyph requirement |

---

## Active scope: Task 6 — bookings (real user-facing remainder)

This is the only remaining task with user-facing literals. ~3 lines across 2 files.

### Steps

- [ ] **A. Audit** confirmed above.
- [ ] **B. Keys** — add to `apps/dashboard/lib/translations/{ar,en}.bookings.ts`:
  - `bookings.minutesAbbrev` — AR `"د"` / EN `"min"` (or `"m"`)
  - `bookings.walkin.nationalityDefault` — AR `"السعودية"` / EN `"Saudi Arabia"` (consider sourcing from a country list instead)
- [ ] **C. Refactor**:
  - `booking-employee-section.tsx:157` — `({opt.durationMinutes} ${t('bookings.minutesAbbrev')})`
  - `booking-walkin-form.tsx` — replace literal default with the `t()` value, OR (preferred) point at a country-list helper if one exists.
- [ ] **D. Parity** — `cd apps/dashboard && npm run i18n:verify` must pass.
- [ ] **E. Typecheck** — `cd apps/dashboard && npm run typecheck` must pass.
- [ ] **F. Tests** — re-run any vitest specs touching these files.
- [ ] **G. Commit** — `refactor(saas-06a): bookings — t() literals (2 files, 2 keys)`.

### Risk callouts

- The `defaultValue="السعودية"` in `booking-walkin-form.tsx` is a **form default value**, not a label. Replacing with `t('...')` ties the persisted value to the active locale at submit time, which is wrong for an EN-locale receptionist creating a record stored in an AR-locale database. **Preferred:** route through a stable country-code default (e.g. `"SA"`) and resolve to display name via existing country helpers if any. If no helper exists, leave a `TODO(saas-06a-bookings)` and address with a country-list mini-task instead of a one-off translation key.

---

## Verification (Task 16 — final pass)

When Task 6 lands, run:

```bash
# 1. No new user-facing Arabic literals
grep -rn $'[؀-ۿ]' apps/dashboard/app apps/dashboard/components \
  | grep -v lib/translations | grep -v node_modules

# Expected output: only the allow-listed entries documented in this plan.

# 2. Parity gate
cd apps/dashboard && npm run i18n:verify

# 3. Typecheck
cd apps/dashboard && npm run typecheck

# 4. Manual QA via Chrome DevTools MCP (per dashboard/CLAUDE.md)
#    Screenshot /bookings + walk-in form in `ar` and `en`,
#    save under docs/superpowers/qa/saas-06a-<date>/
```

---

## Out of scope (closed via re-audit)

The original plan listed 14 domain tasks. Re-audit shows:

- **Tasks 1, 2, 15** (employees, settings, shared) — **COMPLETE** (`0bc516fc`, `d4b39a0a`, `5b11170c`).
- **Tasks 3, 4, 5, 7, 8, 11, 12, 13, 14** (dashboard home, services, content, intake-forms, sms, branding, reports, contact-messages, branches) — **NO-OP** at audit time. No literals found. If new literals are added in future PRs, address inline rather than reopening this plan.
- **Task 9 — payments**: 1 line of JSDoc only. Not user-facing. Defer or roll into a doc-cleanup PR.
- **Task 10 — clients**: 4 lines of JSX comments only. Not user-facing. Same as Task 9.

---

## Historical original plan (preserved for context)

> The text below is the original umbrella plan written 2026-04-22. It is preserved verbatim for traceability. **Do not execute against it** — use the revised scope above.

### Critical lessons — READ BEFORE STARTING

1. **Dashboard uses a custom `LocaleProvider`, not next-intl at runtime.** `t(key)` is a flat function from `lib/translations/`. There is no `useTranslations('namespace')` — keys are globally flat but _namespaced by prefix_ (`bookings.title`, `clients.form.name`).
2. **Parity gate is mandatory.** `npm run i18n:verify` must pass before every commit. It fails if any key exists in `ar.*.ts` but not `en.*.ts` (or vice versa).
3. **Do not grep-and-replace blind.** Arabic literals hide in: `toast()`, `console.error` messages, `aria-label`, `placeholder`, `title`, `alt`, Zod `message:`, date-format fallbacks, `<option>` text, commented strings.
4. **Extract into the matching domain bundle.** `ar.bookings.ts` + `en.bookings.ts` for bookings files, etc.
5. **Preserve plural/interpolation shape.** `` `لديك ${n} حجز` `` → `t('bookings.countLabel', { count: n })` with `{count}` placeholder in bundle.
6. **RTL-first stays.** No `ps-`/`pe-`/`ms-`/`me-` changes required by this plan — refactor is string-level only.
7. **Divergence-before-commit.** Discovering a literal that doesn't fit any existing bundle → STOP, document, propose a new bundle, execute after confirmation.
8. **350-line cap.** Extracting translations can push a page over the limit. When it happens, extract helper subcomponents in the same commit.

### Original task list (most are now no-ops)

- [x] Task 1 employees — done (`0bc516fc`)
- [x] Task 2 settings — done (`d4b39a0a`)
- [ ] Task 3 dashboard — no-op at audit
- [ ] Task 4 services — no-op at audit
- [ ] Task 5 content — no-op at audit
- [ ] Task 6 bookings — **active** (see revised scope above)
- [ ] Task 7 intake-forms — no-op at audit
- [ ] Task 8 sms — no-op at audit
- [ ] Task 9 payments — JSDoc only, defer
- [ ] Task 10 clients — JSX comments only, defer
- [ ] Task 11 branding — no-op at audit
- [ ] Task 12 reports — no-op at audit
- [ ] Task 13 contact-messages — no-op at audit
- [ ] Task 14 branches — no-op at audit
- [x] Task 15 shared — done (`5b11170c`)
- [ ] Task 16 verification — pending Task 6 completion
