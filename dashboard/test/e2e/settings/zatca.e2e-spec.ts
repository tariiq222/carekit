/**
 * CareKit Dashboard — ZATCA E2E Tests
 *
 * The /zatca route redirects to /invoices?tab=zatca.
 * The ZATCA tab shows onboarding status and sandbox stats.
 */

import { test, expect } from '../setup/fixtures';

test.describe('ZATCA (via invoices page)', () => {
  test('navigates to ZATCA tab in invoices', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(/\/invoices/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows ZATCA title', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage.getByText('التوافق مع فاتورة').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows ZATCA phase or onboarding status', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const phase = adminPage.getByText(/المرحلة|تسجيل/);
    const content = adminPage.locator('[class*="card"], [class*="stat"], [class*="status"]');
    const hasContent = (await phase.count() > 0) || (await content.count() > 0);
    expect(hasContent).toBe(true);
  });

  test('/zatca redirect leads to invoices page', async ({ adminPage, goto }) => {
    await goto('/zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Should redirect to invoices (zatca tab)
    await expect(adminPage).toHaveURL(/\/invoices/);
  });
});
