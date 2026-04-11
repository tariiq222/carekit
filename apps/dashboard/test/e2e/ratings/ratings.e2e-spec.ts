/**
 * CareKit Dashboard — Ratings E2E Tests
 *
 * The /ratings route redirects to /practitioners?tab=ratings.
 * Tests verify the redirect and that ratings content is accessible.
 */

import { test, expect } from '../setup/fixtures';

test.describe('Ratings (via practitioners page)', () => {
  test('navigates to ratings via practitioners?tab=ratings', async ({ adminPage, goto }) => {
    await goto('/practitioners?tab=ratings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(/\/practitioners/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows ratings title on practitioners page', async ({ adminPage, goto }) => {
    await goto('/practitioners?tab=ratings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage.getByText('التقييمات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('/ratings redirect leads to practitioners page', async ({ adminPage, goto }) => {
    await goto('/ratings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Should redirect to practitioners (ratings tab)
    await expect(adminPage).toHaveURL(/\/practitioners/);
  });
});
