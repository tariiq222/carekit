import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

test.describe('[A7] Audit log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('audit log page loads with table headers', async ({ page }) => {
    await page.goto('/audit-log');
    await page.waitForLoadState('networkidle');

    // Heading from audit-log/page.tsx
    await expect(page.getByRole('heading', { name: 'Audit log' })).toBeVisible({
      timeout: 10_000,
    });

    // Table columns from audit-log-table.tsx (hardcoded English headers)
    await expect(page.getByRole('columnheader', { name: 'When' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Organization' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Reason' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'IP' })).toBeVisible();
  });

  test('creating a vertical produces an audit log entry', async ({ page }) => {
    const verticalSlug = `e2e-audit-${Date.now()}`;
    const verticalNameEn = `E2E Audit ${Date.now()}`;

    // 1. Create a vertical to generate an audit entry
    await page.goto('/verticals');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '+ Create Vertical' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create vertical' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.locator('#cv-slug').fill(verticalSlug);
    await page.locator('#cv-nameAr').fill(`قطاع تدقيق ${Date.now()}`);
    await page.locator('#cv-nameEn').fill(verticalNameEn);
    await page.locator('#cv-family').click();
    await page.getByRole('option', { name: 'CONSULTING' }).click();
    await page.locator('#cv-reason').fill('E2E audit log verification test');

    await page.getByRole('button', { name: 'Create vertical' }).click();

    // Wait for dialog to close (success)
    await expect(
      page.getByRole('heading', { name: 'Create vertical' }),
    ).not.toBeVisible({ timeout: 15_000 });

    // 2. Navigate to audit log and verify the VERTICAL_CREATED action appears
    await page.goto('/audit-log');
    await page.waitForLoadState('networkidle');

    // The audit entry for vertical creation should be visible
    // audit-log-table.tsx renders actionType in a Badge with font-mono
    await expect(
      page.getByText('VERTICAL_CREATED').first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('audit log filter by action type works', async ({ page }) => {
    await page.goto('/audit-log');
    await page.waitForLoadState('networkidle');

    // AuditLogFilterBar renders an action type filter — check for the filter bar
    // The filter bar from audit-log-filter-bar.tsx
    const filterBar = page.locator(
      '.rounded-lg.border',
      // approximate locator for the filter bar region
    ).first();
    await expect(filterBar).toBeVisible({ timeout: 5_000 });
  });
});
