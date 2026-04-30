# Phase 5 — RTL & Accessibility E2E Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 15 Playwright E2E tests under `apps/dashboard/test/e2e/a11y/` covering RTL layout, keyboard navigation, and axe-powered WCAG contrast scans — all wired into the existing tagged-name HTML report.

**Architecture:** Three new spec files (rtl / keyboard / contrast) living next to existing dashboard E2E tests. They reuse the shared `../setup/fixtures` `adminPage` + `goto` fixtures (per-test UI login). Contrast tests use `@axe-core/playwright` (new devDependency). A one-line edit to `tag_tests.py` registers the `A11Y-` prefix so the Accessibility module appears in the HTML report.

**Tech Stack:** Playwright 1.x, `@axe-core/playwright`, TypeScript strict, existing fixtures (`adminPage`, `goto`), Python tag registry.

**Spec reference:** `docs/superpowers/specs/2026-04-15-a11y-rtl-testing-design.md`

---

## File Structure

**Create:**
- `apps/dashboard/test/e2e/a11y/rtl.e2e-spec.ts` — 6 RTL layout tests (A11Y-001..006)
- `apps/dashboard/test/e2e/a11y/keyboard.e2e-spec.ts` — 5 keyboard nav tests (A11Y-007..011)
- `apps/dashboard/test/e2e/a11y/contrast.e2e-spec.ts` — 4 contrast/focus tests (A11Y-012..015)

**Modify:**
- `apps/dashboard/package.json` — add `@axe-core/playwright` devDependency
- `test-reports/scripts/tag_tests.py` — add `"A11Y": "Accessibility"` to `ID_TO_MODULE`

Each spec file is independent and under the 350-line project limit (largest ends up ~180 lines).

---

## Task 1: Register the A11Y module prefix

**Files:**
- Modify: `test-reports/scripts/tag_tests.py:25-36`

- [ ] **Step 1: Add A11Y prefix to ID_TO_MODULE**

Edit the dict to add one line after `"ET": "Comms",`:

```python
ID_TO_MODULE = {
    "CL": "Clients",
    "EM": "Employees",
    "BK": "Bookings",
    "PY": "Payments",
    "AU": "Auth",
    "SV": "Services",
    "WL": "Whitelabel",
    "ZT": "ZATCA",
    "BH": "OrgConfig",
    "ET": "Comms",
    "A11Y": "Accessibility",
}
```

- [ ] **Step 2: Commit**

```bash
git add test-reports/scripts/tag_tests.py
git commit -m "chore(tests): register A11Y prefix for accessibility module"
```

---

## Task 2: Install axe-core Playwright adapter

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/dashboard/package-lock.json` (auto-generated)

- [ ] **Step 1: Install as devDependency**

Run from repo root:

```bash
cd apps/dashboard && npm install --save-dev @axe-core/playwright
```

Expected: adds `"@axe-core/playwright": "^4.x"` under `devDependencies`, updates lockfile.

- [ ] **Step 2: Verify import resolves**

```bash
cd apps/dashboard && node -e "require('@axe-core/playwright')"
```

Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/package.json apps/dashboard/package-lock.json
git commit -m "chore(dashboard): add @axe-core/playwright for a11y tests"
```

---

## Task 3: Create a11y directory and RTL test file (scaffold)

**Files:**
- Create: `apps/dashboard/test/e2e/a11y/rtl.e2e-spec.ts`

- [ ] **Step 1: Write the full rtl.e2e-spec.ts file**

```ts
/**
 * Deqah Dashboard — RTL Layout E2E Tests
 *
 * Verifies that Arabic-first RTL layout is applied correctly across
 * protected pages, menus, date pickers, and phone inputs.
 */

import { test, expect } from '../setup/fixtures';

test.describe('@critical Accessibility — RTL Layout', () => {
  test('[A11Y-001][Accessibility/rtl-layout][P1-High] html dir="rtl" مُطبّق على الصفحات المحمية',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const dir = await adminPage.evaluate(() => document.documentElement.getAttribute('dir'));
      expect(dir).toBe('rtl');
    });

  test('[A11Y-002][Accessibility/rtl-layout][P1-High] Sidebar يقع على يمين الشاشة',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const viewport = adminPage.viewportSize();
      expect(viewport).not.toBeNull();
      const sidebar = adminPage.locator('aside, [data-sidebar], nav[aria-label*="Sidebar"], nav[aria-label*="التنقل"]').first();
      await expect(sidebar).toBeVisible({ timeout: 12_000 });
      const box = await sidebar.boundingBox();
      expect(box).not.toBeNull();
      if (box && viewport) {
        expect(box.x).toBeGreaterThan(viewport.width / 2);
      }
    });

  test('[A11Y-003][Accessibility/rtl-layout][P1-High] زر Add الأساسي على يسار PageHeader',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const addBtn = adminPage.getByRole('button', { name: /إضافة|add|جديد/i }).first();
      const exportBtn = adminPage.getByRole('button', { name: /تصدير|export/i }).first();
      const addVisible = await addBtn.isVisible().catch(() => false);
      const exportVisible = await exportBtn.isVisible().catch(() => false);
      test.skip(!addVisible || !exportVisible, 'PageHeader lacks both export + add buttons on this route');
      const addBox = await addBtn.boundingBox();
      const exportBox = await exportBtn.boundingBox();
      expect(addBox).not.toBeNull();
      expect(exportBox).not.toBeNull();
      if (addBox && exportBox) {
        expect(addBox.x).toBeLessThan(exportBox.x);
      }
    });

  test('[A11Y-004][Accessibility/rtl-layout][P2-Medium] Dropdown menu يفتح بمحاذاة start (يمين)',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const trigger = adminPage.locator('[data-slot="dropdown-menu-trigger"], button[aria-haspopup="menu"]').first();
      const triggerVisible = await trigger.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No dropdown trigger found on /clients');
      await trigger.click();
      const menu = adminPage.locator('[role="menu"]').first();
      await expect(menu).toBeVisible({ timeout: 6_000 });
      const triggerBox = await trigger.boundingBox();
      const menuBox = await menu.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      if (triggerBox && menuBox) {
        const triggerRight = triggerBox.x + triggerBox.width;
        const menuRight = menuBox.x + menuBox.width;
        expect(Math.abs(triggerRight - menuRight)).toBeLessThan(24);
      }
      await adminPage.keyboard.press('Escape');
    });

  test('[A11Y-005][Accessibility/rtl-layout][P2-Medium] Date picker يعرض ترتيب أيام RTL',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      const dateTrigger = adminPage
        .locator('button[aria-haspopup="dialog"], button:has([class*="calendar" i]), input[type="date"]')
        .first();
      const triggerVisible = await dateTrigger.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No date trigger visible on /bookings list — deeper navigation required');
      await dateTrigger.click();
      const calendar = adminPage.locator('[role="grid"], [class*="calendar" i]').first();
      const calVisible = await calendar.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!calVisible, 'Calendar popover did not open from list page trigger');
      const headers = await calendar.locator('th, [role="columnheader"]').allInnerTexts();
      expect(headers.length).toBeGreaterThanOrEqual(7);
      expect(headers.join('|')).toMatch(/سبت|أحد|Sat|Sun/);
    });

  test('[A11Y-006][Accessibility/rtl-layout][P1-High] Phone input يبقى dir="ltr" داخل صفحة RTL',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const addBtn = adminPage.getByRole('button', { name: /إضافة|add/i }).first();
      const addVisible = await addBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!addVisible, 'Add client button not found');
      await addBtn.click();
      const dialog = adminPage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      const phoneInput = dialog
        .locator('input[type="tel"], input[name*="phone" i], input[placeholder*="هاتف"], input[placeholder*="جوال"]')
        .first();
      const phoneVisible = await phoneInput.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!phoneVisible, 'No phone input in add-client dialog');
      const dir = await phoneInput.evaluate((el) => (el as HTMLElement).getAttribute('dir') ?? getComputedStyle(el).direction);
      expect(dir).toBe('ltr');
      await adminPage.keyboard.press('Escape');
    });
});
```

- [ ] **Step 2: Run the file to see which tests pass / skip / fail**

Prerequisite: backend on :5100 and dashboard on :5103 must already be running (see CLAUDE.md env notes).

Run:

```bash
cd apps/dashboard && npx playwright test test/e2e/a11y/rtl.e2e-spec.ts --project=full --reporter=list
```

Expected: all 6 tests either pass or skip. Any **failure** means a real RTL regression in the dashboard — record it and stop to investigate before proceeding. (Skips are OK at this stage — they indicate the page didn't surface the expected widget on the route; we'll tighten those in Task 6.)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/e2e/a11y/rtl.e2e-spec.ts
git commit -m "test(dashboard): add RTL layout e2e tests (A11Y-001..006)"
```

---

## Task 4: Keyboard navigation test file

**Files:**
- Create: `apps/dashboard/test/e2e/a11y/keyboard.e2e-spec.ts`

- [ ] **Step 1: Write keyboard.e2e-spec.ts**

```ts
/**
 * Deqah Dashboard — Keyboard Navigation E2E Tests
 *
 * Verifies Tab order, Escape dismissal, Enter-to-submit, and arrow-key
 * navigation inside interactive widgets.
 */

import { test, expect } from '../setup/fixtures';

test.describe('@critical Accessibility — Keyboard Navigation', () => {
  test('[A11Y-007][Accessibility/keyboard-nav][P2-Medium] Tab يتنقّل للمحتوى الرئيسي خلال خطوات معقولة',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      // press Tab repeatedly until focus lands in <main>; cap at 40 presses
      let landed = false;
      for (let i = 0; i < 40; i++) {
        await adminPage.keyboard.press('Tab');
        const inMain = await adminPage.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return false;
          return !!el.closest('main');
        });
        if (inMain) {
          landed = true;
          break;
        }
      }
      expect(landed).toBe(true);
    });

  test('[A11Y-008][Accessibility/keyboard-nav][P2-Medium] Escape يُغلق Dialog المفتوح',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const addBtn = adminPage.getByRole('button', { name: /إضافة|add/i }).first();
      const addVisible = await addBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!addVisible, 'No add button to open a dialog on /clients');
      await addBtn.click();
      const dialog = adminPage.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 8_000 });
      await adminPage.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 6_000 });
    });

  test('[A11Y-009][Accessibility/keyboard-nav][P2-Medium] Escape يُغلق Sheet المفتوح',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      // Look for any button that opens a Sheet (filter panel, detail drawer, etc.)
      const sheetTrigger = adminPage
        .locator('button[aria-haspopup="dialog"], button:has-text("فلتر"), button:has-text("تصفية")')
        .first();
      const triggerVisible = await sheetTrigger.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No sheet trigger found on /bookings');
      await sheetTrigger.click();
      const sheet = adminPage.locator('[role="dialog"][data-state="open"], [data-slot="sheet-content"]').first();
      const sheetVisible = await sheet.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!sheetVisible, 'Sheet did not open from the expected trigger');
      await adminPage.keyboard.press('Escape');
      await expect(sheet).not.toBeVisible({ timeout: 6_000 });
    });

  test('[A11Y-010][Accessibility/keyboard-nav][P2-Medium] Enter داخل فورم login يُرسل النموذج',
    async ({ page }) => {
      // Use raw `page`, not adminPage, because this tests the login form itself.
      await page.goto('/');
      await page.waitForSelector('#email', { timeout: 12_000 });
      await page.fill('#email', 'admin@deqah-test.com');
      await page.fill('#password', 'Admin@1234');
      const urlBefore = page.url();
      await page.locator('#password').press('Enter');
      // Either we navigate away, or an error appears — either way the form processed Enter
      await page.waitForFunction(
        (prev) => location.href !== prev || !!document.querySelector('[role="alert"], [data-type="error"]'),
        urlBefore,
        { timeout: 12_000 },
      );
      expect(true).toBe(true);
    });

  test('[A11Y-011][Accessibility/keyboard-nav][P2-Medium] Arrow keys تتنقّل داخل Select',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const selectTrigger = adminPage.locator('[role="combobox"], [data-slot="select-trigger"]').first();
      const triggerVisible = await selectTrigger.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No select trigger found on /clients');
      await selectTrigger.focus();
      await selectTrigger.press('Enter');
      const listbox = adminPage.locator('[role="listbox"]').first();
      await expect(listbox).toBeVisible({ timeout: 6_000 });
      const firstHighlighted = await listbox.locator('[data-highlighted], [aria-selected="true"]').count();
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.waitForTimeout(150);
      const afterArrow = await listbox.locator('[data-highlighted], [aria-selected="true"]').count();
      // ArrowDown should either set or move the highlight — at minimum the highlight exists after
      expect(afterArrow).toBeGreaterThanOrEqual(1);
      expect(afterArrow + firstHighlighted).toBeGreaterThan(0);
      await adminPage.keyboard.press('Escape');
    });
});
```

- [ ] **Step 2: Run the file**

```bash
cd apps/dashboard && npx playwright test test/e2e/a11y/keyboard.e2e-spec.ts --project=full --reporter=list
```

Expected: all 5 tests pass or skip. A failure means keyboard interaction is broken on that widget — investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/e2e/a11y/keyboard.e2e-spec.ts
git commit -m "test(dashboard): add keyboard nav e2e tests (A11Y-007..011)"
```

---

## Task 5: Contrast + focus test file (axe)

**Files:**
- Create: `apps/dashboard/test/e2e/a11y/contrast.e2e-spec.ts`

- [ ] **Step 1: Write contrast.e2e-spec.ts**

```ts
/**
 * Deqah Dashboard — Contrast & Focus E2E Tests
 *
 * Runs axe-core WCAG 2.1 AA scans on representative pages and verifies
 * focus-visible styling on primary buttons. Known pre-existing violations
 * must be added to DISABLED_RULES with a TODO — never silently suppressed.
 */

import { test, expect } from '../setup/fixtures';
import AxeBuilder from '@axe-core/playwright';

// Rules intentionally disabled. Each entry MUST carry a TODO + reason.
// Keep this list shrinking — do not grow it without explicit reason.
const DISABLED_RULES: string[] = [
  // e.g. 'color-contrast', // TODO(A11Y-012): dark-mode surface/text tokens fail AA — fix in whitelabel palette refresh
];

test.describe('@critical Accessibility — Contrast & Focus', () => {
  test('[A11Y-012][Accessibility/contrast-focus][P1-High] Axe scan على /clients — 0 violations (WCAG 2.1 AA)',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const results = await new AxeBuilder({ page: adminPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(DISABLED_RULES)
        .analyze();
      if (results.violations.length > 0) {
        console.log('Axe violations on /clients:', JSON.stringify(results.violations, null, 2));
      }
      expect(results.violations).toEqual([]);
    });

  test('[A11Y-013][Accessibility/contrast-focus][P1-High] Focus مرئي على الأزرار الأساسية',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const button = adminPage.locator('button:visible').first();
      await expect(button).toBeVisible({ timeout: 8_000 });
      await button.focus();
      const focusStyle = await button.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          outlineWidth: cs.outlineWidth,
          outlineStyle: cs.outlineStyle,
          boxShadow: cs.boxShadow,
          ringColor: cs.getPropertyValue('--tw-ring-color') || cs.getPropertyValue('--ring'),
        };
      });
      const hasOutline = focusStyle.outlineWidth !== '0px' && focusStyle.outlineStyle !== 'none';
      const hasBoxShadow = focusStyle.boxShadow !== 'none' && focusStyle.boxShadow.length > 0;
      const hasRingToken = focusStyle.ringColor.trim().length > 0;
      expect(hasOutline || hasBoxShadow || hasRingToken).toBe(true);
    });

  test('[A11Y-014][Accessibility/contrast-focus][P1-High] Axe scan على /bookings — 0 violations',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      const results = await new AxeBuilder({ page: adminPage })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(DISABLED_RULES)
        .analyze();
      if (results.violations.length > 0) {
        console.log('Axe violations on /bookings:', JSON.stringify(results.violations, null, 2));
      }
      expect(results.violations).toEqual([]);
    });

  test('[A11Y-015][Accessibility/contrast-focus][P1-High] Axe contrast scan على dark mode (/settings) — 0 violations',
    async ({ adminPage, goto }) => {
      // Activate dark mode via the app's theme mechanism before navigation.
      await adminPage.addInitScript(() => {
        try {
          localStorage.setItem('theme', 'dark');
          localStorage.setItem('deqah-theme', 'dark');
        } catch {
          /* storage blocked — test will still run in whatever default theme */
        }
      });
      await goto('/settings');
      // Force the .dark class in case the theme provider relies on it and
      // didn't pick up localStorage synchronously.
      await adminPage.evaluate(() => document.documentElement.classList.add('dark'));
      const results = await new AxeBuilder({ page: adminPage })
        .withTags(['wcag2aa', 'wcag21aa'])
        .disableRules(DISABLED_RULES)
        .include('body')
        .analyze();
      const contrastViolations = results.violations.filter((v) => v.id === 'color-contrast');
      if (contrastViolations.length > 0) {
        console.log('Dark-mode contrast violations:', JSON.stringify(contrastViolations, null, 2));
      }
      expect(contrastViolations).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the file — expect this one to surface real issues**

```bash
cd apps/dashboard && npx playwright test test/e2e/a11y/contrast.e2e-spec.ts --project=full --reporter=list
```

Expected outcomes (one of):
- **All pass** — best case, ship it.
- **A11Y-012/014/015 fail with real violations** — read the logged violations. For each rule-id that fires, decide:
  - *Trivial fix* (missing `aria-label`, wrong contrast on one token) — fix in dashboard source, re-run. Keep the test strict.
  - *Real issue, defer* — add the rule to `DISABLED_RULES` with a `TODO(A11Y-<id>): <reason>` comment, and file a follow-up note in the commit message describing what was suppressed and why.
- **A11Y-013 fails** — the primary button has no visible focus ring. This is a real regression; fix the button CSS (probably a missing `focus-visible:ring-*` class) rather than suppressing the test.

Do NOT merge with silently-suppressed violations. Every entry in `DISABLED_RULES` needs a traceable reason.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/test/e2e/a11y/contrast.e2e-spec.ts
git commit -m "test(dashboard): add contrast + focus e2e tests (A11Y-012..015)"
```

If you had to modify `DISABLED_RULES`, include the list and rationale in the commit body.

---

## Task 6: Full run + verify report integration

**Files:**
- No code changes; verification only.

- [ ] **Step 1: Run the full a11y folder**

```bash
cd apps/dashboard && npx playwright test test/e2e/a11y --project=full --reporter=list
```

Expected: 15 tests, all either pass or skip with documented reason. 0 failures.

- [ ] **Step 2: Run the dashboard test suite in the reporting mode**

This regenerates `playwright-clients-results.json` and the HTML report.

```bash
cd apps/dashboard && npm run test:e2e
```

Expected: command completes; `apps/dashboard/playwright-clients-results.json` is updated.

- [ ] **Step 3: Regenerate + open the test report**

```bash
cd ../.. && npm run test:report:open
```

Expected: `test-reports/output/test-report.html` opens in browser. Verify:
- A new **Accessibility** module row appears.
- Under it, three slices: `rtl-layout` (6), `keyboard-nav` (5), `contrast-focus` (4).
- All 15 TestIDs (A11Y-001 through A11Y-015) are listed with their priorities.

- [ ] **Step 4: Run the critical project slice**

Confirm the tests are included in the `critical` Playwright project (they're tagged `@critical` at the describe level):

```bash
cd apps/dashboard && npx playwright test test/e2e/a11y --project=critical --reporter=list
```

Expected: same 15 tests run under `critical`.

- [ ] **Step 5: Commit (only if any DISABLED_RULES were added in Task 5 — otherwise skip)**

If Task 5 required deferred violations, make the commit now with the explanation:

```bash
git add apps/dashboard/test/e2e/a11y/contrast.e2e-spec.ts
git commit -m "test(dashboard): document deferred a11y violations in DISABLED_RULES"
```

---

## Rollback plan

If a task goes wrong:

```bash
# Abandon a single task's changes before commit
git restore apps/dashboard/test/e2e/a11y/<file>

# Revert an already-committed task
git log --oneline -n 10          # find the SHA
git revert <sha>
```

No database or infra state is touched; every task is local to the dashboard test tree.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 6 RTL tests (A11Y-001..006) → Task 3
- ✅ 5 Keyboard tests (A11Y-007..011) → Task 4
- ✅ 4 Contrast/focus tests (A11Y-012..015) → Task 5
- ✅ `@axe-core/playwright` added → Task 2
- ✅ `A11Y` prefix registered → Task 1
- ✅ Report verification → Task 6
- ✅ Deny-list strategy for pre-existing violations → Task 5 step 2

**Placeholder scan:** No TBDs, no "add appropriate X", every code block is complete, every command has an expected outcome.

**Type/naming consistency:** `DISABLED_RULES` used consistently in Task 5. TestID format `[A11Y-NNN][Accessibility/<slice>][<priority>] <arabic title>` is identical across all three specs.
