import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

test.describe('[A3] Plans CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('plans list page loads with heading and action buttons', async ({ page }) => {
    await page.goto('/plans');
    await page.waitForLoadState('networkidle');

    // Heading from plans/page.tsx — hardcoded "Plans"
    await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible({
      timeout: 10_000,
    });

    // "+ Create Plan" link button
    await expect(page.getByRole('link', { name: '+ Create Plan' })).toBeVisible();

    // "Edit Features & Limits" link button
    await expect(
      page.getByRole('link', { name: 'Edit Features & Limits' }),
    ).toBeVisible();
  });

  test('create plan page renders all form fields', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('networkidle');

    // Back link + heading from plans/new/page.tsx
    await expect(page.getByRole('heading', { name: 'Create plan' })).toBeVisible({
      timeout: 10_000,
    });

    // Form fields — ids from plans/new/page.tsx
    await expect(page.locator('#cp-slug')).toBeVisible();
    await expect(page.locator('#cp-nameAr')).toBeVisible();
    await expect(page.locator('#cp-nameEn')).toBeVisible();
    await expect(page.locator('#cp-monthly')).toBeVisible();
    await expect(page.locator('#cp-annual')).toBeVisible();
    await expect(page.locator('#cp-reason')).toBeVisible();
  });

  test('create plan form validates slug and enables submit when valid', async ({ page }) => {
    await page.goto('/plans/new');
    await page.waitForLoadState('networkidle');

    const slug = `E2E${Date.now()}`;

    await page.locator('#cp-slug').fill(slug);
    await page.locator('#cp-nameAr').fill('خطة اختبار E2E');
    await page.locator('#cp-nameEn').fill('E2E Test Plan');
    await page.locator('#cp-monthly').fill('99');
    await page.locator('#cp-annual').fill('999');
    await page.locator('#cp-reason').fill('Automated E2E test plan creation');

    // Submit button should be enabled when all fields valid
    const submitBtn = page.getByRole('button', { name: 'Create plan' });
    await expect(submitBtn).not.toBeDisabled({ timeout: 5_000 });
  });
});
