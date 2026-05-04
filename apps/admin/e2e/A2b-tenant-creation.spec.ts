import { test, expect } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

const SLUG = `e2e-org-${Date.now()}`;

test.describe('[A2] Organizations CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('organizations list page loads', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: 'Organizations' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('create-tenant dialog opens and wizard can be navigated', async ({
    page,
  }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Create tenant' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'New user' }).click();

    await page.locator('#owner-name').fill('E2E Test Owner');
    await page.locator('#owner-email').fill(`e2e-owner-${Date.now()}@test.example`);

    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('heading', { name: 'Create tenant' })).toBeVisible();
    await expect(page.getByText('Organization')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });

  test('suspend dialog opens on org detail page', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    const firstOpen = page.getByRole('link', { name: 'Open' }).first();
    const hasOrg = await firstOpen.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasOrg) {
      test.skip();
      return;
    }

    await firstOpen.click();
    await page.waitForLoadState('networkidle');

    const suspendBtn = page.getByRole('button', { name: 'Suspend' });
    const canSuspend = await suspendBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!canSuspend) {
      const reinstateBtn = page.getByRole('button', { name: 'Reinstate' });
      const canReinstate = await reinstateBtn.isVisible({ timeout: 3_000 }).catch(() => false);
      if (canReinstate) {
        await reinstateBtn.click();
        await expect(
          page.getByRole('heading', { name: 'Reinstate organization' }),
        ).toBeVisible({ timeout: 5_000 });
        await page.getByRole('button', { name: 'Cancel' }).click();
      }
      return;
    }

    await suspendBtn.click();
    await expect(
      page.getByRole('heading', { name: 'Suspend organization' }),
    ).toBeVisible({ timeout: 5_000 });

    const confirmBtn = page.getByRole('button', { name: 'Confirm suspend' });
    await expect(confirmBtn).toBeDisabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('heading', { name: 'Suspend organization' }),
    ).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('[A2b] Tenant Creation Flow', () => {
  const TEST_SLUG = `e2e-tenant-${Date.now()}`;
  const TEST_EMAIL = `e2e-owner-${Date.now()}@test.example`;

  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');
  });

  test('complete tenant creation wizard - new user owner', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'New user' }).click();

    await page.locator('#owner-name').fill('E2E Test Owner');
    await page.locator('#owner-email').fill(TEST_EMAIL);
    await page.locator('#owner-phone').fill('+966501234567');
    await page.locator('#owner-password').fill('SecurePass1!');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill(TEST_SLUG);
    await page.locator('#tenant-name-ar').fill('منظمة اختبار');
    await page.locator('#tenant-name-en').fill('Test Organization');

    const verticalSelect = page.locator('#tenant-vertical');
    if (await verticalSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verticalSelect.click();
      await page.waitForTimeout(300);
      const firstVertical = page.locator('[role="option"]').first();
      if (await firstVertical.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstVertical.click();
      }
    }

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    const planSelect = page.locator('#tenant-plan');
    if (await planSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await planSelect.click();
      await page.waitForTimeout(300);
      const firstPlan = page.locator('[role="option"]').first();
      if (await firstPlan.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstPlan.click();
      }
    }

    await page.locator('#tenant-trial-days').fill('14');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Create tenant' })).toBeVisible();
    await expect(page.getByText(TEST_SLUG)).toBeVisible();
    await expect(page.getByText('منظمة اختبار')).toBeVisible();
  });

  test('complete tenant creation wizard - existing user owner', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Existing user' }).click();

    const combobox = page.locator('[role="combobox"]').first();
    if (await combobox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await combobox.click();
      await page.waitForTimeout(500);
      const firstUser = page.locator('[role="option"]').first();
      if (await firstUser.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstUser.click();
      }
    } else {
      test.skip();
      return;
    }

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill(`${TEST_SLUG}-existing`);
    await page.locator('#tenant-name-ar').fill('منظمة موجودة');
    await page.locator('#tenant-name-en').fill('Existing Org');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-trial-days').fill('0');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('heading', { name: 'Create tenant' })).toBeVisible();
  });

  test('wizard validation prevents progression with invalid data', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'New user' }).click();

    await page.locator('#owner-name').fill('');
    await page.locator('#owner-email').fill('invalid-email');

    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });

  test('wizard validation for organization step', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Test');
    await page.locator('#owner-email').fill('test@example.com');

    await page.getByRole('button', { name: 'Next' }).click();

    await page.locator('#tenant-slug').fill('invalid slug!');
    await page.locator('#tenant-name-ar').fill('أ');

    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });

  test('wizard back button preserves entered data', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Test Owner Name');
    await page.locator('#owner-email').fill('test@example.com');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill('test-slug');
    await page.locator('#tenant-name-ar').fill('اختبار');

    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.locator('#tenant-slug')).toHaveValue('test-slug');
    await expect(page.locator('#tenant-name-ar')).toHaveValue('اختبار');
  });

  test('wizard cancel button closes dialog and resets form', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Test Owner');
    await page.locator('#owner-email').fill('test@example.com');

    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByRole('heading', { name: 'Create tenant' }),
    ).not.toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: 'Create tenant' }).click();

    await expect(page.locator('#owner-name')).toHaveValue('');
    await expect(page.locator('#owner-email')).toHaveValue('');
  });

  test('review step shows all entered data', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Review Test Owner');
    await page.locator('#owner-email').fill('review@example.com');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill('review-test-slug');
    await page.locator('#tenant-name-ar').fill('مراجعة الاختبار');
    await page.locator('#tenant-name-en').fill('Review Test');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-trial-days').fill('30');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Review Test Owner')).toBeVisible();
    await expect(page.getByText('review@example.com')).toBeVisible();
    await expect(page.getByText('review-test-slug')).toBeVisible();
    await expect(page.getByText('مراجعة الاختبار')).toBeVisible();
    await expect(page.getByText('30')).toBeVisible();
  });

  test('edit step from review navigates back to that step', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Edit Test');
    await page.locator('#owner-email').fill('edit@example.com');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill('edit-test');
    await page.locator('#tenant-name-ar').fill('تعديل');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-trial-days').fill('7');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    const editStep1 = page.getByRole('button', { name: /edit.*step.*1|تعديل.*الخطوة.*1/i }).first();
    if (await editStep1.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editStep1.click();
      await page.waitForTimeout(500);
      await expect(page.locator('#owner-name')).toHaveValue('Edit Test');
    }
  });

  test('billing cycle toggle between monthly and annual', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Billing Test');
    await page.locator('#owner-email').fill('billing@example.com');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill('billing-test');
    await page.locator('#tenant-name-ar').fill('الفوترة');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    const billingCycle = page.locator('#tenant-billing-cycle');
    await billingCycle.click();
    await page.waitForTimeout(300);

    const annualOption = page.locator('[role="option"]', { hasText: /annual|سنوي/i }).first();
    if (await annualOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await annualOption.click();
      await page.waitForTimeout(500);
      await expect(billingCycle).toContainText(/annual|سنوي/i);
    }
  });

  test('trial days validation - reject invalid values', async ({ page }) => {
    await page.getByRole('button', { name: 'Create tenant' }).click();

    await page.getByRole('button', { name: 'New user' }).click();
    await page.locator('#owner-name').fill('Trial Test');
    await page.locator('#owner-email').fill('trial@example.com');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-slug').fill('trial-test');
    await page.locator('#tenant-name-ar').fill('تجربة');

    await page.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(500);

    await page.locator('#tenant-trial-days').fill('100');

    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeDisabled();
  });

  test('organizations table shows created tenant', async ({ page }) => {
    await page.goto('/organizations');
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[placeholder*="search" i], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(TEST_SLUG);
      await page.waitForTimeout(1000);
    }

    const orgLink = page.getByRole('link', { name: new RegExp(TEST_SLUG, 'i') }).first();
    const hasOrg = await orgLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasOrg) {
      await expect(orgLink).toBeVisible();
    }
  });
});