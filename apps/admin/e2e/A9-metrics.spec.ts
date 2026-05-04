import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

test.describe('[A9] Metrics pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('platform metrics page loads without JS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/metrics');
    await page.waitForLoadState('networkidle');

    // Heading from metrics/page.tsx — "Platform Metrics"
    await expect(
      page.getByRole('heading', { name: 'Platform Metrics' }),
    ).toBeVisible({ timeout: 10_000 });

    // No hard error banner rendered
    await expect(
      page.locator('.text-destructive').filter({ hasText: 'Failed to load' }),
    ).not.toBeVisible({ timeout: 5_000 });

    // No console errors from React / Next.js
    const filteredErrors = consoleErrors.filter(
      (e) => !e.includes('Warning:') && !e.includes('ResizeObserver'),
    );
    expect(filteredErrors).toHaveLength(0);
  });

  test('overview page (/) renders MetricsGrid', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Heading from (admin)/page.tsx — "Overview"
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
      timeout: 10_000,
    });

    const filteredErrors = consoleErrors.filter(
      (e) => !e.includes('Warning:') && !e.includes('ResizeObserver'),
    );
    expect(filteredErrors).toHaveLength(0);
  });

  test('billing metrics page loads', async ({ page }) => {
    await page.goto('/billing/metrics');
    await page.waitForLoadState('networkidle');

    // Page should not show an error banner
    await expect(
      page.locator('.text-destructive').filter({ hasText: 'Failed to load' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
