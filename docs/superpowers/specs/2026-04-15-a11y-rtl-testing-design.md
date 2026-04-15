# Phase 5 — RTL & Accessibility E2E Tests

**Date:** 2026-04-15
**Owner:** test-writer + dashboard-dev
**Duration estimate:** 2 days
**New tests:** 15 (across 3 files)

## Goal

Add an E2E safety net for three accessibility pillars that currently have no automated coverage:

1. **RTL layout correctness** — the Arabic-first layout rule is a Golden Rule in `CLAUDE.md`; any regression (a hardcoded `left-*`, a missing `dir` attribute, a misaligned menu) breaks the primary user experience.
2. **Keyboard navigation** — receptionists use the dashboard all day; broken tab order or trapped focus kills productivity.
3. **Color contrast and focus visibility** — WCAG 2.1 AAA is the stated target; without automated scans, regressions slip through with every design tweak.

Tests live under `apps/dashboard/test/e2e/a11y/` and feed the existing HTML report via tagged names.

## Non-goals

- Unit-level a11y (ARIA attribute correctness on individual components) — covered separately if needed.
- Screen-reader output validation — out of scope; axe covers the static subset.
- Mobile app a11y — Expo has its own test setup.
- Fixing pre-existing a11y violations surfaced by axe — those get logged as follow-ups, not fixed in this phase.

## Architecture

```
apps/dashboard/test/e2e/a11y/
├── rtl.e2e-spec.ts         6 tests  (A11Y-001..006)
├── keyboard.e2e-spec.ts    5 tests  (A11Y-007..011)
└── contrast.e2e-spec.ts    4 tests  (A11Y-012..015)
```

All three files follow the existing Playwright fixture pattern (`../setup/fixtures`) — `adminPage` gives an authenticated page, `goto` navigates with auth already applied.

Test-name format (mandatory for the HTML report generator):

```ts
test('[A11Y-001][Accessibility/rtl-layout][P1-High] html dir="rtl" مُطبّق على الصفحات المحمية',
  async ({ adminPage, goto }) => { ... });
```

All three files are tagged `@critical` at the describe level so they run in the `critical` Playwright project before each deploy.

## Test matrix

### `rtl.e2e-spec.ts` — RTL Layout (6 tests)

| ID | Slice | Priority | Behavior under test |
|----|-------|----------|---------------------|
| A11Y-001 | `rtl-layout` | P1-High | `document.documentElement.getAttribute('dir') === 'rtl'` on `/clients` |
| A11Y-002 | `rtl-layout` | P1-High | Sidebar `getBoundingClientRect().x > viewport.width / 2` |
| A11Y-003 | `rtl-layout` | P1-High | PageHeader primary button is the leftmost action (RTL end side) — bounding box `.x` < export button `.x` |
| A11Y-004 | `rtl-layout` | P2-Medium | DropdownMenu trigger on `/clients` opens aligned to `start` (menu's right edge ≈ trigger's right edge, within 8px) |
| A11Y-005 | `rtl-layout` | P2-Medium | Date picker in booking create: weekday headers reversed, first column = السبت |
| A11Y-006 | `rtl-layout` | P1-High | Phone input inside RTL form still has `dir="ltr"` so digits display left-to-right |

### `keyboard.e2e-spec.ts` — Keyboard Navigation (5 tests)

| ID | Slice | Priority | Behavior under test |
|----|-------|----------|---------------------|
| A11Y-007 | `keyboard-nav` | P2-Medium | After 3× Tab from `/clients`, focus is inside the main content region, not stuck on sidebar |
| A11Y-008 | `keyboard-nav` | P2-Medium | Open "Add Client" Dialog → press Escape → Dialog unmounts, trigger regains focus |
| A11Y-009 | `keyboard-nav` | P2-Medium | Open a Sheet (e.g. client detail) → Escape closes it |
| A11Y-010 | `keyboard-nav` | P2-Medium | Inside login form: focus email, type, Tab, type password, Enter → submits (URL changes or error banner appears) |
| A11Y-011 | `keyboard-nav` | P2-Medium | Open a Select → ArrowDown moves `aria-activedescendant` / highlighted option |

### `contrast.e2e-spec.ts` — Contrast & Focus (4 tests)

| ID | Slice | Priority | Behavior under test |
|----|-------|----------|---------------------|
| A11Y-012 | `contrast-focus` | P1-High | `AxeBuilder().withTags(['wcag2aa']).analyze()` on `/clients` returns `violations.length === 0` (excluding known-suppressed rules, see below) |
| A11Y-013 | `contrast-focus` | P1-High | Programmatic focus on `[data-slot="button"]` → `getComputedStyle().outlineWidth !== '0px'` OR a ring custom property resolves to non-transparent |
| A11Y-014 | `contrast-focus` | P1-High | Axe scan on `/bookings`, same criteria |
| A11Y-015 | `contrast-focus` | P1-High | Toggle dark mode (set `localStorage.theme = 'dark'`, reload), axe scan on `/settings` — 0 `color-contrast` violations |

## Dependencies

- **New devDependency:** `@axe-core/playwright` — WCAG scanner. Add to `apps/dashboard/package.json`.
- **No runtime changes** to dashboard source code. Tests only.

## Tag registration

Add one entry to `test-reports/scripts/tag_tests.py` in the `ID_TO_MODULE` dict:

```python
'A11Y': 'Accessibility',
```

This makes the Accessibility module appear in the HTML report with three slices (rtl-layout, keyboard-nav, contrast-focus) as rows.

## Pre-existing violations — strategy

Axe scans (A11Y-012, -014, -015) will likely surface violations in the current codebase — missing `aria-label` on icon buttons, insufficient contrast in a dark-mode state, etc. The protocol:

1. Run each axe scan once during test authoring.
2. Record every violation rule-id and where it fires.
3. For each violation, decide:
   - **Easy fix (< 10 lines)** — fix it in a small follow-up commit, keep the test strict.
   - **Real issue, deferred** — add the rule to `.disableRules([...])` with a `// TODO(A11Y-<id>): re-enable after <issue-ref>` comment. Log the issue separately so it's visible.
4. Never silently pass violations by disabling rules without a TODO. The goal is a known, shrinking deny-list, not a permanent one.

This keeps the Phase 5 PR reviewable while making existing issues visible.

## Execution notes

- Login is handled by the shared `adminPage` fixture — no new auth setup.
- Sidebar-position and menu-alignment assertions use `boundingBox()` with a tolerance (±4-8px) to survive sub-pixel rounding.
- Dark-mode toggle in A11Y-015 uses whatever the dashboard's current theme mechanism is (localStorage key or `class="dark"` on `<html>`) — to be verified against the theme provider during implementation, not pre-specified here.
- Date picker assertion (A11Y-005) depends on the calendar library in use at `components/features/bookings/*` — the test inspects rendered DOM, not library internals.

## Out of scope / follow-ups

- Running axe across every route (only 3 representative pages covered here — expanding to a parameterized sweep is a future phase).
- Fixing violations surfaced by axe (tracked as separate tickets).
- Reduced-motion preference testing.
- Screen reader / NVDA output.

## Success criteria

- 15 new tests registered and passing (with documented deny-list for any deferred axe violations).
- Accessibility module appears in `test-reports/output/test-report.html` with 3 slices.
- `@critical` project run includes the new tests.
- No changes to existing test files or dashboard source code (beyond the `package.json` devDep bump and the `tag_tests.py` one-liner).
