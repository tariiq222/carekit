import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'tariq.alwalidi@gmail.com';

test.describe('[A8] Users cross-tenant search', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('users page loads with filter bar', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // Heading from users/page.tsx — hardcoded "Users"
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible({
      timeout: 10_000,
    });

    // Search input placeholder from users-filter-bar.tsx
    await expect(
      page.getByPlaceholder('Search by email or name'),
    ).toBeVisible();

    // Org filter placeholder from users-filter-bar.tsx
    await expect(
      page.getByPlaceholder('Organization ID (UUID, optional)'),
    ).toBeVisible();
  });

  test('searching for the super-admin email returns a user row', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    // Type the super-admin email into the search input
    await page.getByPlaceholder('Search by email or name').fill(SUPER_ADMIN_EMAIL);

    // Wait for the query to fire (networkidle after typing)
    await page.waitForLoadState('networkidle');

    // The email should appear in the table results
    await expect(page.getByText(SUPER_ADMIN_EMAIL)).toBeVisible({ timeout: 10_000 });
  });

  test('reset button clears search', async ({ page }) => {
    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search by email or name');
    await searchInput.fill('some-search-term');
    await expect(searchInput).toHaveValue('some-search-term');

    // Reset button from users-filter-bar.tsx — text "Reset"
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(searchInput).toHaveValue('');
  });
});
