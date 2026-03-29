/**
 * CareKit Dashboard — Problem Reports E2E Tests
 *
 * /problem-reports redirects to /bookings?tab=problemReports.
 * Tests verify the redirect and the problem reports tab is accessible.
 */

import { test, expect } from '../setup/fixtures';

test.describe('Problem Reports (via bookings page)', () => {
  test('navigates to problem reports tab in bookings', async ({ adminPage, goto }) => {
    await goto('/bookings?tab=problemReports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(/\/bookings/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows problem reports content', async ({ adminPage, goto }) => {
    await goto('/bookings?tab=problemReports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage.getByText('بلاغات المشاكل').first()).toBeVisible({ timeout: 12_000 });
  });

  test('/problem-reports redirect leads to bookings page', async ({ adminPage, goto }) => {
    await goto('/problem-reports');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Should redirect to bookings (problem reports tab)
    await expect(adminPage).toHaveURL(/\/bookings/);
  });
});
