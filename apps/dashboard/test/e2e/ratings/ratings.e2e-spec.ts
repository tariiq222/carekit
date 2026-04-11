/**
 * CareKit Dashboard — Ratings E2E Tests
 *
 * /ratings is a standalone page showing employee ratings.
 * It uses AllRatingsTab with the PageHeader + Breadcrumbs layout.
 */

import { test, expect } from '../setup/fixtures';

test.describe('Ratings page', () => {
  test('navigates to standalone /ratings route', async ({ adminPage, goto }) => {
    await goto('/ratings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(/\/ratings/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows ratings title on /ratings page', async ({ adminPage, goto }) => {
    await goto('/ratings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage.getByText('تقييمات الممارسين').first()).toBeVisible({ timeout: 12_000 });
  });
});
