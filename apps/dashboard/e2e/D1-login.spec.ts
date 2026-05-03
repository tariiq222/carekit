// TODO post-launch: D2 create booking · D3 confirm → invoice · D4 switch org · D5 subscription page
// Admin: A1 impersonate · A2 create tenant · A3 plan editor → FeatureGate
// Website: W1 guest booking · W2 client invoice

import { test, expect } from '@playwright/test';

/**
 * [D1] Dashboard login golden path
 *
 * Credentials: seeded by apps/backend/prisma/seed.ts
 *   SEED_EMAIL    (default: admin@deqah-test.com)
 *   SEED_PASSWORD (default: Admin@1234)
 *
 * The hCaptcha widget is bypassed automatically when
 * NEXT_PUBLIC_HCAPTCHA_SITE_KEY is unset — CaptchaField auto-issues
 * "dev-bypass" and the form becomes submittable immediately.
 *
 * Locale is ar-SA (set in playwright.config.ts), so labels match Arabic
 * translations from lib/translations/ar.misc.ts and ar.nav.ts.
 */
test.describe('[D1] Dashboard login flow', () => {
  test('admin can log in, see home, and log out', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // 2. Wait for the form to settle (captcha auto-bypass fires on mount)
    await page.waitForLoadState('networkidle');

    // 3. Fill credentials using the seeded test admin
    // Label: "البريد الإلكتروني" (login.emailLabel) — id="email"
    await page.getByLabel('البريد الإلكتروني').fill('admin@deqah-test.com');
    // Use id="#password" to avoid strict-mode conflict: the "show password"
    // toggle also carries an aria-label containing "كلمة المرور".
    await page.locator('#password').fill('Admin@1234');

    // 4. Submit — button text: "تسجيل الدخول" (login.signIn)
    await page.getByRole('button', { name: 'تسجيل الدخول' }).click();

    // 5. Wait for redirect away from /login (lands on /, /bookings, etc.)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // 6. Verify dashboard chrome is visible (sticky header present)
    // The sidebar uses <div> elements (not <nav>); the header is the stable
    // semantic anchor — it's always rendered in the authenticated layout.
    await expect(page.locator('header').first()).toBeVisible({ timeout: 10_000 });

    // 7. Log out via avatar dropdown in the header
    // The profile trigger wraps the Avatar component (data-slot="avatar-fallback").
    const profileTrigger = page.locator('header').locator('button').filter({
      has: page.locator('[data-slot="avatar-fallback"]'),
    });
    await profileTrigger.click();

    // Wait for the dropdown menu to appear, then click logout
    const logoutBtn = page.getByRole('button', { name: 'تسجيل الخروج' });
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
    await logoutBtn.click();

    // 8. Confirm logged out: AuthGate renders LoginForm in-place (no URL redirect).
    // The login submit button becomes visible when the form mounts.
    await expect(
      page.getByRole('button', { name: 'تسجيل الدخول' }),
    ).toBeVisible({ timeout: 10_000 });
  });
});
