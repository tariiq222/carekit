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
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
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
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
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
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
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
