import { test, expect } from '@playwright/test';
import { type Page, type BrowserContext } from '@playwright/test';
import { loginAsSuperAdmin } from './helpers/auth';

// All authenticated (admin) routes to smoke-check
const ADMIN_ROUTES = [
  '/',
  '/organizations',
  '/plans',
  '/verticals',
  '/billing',
  '/billing/invoices',
  '/billing/metrics',
  '/audit-log',
  '/impersonation-sessions',
  '/users',
  '/metrics',
  '/notifications',
  '/settings/email',
  '/settings/branding',
  '/settings/security',
  '/settings/health',
  '/settings/notifications',
  '/settings/billing',
] as const;

async function assertRouteHealthy(page: Page, route: string): Promise<void> {
  const errors: string[] = [];
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') errors.push(`[${route}] ${msg.text()}`);
  };
  page.on('console', handler);

  await page.goto(route);
  await page.waitForLoadState('networkidle');

  // Must not redirect to /login (auth should persist from beforeAll)
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

  // Must not render a hard error banner
  const errorBanners = page.locator(
    '.text-destructive, [class*="destructive"]',
  ).filter({ hasText: /failed to load|error loading/i });
  await expect(errorBanners).toHaveCount(0, { timeout: 5_000 });

  // Admin sidebar must still be present (authenticated layout)
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 5_000 });

  page.removeListener('console', handler);

  const filteredErrors = errors.filter(
    (e) =>
      !e.includes('Warning:') &&
      !e.includes('ResizeObserver') &&
      // 404s from optional backend endpoints are acceptable during smoke
      !e.includes('404'),
  );
  expect(filteredErrors, `Console errors on ${route}`).toHaveLength(0);
}

test.describe('[A10] Full-app smoke', () => {
  // Login once, capture localStorage + cookie, replay on every test page.
  let savedToken: string;
  let savedContext: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    savedContext = await browser.newContext();
    const page = await savedContext.newPage();
    await loginAsSuperAdmin(page);
    // Capture the JWT from localStorage after successful login
    savedToken = await page.evaluate(() => window.localStorage.getItem('admin.accessToken') ?? '');
    await page.close();
  });

  test.afterAll(async () => {
    await savedContext.close();
  });

  // Replay auth state on each test's page before navigating to the target route
  test.beforeEach(async ({ page }) => {
    // Set the auth cookie so middleware doesn't redirect to /login
    await page.context().addCookies([
      { name: 'admin.authenticated', value: '1', domain: 'localhost', path: '/' },
    ]);
    // Navigate to any admin page first so localStorage is writable on the correct origin
    await page.goto('/');
    await page.evaluate((token) => {
      window.localStorage.setItem('admin.accessToken', token);
    }, savedToken);
  });

  for (const route of ADMIN_ROUTES) {
    test(`route ${route} loads without errors`, async ({ page }) => {
      await assertRouteHealthy(page, route);
    });
  }
});
