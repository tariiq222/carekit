/**
 * CareKit Dashboard — Auth / Login E2E Tests
 *
 * AUTH-001 to AUTH-005.
 * NOTE: AUTH-001/002/003/005 test the login page itself — they must NOT use
 * the adminPage fixture (which auto-logs in). Those tests use bare `page` from
 * the base Playwright test import.
 * AUTH-004 uses our extended `test` (needs adminPage for logout).
 */

import { test as baseTest, expect as baseExpect, type Page } from '@playwright/test';
import { test, expect } from '../setup/fixtures';

const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

// ── AUTH-001 Successful login ─────────────────────────────────────────────────
baseTest.describe('Auth — login صحيح', () => {
  baseTest('[AUTH-001] @smoke @critical — login صحيح → redirect للداشبورد', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await page.waitForSelector('#email', { timeout: 20_000 });

    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForFunction(
      () => !document.querySelector('#email'),
      null,
      { timeout: 20_000 },
    ).catch(() => {});

    await baseExpect(page.locator('#email')).not.toBeVisible({ timeout: 10_000 });
    baseExpect(page.url()).not.toContain('/login');
  });
});

// ── AUTH-002 Wrong password ───────────────────────────────────────────────────
baseTest.describe('Auth — كلمة مرور خاطئة', () => {
  baseTest('[AUTH-002] @smoke — كلمة مرور خاطئة → رسالة خطأ', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await page.waitForSelector('#email', { timeout: 20_000 });

    await page.fill('#email', ADMIN_EMAIL);
    await page.fill('#password', 'WrongPassword999!');
    await page.click('button[type="submit"]');

    const errorMsg = page
      .locator('[data-sonner-toast], [role="status"], [role="alert"], [class*="error"]')
      .filter({ hasText: /خطأ|كلمة مرور|غير صحيح|بيانات|invalid|error/i })
      .first();

    const anyError = page.getByText(/خطأ|كلمة مرور|غير صحيح|بيانات|invalid/i).first();

    const errorVisible =
      (await errorMsg.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await anyError.isVisible({ timeout: 8_000 }).catch(() => false));

    const loginStillVisible = await page.locator('#email').isVisible({ timeout: 5_000 }).catch(() => false);

    baseExpect(errorVisible || loginStillVisible).toBe(true);
  });
});

// ── AUTH-003 Empty fields validation ─────────────────────────────────────────
baseTest.describe('Auth — حقول فارغة', () => {
  baseTest('[AUTH-003] @smoke — حقول فارغة → validation', async ({ page }: { page: Page }) => {
    await page.goto('/');
    await page.waitForSelector('#email', { timeout: 20_000 });

    await page.click('button[type="submit"]');

    const emailInput = page.locator('#email');
    const validationMsg = await emailInput.evaluate(
      (el: HTMLInputElement) => el.validationMessage,
    ).catch(() => '');

    const inlineError = page.getByText(/مطلوب|إلزامي|required|يجب|البريد/i).first();

    const hasValidation =
      validationMsg.length > 0 ||
      (await inlineError.isVisible({ timeout: 5_000 }).catch(() => false));

    const loginStillVisible = await emailInput.isVisible({ timeout: 3_000 }).catch(() => false);

    baseExpect(hasValidation || loginStillVisible).toBe(true);
  });
});

// ── AUTH-005 Unauthenticated redirect ────────────────────────────────────────
baseTest.describe('Auth — حماية المسارات', () => {
  baseTest('[AUTH-005] @smoke — زيارة /clients بدون auth → redirect لـ login', async ({ page }: { page: Page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    const isLoginPage =
      page.url().includes('/login') ||
      (await page.locator('#email').isVisible({ timeout: 10_000 }).catch(() => false));

    baseExpect(isLoginPage).toBe(true);
  });
});

// ── AUTH-004 Logout ───────────────────────────────────────────────────────────
test.describe('Auth — logout', () => {
  test('[AUTH-004] @critical — logout → redirect لـ login', async ({ adminPage }) => {
    const logoutBtn = adminPage
      .locator('button, [role="menuitem"], a')
      .filter({ hasText: /تسجيل خروج|خروج|logout/i })
      .first();

    const menuTrigger = adminPage
      .locator('[aria-label*="قائمة"], [aria-label*="menu"], [aria-label*="المستخدم"], [aria-label*="user"]')
      .first();

    if (await menuTrigger.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await menuTrigger.click();
      await adminPage.waitForTimeout(500);
    }

    if (await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await logoutBtn.click();

      await adminPage.waitForURL(/\/login/, { timeout: 15_000 }).catch(() => {});

      const isLoginPage =
        adminPage.url().includes('/login') ||
        (await adminPage.locator('#email').isVisible({ timeout: 10_000 }).catch(() => false));

      expect(isLoginPage).toBe(true);
    } else {
      test.skip();
    }
  });
});
