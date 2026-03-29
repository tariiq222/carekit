/**
 * CareKit Dashboard — Settings Page Interaction Tests
 *
 * Verifies UI interactions on /settings:
 *   - Default tab (General or Booking) is active
 *   - Tab navigation: الحجز, الإلغاء, ساعات العمل
 *   - Form fields on General tab are visible and interactive
 *   - Save button exists and is not disabled by default
 */

import { test, expect } from '../setup/fixtures';

test.describe('Settings — default tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings');
  });

  test('a default tab is active on page load', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const activeTab = adminPage.locator('[role="tab"][data-state="active"]').first();
    await expect(activeTab).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Settings — tab navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings');
  });

  test('clicking "الحجز" tab changes content', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const tab = adminPage.getByRole('tab', { name: /الحجز/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });

  test('clicking "الإلغاء" tab changes content', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const tab = adminPage.getByRole('tab', { name: /الإلغاء/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });

  test('clicking "ساعات العمل" tab changes content', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const tab = adminPage.getByRole('tab', { name: /ساعات العمل/ });
    await expect(tab).toBeVisible({ timeout: 12_000 });
    await tab.click();

    await expect(tab).toHaveAttribute('data-state', 'active');
    const panel = adminPage.locator('[role="tabpanel"][data-state="active"]').first();
    await expect(panel).toBeVisible({ timeout: 12_000 });
  });
});

test.describe('Settings — General tab form', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings');

    // Activate the General tab if not already active
    const generalTab = adminPage.getByRole('tab', { name: /عام|General/ }).first();
    if (await generalTab.count() > 0) {
      await generalTab.click();
    }
  });

  test('form inputs are visible and interactive', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const inputs = adminPage.locator('[role="tabpanel"] input, [role="tabpanel"] textarea').first();
    await expect(inputs).toBeVisible({ timeout: 8_000 });

    // Fill a text input to confirm interactivity
    const textInput = adminPage
      .locator('[role="tabpanel"] input[type="text"], [role="tabpanel"] input:not([type])')
      .first();
    if (await textInput.count() > 0) {
      const current = await textInput.inputValue();
      await textInput.fill('test value');
      await expect(textInput).toHaveValue('test value');
      // Restore original
      await textInput.fill(current);
    }
  });

  test('save button exists and is not disabled', async ({ adminPage }) => {
    // Skip if auth expired (login form visible)
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) { test.skip(); return; }

    const saveBtn = adminPage
      .locator('[role="tabpanel"]')
      .getByRole('button', { name: /حفظ|Save/ })
      .first();
    await expect(saveBtn).toBeVisible({ timeout: 8_000 });
    await expect(saveBtn).toBeEnabled();
  });
});
