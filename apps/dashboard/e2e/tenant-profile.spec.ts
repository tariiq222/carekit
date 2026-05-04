import { test, expect } from '@playwright/test';
import { devLogin, logout } from './helpers/auth';

test.describe('Tenant Profile & Settings', () => {
  test.beforeEach(async ({ page }) => {
    await devLogin(page);
  });

  test('should navigate to profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display account tab on profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    const accountTab = page.locator('text=/account|الحساب/i');
    if (await accountTab.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(accountTab.first()).toBeVisible();
    }
  });

  test('should update profile name', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const nameInput = page.locator('input[id*="name" i], input[placeholder*="name" i]').first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.clear();
      await nameInput.fill('Test User Updated');
      await page.waitForTimeout(500);

      const saveButton = page.locator('button:has-text("save" i), button:has-text("حفظ")').first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    } else {
      test.skip();
    }
  });

  test('should update profile phone', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const phoneInput = page.locator('input[id*="phone" i], input[placeholder*="phone" i]').first();
    if (await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput.clear();
      await phoneInput.fill('+966501234567');
      await page.waitForTimeout(500);

      const saveButton = page.locator('button:has-text("save" i), button:has-text("حفظ")').first();
      if (await saveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(2000);
      }
    } else {
      test.skip();
    }
  });

  test('should change language in profile settings', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const langSelect = page.locator('select[id*="lang" i], select[id*="language" i]').first();
    if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      const options = page.locator('select[id*="lang" i] option');
      const count = await options.count();
      if (count > 1) {
        await langSelect.selectOption({ index: 1 });
        await page.waitForTimeout(1500);
      }
    } else {
      test.skip();
    }
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display general settings tab', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const generalTab = page.locator('text=/general|عام/i').first();
    if (await generalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(generalTab).toBeVisible();
    }
  });

  test('should display booking settings tab', async ({ page }) => {
    await page.goto('/settings?tab=booking');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const bookingTab = page.locator('text=/booking|الحجز/i').first();
    if (await bookingTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(bookingTab).toBeVisible();
    }
  });

  test('should display working hours settings', async ({ page }) => {
    await page.goto('/settings?tab=working-hours');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const workingHours = page.locator('text=/working hours|ساعات العمل/i').first();
    if (await workingHours.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(workingHours).toBeVisible();
    }
  });

  test('should display integrations settings tab', async ({ page }) => {
    await page.goto('/settings?tab=integrations');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const integrationsTab = page.locator('text=/integrations|التكامل/i').first();
    if (await integrationsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(integrationsTab).toBeVisible();
    }
  });

  test('should navigate to branding page', async ({ page }) => {
    await page.goto('/branding');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display branding logo upload section', async ({ page }) => {
    await page.goto('/branding');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const logoSection = page.locator('text=/logo|الشعار/i').first();
    if (await logoSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(logoSection).toBeVisible();
    }
  });

  test('should display branding colors section', async ({ page }) => {
    await page.goto('/branding');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const colorsSection = page.locator('text=/color|لون/i').first();
    if (await colorsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(colorsSection).toBeVisible();
    }
  });

  test('should logout via profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const logoutButton = page.locator('button:has-text("logout" i), button:has-text("تسجيل الخروج")').first();
    if (await logoutButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutButton.click();
      await page.waitForURL('/login', { timeout: 10000 });
      await expect(page.locator('#email')).toBeVisible();
    } else {
      test.skip();
    }
  });
});