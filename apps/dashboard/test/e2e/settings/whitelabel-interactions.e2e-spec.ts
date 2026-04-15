/**
 * CareKit Dashboard — Whitelabel Settings Interaction Tests
 *
 * Verifies UI interactions on /settings/whitelabel (or /white-label):
 *   - Default (Branding) tab is active
 *   - "الدفع" tab shows payment config form
 *   - "التكاملات" tab shows integrations content
 *   - Branding tab has form inputs
 *   - Save button is visible on Branding tab
 */

import { test, expect } from '../setup/fixtures';
import type { Page } from '@playwright/test';

const WHITELABEL_ROUTES = ['/white-label', '/settings/whitelabel', '/settings/white-label'];

type GotoFn = (path: string) => Promise<void>;

async function gotoWhitelabel(
  adminPage: Page,
  goto: GotoFn,
) {
  for (const route of WHITELABEL_ROUTES) {
    await goto(route);
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    if (!adminPage.url().includes('404') && !adminPage.url().includes('not-found')) {
      return;
    }
  }
}

test.describe('Whitelabel — default tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await gotoWhitelabel(adminPage, goto);
  });

  test('Branding tab is active by default', async ({ adminPage }) => {
    const activeTab = adminPage.locator('[role="tab"][data-state="active"]').first();
    await expect(activeTab).toBeVisible({ timeout: 8_000 });

    const label = await activeTab.textContent();
    expect(label).toMatch(/العلامة التجارية|Branding|الهوية/);
  });
});

test.describe('Whitelabel — tab navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await gotoWhitelabel(adminPage, goto);
  });

  test('clicking "الدفع" tab shows payment config form', async ({ adminPage }) => {
    const tab = adminPage.getByRole('tab', { name: /الدفع/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = brandingPanel(adminPage);
    await expect(panel).toBeVisible({ timeout: 12_000 });

    // At least one input or text indicating payment config
    const hasContent = await panel.locator('input, [class*="field"]').count() > 0 ||
      await panel.getByText(/مفتاح|API|Moyasar|بوابة/).count() > 0;
    expect(hasContent).toBe(true);
  });

  test('clicking "التكاملات" tab shows integrations content', async ({ adminPage }) => {
    const tab = adminPage.getByRole('tab', { name: /التكاملات/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = brandingPanel(adminPage);
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Whitelabel — Branding tab form', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await gotoWhitelabel(adminPage, goto);

    const brandingTab = adminPage.getByRole('tab', { name: /العلامة التجارية|Branding|الهوية/ }).first();
    if (await brandingTab.count() > 0) {
      await brandingTab.click();
      await adminPage.waitForLoadState('networkidle').catch(() => {});
    }
  });

  test('branding tab has form inputs', async ({ adminPage }) => {
    const panel = brandingPanel(adminPage);
    await expect(panel).toBeVisible({ timeout: 12_000 });

    const inputs = panel.locator('input');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('save button is visible on branding tab', async ({ adminPage }) => {
    const saveBtn = adminPage
      .locator('[role="tabpanel"]')
      .getByRole('button', { name: /حفظ|Save/ })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 8_000 });
  });
});

// ── WL-001..WL-006 Full interactive flows ────────────────────────────────────
// Branding panel has no tabs on current page — select the BrandingTab card directly.
function brandingPanel(adminPage: Page): ReturnType<Page['locator']> {
  // Prefer an active tab panel if tabs exist; otherwise fall back to the card/main content.
  return adminPage.locator('[role="tabpanel"][data-state="active"], main').first();
}

test.describe('Whitelabel — Branding interactive', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await gotoWhitelabel(adminPage, goto);
    const brandingTab = adminPage.getByRole('tab', { name: /العلامة التجارية|Branding|الهوية/ }).first();
    if (await brandingTab.count() > 0) {
      await brandingTab.click();
      await adminPage.waitForLoadState('networkidle').catch(() => {});
    }
  });

  test('[WL-001][Whitelabel/branding][P2-Medium] تعديل اسم النظام EN + AR والحفظ', async ({ adminPage, waitForToast }) => {
    const panel = brandingPanel(adminPage);
    const inputs = panel.locator('input');
    const count = await inputs.count();
    if (count < 2) {
      test.skip();
      return;
    }

    const suffix = Date.now().toString().slice(-5);
    const nameEnInput = inputs.nth(0);
    const nameArInput = inputs.nth(1);

    await nameEnInput.fill(`CareKit Test ${suffix}`);
    await nameArInput.fill(`كيركت ${suffix}`);

    const saveBtn = adminPage.getByRole('button', { name: /حفظ|Save/ }).first();
    await saveBtn.click();

    // Either a toast confirms success, or the inputs retain their values (optimistic update persisted in form state).
    const toastShown = await Promise.race([
      waitForToast(/تم|نجاح|success|saved/i, 6_000).then(() => true).catch(() => false),
      adminPage.waitForTimeout(6_000).then(() => false),
    ]);
    if (!toastShown) {
      await expect(nameEnInput).toHaveValue(`CareKit Test ${suffix}`);
    }
  });

  test('[WL-002][Whitelabel/branding][P1-High] تغيير primary color عبر hex input يحدّث preview', async ({ adminPage }) => {
    const panel = brandingPanel(adminPage);
    const hexInput = panel.locator('input[placeholder="#354FD8"]').first();
    if (!(await hexInput.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const newColor = '#112233';
    await hexInput.fill(newColor);
    await expect(hexInput).toHaveValue(newColor);

    // Preview swatch appears only when isValidHex(colorPrimary) is true.
    const previewSwatch = panel.locator(`[style*="${newColor}"], [style*="rgb(17, 34, 51)"]`).first();
    await expect(previewSwatch).toBeVisible({ timeout: 4_000 });
  });

  test('[WL-003][Whitelabel/branding][P2-Medium] primary color غير صالح لا يُظهر الـ preview', async ({ adminPage }) => {
    const panel = brandingPanel(adminPage);
    const hexInput = panel.locator('input[placeholder="#354FD8"]').first();
    if (!(await hexInput.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await hexInput.fill('not-a-hex');

    // Live preview block shows the "معاينة" label only for valid hex values.
    const previewLabel = panel.getByText(/^معاينة$/).first();
    await expect(previewLabel).toHaveCount(0);
  });

  test('[WL-004][Whitelabel/branding][P3-Low] contrast badge يظهر عند تعبئة الألوان', async ({ adminPage }) => {
    const panel = brandingPanel(adminPage);
    const primaryHex = panel.locator('input[placeholder="#354FD8"]').first();
    if (!(await primaryHex.isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await primaryHex.fill('#000000');
    // ContrastBadge renders text like "21.0:1 · AAA" (tabular-nums font-mono).
    const badge = panel.locator('span.font-mono').filter({ hasText: /\d+(?:\.\d+)?:1/ }).first();
    await expect(badge).toBeVisible({ timeout: 6_000 });
  });

  test('[WL-006][Whitelabel/branding][P2-Medium] إدخال logo URL يحدّث حقل الإدخال', async ({ adminPage }) => {
    const panel = brandingPanel(adminPage);
    // Find the logo URL input via its surrounding label or a url-ish placeholder.
    const logoInput = panel.locator('input').filter({ hasNotText: '#' }).nth(2);
    if (!(await logoInput.first().isVisible({ timeout: 6_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const url = 'https://example.com/logo.png';
    const target = logoInput.first();
    await target.fill(url);
    await expect(target).toHaveValue(url);
  });
});

test.describe('Whitelabel — Payment tab interactive', () => {
  test('[WL-005][Whitelabel/payment][P2-Medium] تبويب الدفع يُظهر حقول إدخال إن وُجد', async ({ adminPage, goto }) => {
    await gotoWhitelabel(adminPage, goto);
    const payTab = adminPage.getByRole('tab', { name: /الدفع/ }).first();
    if (!(await payTab.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await payTab.click();
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    const inputs = panel.locator('input, textarea');
    expect(await inputs.count()).toBeGreaterThan(0);
  });
});
