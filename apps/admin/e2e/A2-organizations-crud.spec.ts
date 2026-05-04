import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

// Unique suffix so re-runs don't collide with existing slugs
const SLUG = `e2e-org-${Date.now()}`;

test.describe('[A2] Organizations CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('organizations list page loads', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    // Page heading — from en.json organizations.title = "Organizations"
    await expect(
      page.getByRole('heading', { name: 'Organizations' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('create-tenant dialog opens and wizard can be navigated', async ({
    page,
  }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    // Button text — en.json organizations.create.button = "Create tenant"
    await page.getByRole('button', { name: 'Create tenant' }).click();

    // Dialog title — en.json organizations.create.title = "Create tenant"
    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).toBeVisible({ timeout: 5_000 });

    // Step 1: owner — switch to "New user" mode so we can fill the form
    // en.json organizations.create.ownerModeNew = "New user"
    await page.getByRole('button', { name: 'New user' }).click();

    // Fill owner fields — ids from owner-step.tsx
    await page.locator('#owner-name').fill('E2E Test Owner');
    await page.locator('#owner-email').fill(`e2e-owner-${Date.now()}@test.example`);

    // Advance to step 2 — en.json organizations.create.next = "Next"
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: org step still shows the dialog heading
    await expect(page.getByRole('heading', { name: 'Create tenant' })).toBeVisible();

    // Step progress indicator shows step2 label — en.json organizations.create.step2 = "Organization"
    await expect(page.getByText('Organization')).toBeVisible();

    // Go back — en.json organizations.create.back = "Back"
    await page.getByRole('button', { name: 'Back' }).click();
    // Cancel from step 1 — en.json organizations.create.cancel = "Cancel"
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Dialog closed
    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('suspend dialog opens on org detail page', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    // Click the first "Open" action link to navigate to detail
    // en.json organizations.table.open = "Open"
    const firstOpen = page.getByRole('link', { name: 'Open' }).first();
    const hasOrg = await firstOpen.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasOrg) {
      // No orgs in DB — skip the suspend sub-test
      test.skip();
      return;
    }

    await firstOpen.click();
    await page.waitForLoadState('networkidle');

    // Try to open the Suspend dialog if the org is not already suspended/archived
    const suspendBtn = page.getByRole('button', { name: 'Suspend' });
    const canSuspend = await suspendBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!canSuspend) {
      // Org already suspended or archived — test the reinstate dialog instead
      const reinstateBtn = page.getByRole('button', { name: 'Reinstate' });
      const canReinstate = await reinstateBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (canReinstate) {
        await reinstateBtn.click();
        await expect(
          page.getByRole('heading', { name: 'Reinstate organization' }),
        ).toBeVisible({ timeout: 5_000 });
        // Close without submitting
        await page.getByRole('button', { name: 'Cancel' }).click();
      }
      return;
    }

    await suspendBtn.click();
    // Dialog title from suspend-dialog.tsx
    await expect(
      page.getByRole('heading', { name: 'Suspend organization' }),
    ).toBeVisible({ timeout: 5_000 });

    // The "Confirm suspend" button requires reason ≥ 10 chars — verify it starts disabled
    const confirmBtn = page.getByRole('button', { name: 'Confirm suspend' });
    await expect(confirmBtn).toBeDisabled();

    // Close without submitting
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Suspend organization' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
