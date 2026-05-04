import { test, expect } from '@playwright/test';

test.describe('[A1] Admin login flow', () => {
  test('super-admin can log in, see admin shell, and sign out', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Wait for hCaptcha dev-bypass to fire on mount
    await page.waitForLoadState('networkidle');

    // Fill credentials — label id="email", id="password"
    // Labels from en.json: login.email = "Email", login.password = "Password"
    await page.getByLabel('Email').fill(
      process.env.SUPER_ADMIN_EMAIL ?? 'tariq.alwalidi@gmail.com',
    );
    await page.locator('#password').fill(
      process.env.SUPER_ADMIN_PASSWORD ?? 'Admin@2026',
    );

    // Submit — button text from en.json login.submit = "Sign in"
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

    // Admin shell: <aside> sidebar is the stable authenticated landmark
    await expect(page.locator('aside').first()).toBeVisible({ timeout: 10_000 });

    // "Overview" heading is present on the home page
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({
      timeout: 10_000,
    });

    // Sign out via the LogoutButton — text "Sign out" (shell/logout-button.tsx)
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Middleware redirects back to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Login form is present again — button text "Sign in"
    await expect(
      page.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('non-super-admin login is rejected with a toast', async ({ page }) => {
    // Intercept the proxied login call and return a fake response where
    // isSuperAdmin is false.  The login-form reads res.user.isSuperAdmin
    // and fires toast.error(t("error.notAuthorized")) when it is false.
    //
    // The admin app proxies /api/proxy/auth/login → backend /api/v1/auth/login
    // via next.config.mjs rewrites, so we match on the proxy prefix.
    await page.route('**/api/proxy/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'fake.jwt.token',
          refreshToken: 'fake.refresh.token',
          expiresIn: 3600,
          user: {
            id: 'aaaaaaaa-0000-0000-0000-000000000001',
            email: 'notadmin@example.com',
            name: 'Not Admin',
            phone: null,
            gender: null,
            avatarUrl: null,
            isActive: true,
            role: 'user',
            customRoleId: null,
            isSuperAdmin: false,
            permissions: [],
            organizationId: null,
            verticalSlug: null,
            onboardingCompletedAt: null,
            activeMembership: null,
          },
        }),
      });
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Email').fill('notadmin@example.com');
    await page.locator('#password').fill('SomePassword1!');

    // hCaptcha is bypassed in test mode (NEXT_PUBLIC_HCAPTCHA_SITE_KEY='')
    // so the submit button should be enabled once credentials are filled.
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Toast should show the not-authorized message (en.json login.error.notAuthorized)
    await expect(
      page.getByText('This account is not authorized for the super-admin panel.'),
    ).toBeVisible({ timeout: 10_000 });

    // URL must stay on /login
    await expect(page).toHaveURL(/\/login/);

    // Token must NOT be stored
    const stored = await page.evaluate(() =>
      window.localStorage.getItem('admin.accessToken'),
    );
    expect(stored).toBeNull();

    // Cookie must NOT be set
    const cookies = await page.context().cookies();
    const authCookie = cookies.find((c) => c.name === 'admin.authenticated');
    expect(authCookie).toBeUndefined();
  });
});
