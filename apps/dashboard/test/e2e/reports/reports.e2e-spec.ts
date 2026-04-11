/**
 * CareKit Dashboard — Reports Page E2E Tests
 */

import { test, expect } from '../setup/fixtures';

test.describe('Reports page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/reports/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('التقارير').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows revenue tab by default', async ({ adminPage }) => {
    await expect(adminPage.getByText('الإيرادات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows export CSV button', async ({ adminPage }) => {
    await expect(adminPage.getByText('تصدير CSV').first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders revenue chart or stats section', async ({ adminPage }) => {
    // Revenue stats or chart container
    const statsOrChart = adminPage.locator('[class*="chart"], [class*="stat"], [class*="grid"]');
    await expect(statsOrChart.first()).toBeVisible({ timeout: 12_000 });
  });
});
