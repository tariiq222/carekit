import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

// Unique slug for idempotent runs
const VERTICAL_SLUG = `e2e-vertical-${Date.now()}`;
const VERTICAL_NAME_EN = `E2E Vertical ${Date.now()}`;
const VERTICAL_NAME_AR = `قطاع E2E ${Date.now()}`;
const REASON = 'Automated E2E test vertical creation';

test.describe('[A4] Verticals CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('verticals list page loads', async ({ page }) => {
    await page.goto('/verticals');
    await page.waitForLoadState('networkidle');

    // Heading from verticals/page.tsx — hardcoded "Verticals"
    await expect(page.getByRole('heading', { name: 'Verticals' })).toBeVisible({
      timeout: 10_000,
    });

    // Create button — hardcoded "+ Create Vertical"
    await expect(
      page.getByRole('button', { name: '+ Create Vertical' }),
    ).toBeVisible();
  });

  test('create-vertical dialog opens, fills, and submits', async ({ page }) => {
    await page.goto('/verticals');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '+ Create Vertical' }).click();

    // Dialog title from create-vertical-dialog.tsx
    await expect(
      page.getByRole('heading', { name: 'Create vertical' }),
    ).toBeVisible({ timeout: 5_000 });

    // Fill form — ids from create-vertical-dialog.tsx
    await page.locator('#cv-slug').fill(VERTICAL_SLUG);
    await page.locator('#cv-nameAr').fill(VERTICAL_NAME_AR);
    await page.locator('#cv-nameEn').fill(VERTICAL_NAME_EN);

    // Template family select — SelectTrigger id="cv-family"
    await page.locator('#cv-family').click();
    await page.getByRole('option', { name: 'MEDICAL' }).click();

    await page.locator('#cv-reason').fill(REASON);

    // Submit button should be enabled
    const createBtn = page.getByRole('button', { name: 'Create vertical' });
    await expect(createBtn).not.toBeDisabled();
    await createBtn.click();

    // On success the dialog closes
    await expect(
      page.getByRole('heading', { name: 'Create vertical' }),
    ).not.toBeVisible({ timeout: 15_000 });

    // New vertical slug should appear in the table
    await expect(page.getByText(VERTICAL_SLUG)).toBeVisible({ timeout: 10_000 });
  });

  test('update-vertical dialog opens on an existing vertical', async ({ page }) => {
    await page.goto('/verticals');
    await page.waitForLoadState('networkidle');

    // Find first edit button (pencil / Edit in table actions)
    // verticals-table.tsx uses onEdit callback — button label is "Edit"
    const editBtn = page.getByRole('button', { name: 'Edit' }).first();
    const hasVertical = await editBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasVertical) {
      test.skip();
      return;
    }

    await editBtn.click();

    // Dialog title from update-vertical-dialog.tsx: "Edit vertical — {slug}"
    await expect(page.getByText(/Edit vertical —/)).toBeVisible({ timeout: 5_000 });

    // Reason field exists and starts empty
    const reasonField = page.locator('#uv-reason');
    await expect(reasonField).toBeVisible();
    await expect(reasonField).toHaveValue('');

    // Save button disabled without reason
    const saveBtn = page.getByRole('button', { name: 'Save changes' });
    await expect(saveBtn).toBeDisabled();

    // Close without saving
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText(/Edit vertical —/)).not.toBeVisible({ timeout: 5_000 });
  });

  test('delete-vertical dialog opens with reason requirement', async ({ page }) => {
    await page.goto('/verticals');
    await page.waitForLoadState('networkidle');

    const deleteBtn = page.getByRole('button', { name: 'Delete' }).first();
    const hasVertical = await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasVertical) {
      test.skip();
      return;
    }

    await deleteBtn.click();

    // Dialog title from delete-vertical-dialog.tsx
    await expect(
      page.getByRole('heading', { name: 'Delete vertical' }),
    ).toBeVisible({ timeout: 5_000 });

    // Delete button disabled without reason
    const confirmDeleteBtn = page.getByRole('button', { name: 'Delete vertical' });
    await expect(confirmDeleteBtn).toBeDisabled();

    await page.locator('#dv-reason').fill('short');
    await expect(confirmDeleteBtn).toBeDisabled(); // still < 10 chars

    await page.locator('#dv-reason').fill('This is a valid reason for deletion');
    await expect(confirmDeleteBtn).not.toBeDisabled();

    // Close without submitting
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Delete vertical' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});
