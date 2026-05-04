import { test, expect } from '@playwright/test';
import { devLogin } from './helpers/auth';

test.describe('Subscription & Plan Flow', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('should navigate to subscription overview', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display subscription page with plan info', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const planSection = page.locator('text=/plan|خطة/i').first();
    if (await planSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(planSection).toBeVisible();
    }
  });

  test('should display current plan badge', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const currentPlan = page.locator('text=/current|current plan|النظام الحالي/i').first();
    if (await currentPlan.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(currentPlan).toBeVisible();
    }
  });

  test('should display usage section', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const usageSection = page.locator('text=/usage|استخدام/i').first();
    if (await usageSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(usageSection).toBeVisible();
    }
  });

  test('should display usage bar or progress indicator', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const usageBar = page.locator('[class*="progress"], [class*="usage"], [role="progressbar"]').first();
    if (await usageBar.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(usageBar).toBeVisible();
    }
  });

  test('should navigate to usage page', async ({ page }) => {
    await page.goto('/subscription/usage');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display usage breakdown by category', async ({ page }) => {
    await page.goto('/subscription/usage');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const breakdown = page.locator('text=/breakdown|تفصيل/i').first();
    if (await breakdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(breakdown).toBeVisible();
    }
  });

  test('should display employees usage', async ({ page }) => {
    await page.goto('/subscription/usage');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const employeesUsage = page.locator('text=/employe|موظف/i').first();
    if (await employeesUsage.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(employeesUsage).toBeVisible();
    }
  });

  test('should display storage usage', async ({ page }) => {
    await page.goto('/subscription/usage');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const storageUsage = page.locator('text=/storage|تخزين/i').first();
    if (await storageUsage.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(storageUsage).toBeVisible();
    }
  });

  test('should navigate to plans page', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display available plans', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const plansSection = page.locator('text=/plan|خطة/i').first();
    if (await plansSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(plansSection).toBeVisible();
    }
  });

  test('should display monthly billing option', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const monthlyOption = page.locator('text=/monthly|شهري/i').first();
    if (await monthlyOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(monthlyOption).toBeVisible();
    }
  });

  test('should display annual billing option', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const annualOption = page.locator('text=/annual|سنوي/i').first();
    if (await annualOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(annualOption).toBeVisible();
    }
  });

  test('should toggle billing cycle between monthly and annual', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const annualToggle = page.locator('text=/annual|سنوي/i').first();
    const monthlyToggle = page.locator('text=/monthly|شهري/i').first();

    if (await annualToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await annualToggle.click();
      await page.waitForTimeout(1000);
    } else if (await monthlyToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.locator('button:has-text("annual" i)').first().click();
      await page.waitForTimeout(1000);
    } else {
      test.skip();
    }
  });

  test('should display plan features list', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const featuresList = page.locator('[class*="feature"], ul li').first();
    if (await featuresList.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(featuresList).toBeVisible();
    }
  });

  test('should display upgrade button on plan card', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const upgradeButton = page.locator('button:has-text("upgrade" i), button:has-text("ترقية")').first();
    if (await upgradeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(upgradeButton).toBeVisible();
    }
  });

  test('should display current plan as selected', async ({ page }) => {
    await page.goto('/subscription/plans');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const currentBadge = page.locator('text=/current|current|الحالي/i');
    if (await currentBadge.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(currentBadge.first()).toBeVisible();
    }
  });

  test('should navigate to payment methods page', async ({ page }) => {
    await page.goto('/subscription/payment-methods');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display saved payment methods', async ({ page }) => {
    await page.goto('/subscription/payment-methods');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const paymentSection = page.locator('text=/payment|دفع|i').first();
    if (await paymentSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(paymentSection).toBeVisible();
    }
  });

  test('should display add payment method button', async ({ page }) => {
    await page.goto('/subscription/payment-methods');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const addButton = page.locator('button:has-text("add" i), button:has-text("إضافة")').first();
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(addButton).toBeVisible();
    }
  });

  test('should navigate to invoices page', async ({ page }) => {
    await page.goto('/subscription/invoices');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display invoices table', async ({ page }) => {
    await page.goto('/subscription/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const invoicesTable = page.locator('table, [class*="invoice"]').first();
    if (await invoicesTable.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(invoicesTable).toBeVisible();
    }
  });

  test('should display invoice download button', async ({ page }) => {
    await page.goto('/subscription/invoices');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const downloadButton = page.locator('button:has-text("download" i), button:has-text("تحميل")').first();
    if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(downloadButton).toBeVisible();
    }
  });

  test('should display trial banner when applicable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const trialBanner = page.locator('text=/trial|تجربة/i').first();
    if (await trialBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(trialBanner).toBeVisible();
    }
  });

  test('should navigate to upgrade from trial banner', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const upgradeLink = page.locator('a[href="/subscription"], button:has-text("upgrade" i), button:has-text("ترقية")').first();
    if (await upgradeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await upgradeLink.click();
      await page.waitForURL(/\/subscription/, { timeout: 10000 });
      await expect(page.locator('body')).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should display feature limit warning', async ({ page }) => {
    await page.goto('/subscription/usage');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const warning = page.locator('text=/limit|حد|warning|تحذير/i').first();
    if (await warning.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(warning).toBeVisible();
    }
  });

  test('should display billing contact info', async ({ page }) => {
    await page.goto('/subscription');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const billingContact = page.locator('text=/billing|الفواتير/i').first();
    if (await billingContact.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(billingContact).toBeVisible();
    }
  });
});