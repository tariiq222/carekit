# SaaS-06a — Dashboard Literal Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded Arabic literal in `apps/dashboard/app/` + `apps/dashboard/components/` with a `t('domain.key')` call, and ensure every key has an EN counterpart. This is the volume follow-up to Plan 06, which added the parity gate + tenant switcher but deferred the actual page-by-page refactor.

**Why separate plan:** Plan 06's single-session scope was impossible for 434 literals across 65 files. Splitting into a dedicated plan lets each domain be a discrete, reviewable task. Each task is independent; tasks can be parallelized across subagents or sessions.

**Tech Stack:** Next.js 15 App Router, React 19, custom `LocaleProvider` + flat `t(key)` (dashboard does NOT use next-intl at runtime — see `apps/dashboard/CLAUDE.md`), Vitest. Parity gate: `npm run i18n:verify`.

---

## Critical lessons — READ BEFORE STARTING

1. **Dashboard uses a custom `LocaleProvider`, not next-intl at runtime.** `t(key)` is a flat function from `lib/translations/`. There is no `useTranslations('namespace')` — keys are globally flat but _namespaced by prefix_ (`bookings.title`, `clients.form.name`).
2. **Parity gate is mandatory.** `npm run i18n:verify` must pass before every commit. It fails if any key exists in `ar.*.ts` but not `en.*.ts` (or vice versa).
3. **Do not grep-and-replace blind.** Arabic literals hide in: `toast()`, `console.error` messages, `aria-label`, `placeholder`, `title`, `alt`, Zod `message:`, date-format fallbacks, `<option>` text, commented strings. Each task lists exact files + expected literal count.
4. **Extract into the matching domain bundle.** `ar.bookings.ts` + `en.bookings.ts` for bookings files, `ar.settings.ts` + `en.settings.ts` for settings, etc. Don't dump into `ar.misc.ts` unless the string truly is cross-domain.
5. **Preserve plural/interpolation shape.** `` `لديك ${n} حجز` `` → `t('bookings.countLabel', { count: n })` with `{count}` placeholder in bundle. Do not concatenate translated fragments.
6. **RTL-first stays.** No `ps-`/`pe-`/`ms-`/`me-` changes required by this plan — refactor is string-level only.
7. **Divergence-before-commit.** Discovering a literal that doesn't fit any existing bundle → STOP, document in the task's notes, propose a new bundle or a `misc` home, execute after confirmation.
8. **350-line cap.** Extracting translations can push a page over the limit. When it happens, extract helper subcomponents in the same commit.

---

## Scope

### In-scope

434 inline Arabic literals across 65 files, grouped into 14 domain tasks + 1 shared task + 1 verification task. Each task commits independently under the conventional format `refactor(saas-06a): <domain> — t() literals (N files, M keys)`.

### Explicitly out

- `apps/dashboard/messages/`, `apps/mobile/**`, `apps/website/**` — different i18n stacks.
- Backend error messages returned to dashboard — those flow through API responses; a separate plan will localize API error responses.
- Log messages (`console.error("...")`) — keep as English dev-facing strings.
- Test files (`*.spec.tsx`) — test-only literals are fine.

---

## File distribution (from `npm run i18n:verify -- --audit`)

| Domain | Files | Est. literals | Task |
|---|---:|---:|---|
| employees | 14 | ~90 | Task 1 |
| settings | 8 | ~60 | Task 2 |
| dashboard (home/widgets) | 6 | ~45 | Task 3 |
| services | 5 | ~35 | Task 4 |
| content (CMS) | 5 | ~35 | Task 5 |
| bookings | 5 | ~45 | Task 6 |
| intake-forms | 3 | ~25 | Task 7 |
| sms | 2 | ~15 | Task 8 |
| payments | 2 | ~15 | Task 9 |
| clients | 2 | ~15 | Task 10 |
| branding | 2 | ~15 | Task 11 |
| reports | 1 | ~10 | Task 12 |
| contact-messages | 1 | ~8 | Task 13 |
| branches | 1 | ~6 | Task 14 |
| shared (header, login-form, error-banner, command-palette, date-picker, page.tsx) | 6 | ~15 | Task 15 |
| **Total** | **63** | **~434** | — |

Note: 2 "other" files at top-level (`login-form.tsx`, `error-banner.tsx`, etc.) fold into Task 15.

---

## Task recipe (apply to every domain task)

Each domain task follows this exact recipe. Tasks are numbered per-domain; the steps repeat.

### Steps (checkboxes per task)

- [ ] **A. Audit** — `grep -rn $'[؀-ۿ]' <domain-files>` and list every literal with file:line + proposed key.
- [ ] **B. Keys** — add new keys to `apps/dashboard/lib/translations/ar.<domain>.ts` and `en.<domain>.ts` in matching order. Reuse existing keys where possible.
- [ ] **C. Refactor** — replace inline literals with `t('<domain>.<key>')`. Keep interpolation via `{placeholder}` syntax.
- [ ] **D. Parity** — `npm run i18n:verify` must pass.
- [ ] **E. Typecheck** — `cd apps/dashboard && npm run typecheck` (scoped) must pass.
- [ ] **F. Tests** — existing specs unaffected; run `cd apps/dashboard && npx vitest run <domain>` if specs exist for those files.
- [ ] **G. Commit** — `refactor(saas-06a): <domain> — t() literals (N files, M keys)`.
- [ ] **H. Amend plan** — check off the task box in this plan.

### Anti-patterns (STOP + document)

- Literal doesn't map to any existing `<domain>.*` bundle → propose addition to `misc` or a new bundle; do not silently dump in `misc`.
- Literal is a **dynamic template** built from user data (`${client.name}`) → extract only the fixed part, interpolate the rest.
- Literal is a **Zod `message`** for a schema shared with the backend → check if the backend already localizes this; if yes, thread the locale through the API call instead of duplicating.
- Refactor pushes a file over 350 lines → extract subcomponent in same commit.

---

## Tasks

### Task 1 — `employees` (14 files, ~90 literals) `- [ ]`
Files include employee list page, detail page, schedule editor, availability grid, role assignment dialog, certification section, etc. Target bundles: `ar.employees.ts` + `en.employees.ts`.

### Task 2 — `settings` (8 files, ~60 literals) `- [ ]`
Holidays, cancellation policy, legal content, entity tab, general tab, working hours, bank account card, (SMS settings handled in Task 8). Target bundles: `ar.settings.ts` + `en.settings.ts`.

### Task 3 — `dashboard` home + widgets (6 files, ~45 literals) `- [ ]`
`app/(dashboard)/page.tsx`, revenue chart, attention alerts, activity feed, etc. Target bundles: `ar.dashboard.ts` + `en.dashboard.ts`.

### Task 4 — `services` (5 files, ~35 literals) `- [ ]`
Services list, form, category tab, etc. Target bundles: `ar.services.ts` + `en.services.ts`.

### Task 5 — `content` (5 files, ~35 literals) `- [ ]`
CMS pages: hero, feature cards, section intros, home page editor, general content page. Target bundles: **new** `ar.content.ts` + `en.content.ts` (not present yet — propose + confirm in step H).

### Task 6 — `bookings` (5 files, ~45 literals) `- [ ]`
Booking columns, walk-in form, employee section, tab content, booking cells. Target bundles: `ar.bookings.ts` + `en.bookings.ts`.

### Task 7 — `intake-forms` (3 files, ~25 literals) `- [ ]`
Field editor, form info tab, form info panel. Target bundles: `ar.intake-forms.ts` + `en.intake-forms.ts`.

### Task 8 — `sms` (2 files, ~15 literals) `- [ ]`
SMS settings form + delivery log table (shipped in Plan 02g-sms with inline AR literals; carve out into bundles). Target bundles: **new** `ar.sms.ts` + `en.sms.ts`. This is a follow-up from 02g-sms, already called out in its status memo.

### Task 9 — `payments` (2 files, ~15 literals) `- [ ]`
Refund dialog + payment list page. Target bundles: `ar.finance.ts` + `en.finance.ts` (existing).

### Task 10 — `clients` (2 files, ~15 literals) `- [ ]`
Client detail page, client form. Target bundles: `ar.clients.ts` + `en.clients.ts`.

### Task 11 — `branding` (2 files, ~15 literals) `- [ ]`
Branding page + branding form. Target bundles: `ar.branding.ts` + `en.branding.ts`.

### Task 12 — `reports` (1 file, ~10 literals) `- [ ]`
Reports page. Target bundles: `ar.dashboard.ts` or **new** `ar.reports.ts` — propose in audit step.

### Task 13 — `contact-messages` (1 file, ~8 literals) `- [ ]`
Contact messages page. Target bundles: `ar.ops.ts` + `en.ops.ts` (existing ops bundle is closest).

### Task 14 — `branches` (1 file, ~6 literals) `- [ ]`
Branches page. Target bundles: **new** `ar.branches.ts` + `en.branches.ts`, OR fold into `ar.settings.ts` — propose.

### Task 15 — `shared` (6 files, ~15 literals) `- [ ]`
`app/(dashboard)/page.tsx`, `components/header.tsx`, `components/features/login-form.tsx`, `components/features/error-banner.tsx`, `components/features/command-palette.tsx`, `components/ui/date-picker.tsx`. Target bundles: `ar.misc.ts` + `en.misc.ts`.

### Task 16 — Verification pass `- [ ]`
- [ ] `grep -rn $'[؀-ۿ]' apps/dashboard/app apps/dashboard/components | grep -v lib/translations | grep -v node_modules` returns **0** lines outside of translation bundles (allow exceptions: design-token RTL guards, test fixtures).
- [ ] `npm run i18n:verify` green.
- [ ] Dashboard vitest full suite green.
- [ ] Dashboard typecheck green (no NEW diagnostics vs baseline).
- [ ] Screenshot the dashboard in `ar` and `en` via Chrome DevTools MCP — goldens saved under `docs/superpowers/qa/saas-06a-<date>/`.
- [ ] Kiwi manual QA sync (`data/kiwi/saas-06a-<date>.json`).

---

## Execution strategies

**Serial:** one agent works through Tasks 1→16 in order (~16 session steps).

**Parallel:** dispatch up to 3 agents across non-overlapping domain tasks. Constraints:
- Tasks 1–14 touch disjoint files → safely parallel.
- Task 5 + Task 8 + Task 12 + Task 14 may propose NEW bundles → serialize the plan-amendment step to avoid bundle-registry conflicts in `apps/dashboard/lib/translations/index.ts`.
- Task 15 (`shared`) + Task 3 (`dashboard`) both touch `app/(dashboard)/page.tsx` → serialize these two.
- Task 16 runs last, after all prior tasks merged.

Recommended: serial for the first 2–3 tasks (establish the recipe + catch edge cases), then parallel for the bulk.

---

## Non-goals

- Do not touch the mobile app or website.
- Do not localize backend error responses (separate plan).
- Do not add runtime locale detection beyond what Plan 06 shipped.
- Do not rename existing translation keys — only add new ones.
- Do not introduce `useTranslations('namespace')` (next-intl pattern) — stay on the flat `t(key)` API.

---

## Rollout

No feature flag required — refactor is behaviorally invariant. After each task: commit + push, no rollback concern. After Task 16: open a single PR `saas-06a: dashboard literal refactor` bundling all commits. Reviewer focuses on the verification pass results; individual commits can be spot-checked by domain.

---

## Checklist summary

- [ ] Task 1 employees
- [ ] Task 2 settings
- [ ] Task 3 dashboard
- [ ] Task 4 services
- [ ] Task 5 content
- [ ] Task 6 bookings
- [ ] Task 7 intake-forms
- [ ] Task 8 sms
- [ ] Task 9 payments
- [ ] Task 10 clients
- [ ] Task 11 branding
- [ ] Task 12 reports
- [ ] Task 13 contact-messages
- [ ] Task 14 branches
- [ ] Task 15 shared
- [ ] Task 16 verification
