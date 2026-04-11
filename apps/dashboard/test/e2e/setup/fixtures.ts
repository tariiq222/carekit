/**
 * Playwright Fixtures — CareKit Dashboard
 *
 * Provides:
 *   - `adminPage`: authenticated Page instance
 *   - `goto(url)`: navigates and waits for AuthProvider to complete its refresh
 *
 * Auth strategy — solving refresh-token rotation:
 *
 * The backend uses refresh-token rotation (each call invalidates the old token).
 * Playwright creates a fresh browser context per test, each loading the same
 * storageState. Once the first test rotates the token, all subsequent contexts
 * have a stale cookie.
 *
 * Solution: intercept ALL browser calls to /api/proxy/auth/refresh-token via
 * context.route(). The interceptor proxies the call to the real backend from
 * Node, maintaining a single valid token chain in Node memory. The browser
 * receives a real backend response (with a real access token), so AuthProvider
 * works correctly. We bootstrap the token chain by logging in once per process
 * (not per test), then rotating it on every intercepted refresh call.
 *
 * Usage:
 *   import { test, expect } from '../setup/fixtures';
 *
 *   test('renders page', async ({ adminPage, goto }) => {
 *     await goto('/bookings');
 *     await expect(adminPage.getByText('الحجوزات')).toBeVisible();
 *   });
 */

import { test as base, type Page, type BrowserContext } from '@playwright/test';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:5100/api/v1';
const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Adm!nP@ss123';

// Module-level valid refresh token (bootstrapped once per process on first use)
let currentRefreshToken: string | null = null;
let tokenBootstrapped = false;

type Fixtures = {
  adminPage: Page;
  /**
   * Navigates to a URL and waits for AuthProvider to complete its async auth
   * flow (refreshToken + fetchMe) before returning.
   */
  goto: (url: string) => Promise<void>;
};

/**
 * Logs in via the backend API (Node, not browser) to get a fresh refresh token.
 * Only called once per process to bootstrap the token chain.
 */
async function loginViaNode(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) return null;

  const setCookies = res.headers.getSetCookie?.() ?? [];
  const tokenCookie = setCookies.find((c: string) => c.startsWith('refresh_token='));
  return tokenCookie ? tokenCookie.split(';')[0].replace('refresh_token=', '') : null;
}

/**
 * Calls the backend refresh-token endpoint from Node using `currentRefreshToken`.
 * Updates `currentRefreshToken` with the new token from Set-Cookie.
 * Returns the full response to forward to the browser.
 */
async function callRefreshFromNode(): Promise<{
  body: unknown;
  status: number;
  headers: Record<string, string>;
}> {
  // Bootstrap on first call: log in once to get a valid token
  if (!tokenBootstrapped) {
    tokenBootstrapped = true;
    currentRefreshToken = await loginViaNode();
  }

  if (!currentRefreshToken) {
    return { body: { success: false, error: { code: 'NO_TOKEN' } }, status: 401, headers: {} };
  }

  const res = await fetch(`${API_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `refresh_token=${currentRefreshToken}`,
    },
  });

  const body = await res.json();
  const setCookies = res.headers.getSetCookie?.() ?? [];
  const tokenCookie = setCookies.find((c: string) => c.startsWith('refresh_token='));
  const newToken = tokenCookie ? tokenCookie.split(';')[0].replace('refresh_token=', '') : null;

  if (newToken) {
    currentRefreshToken = newToken;
  } else if (!res.ok) {
    // Refresh failed (token expired/invalid) — re-bootstrap on next call
    currentRefreshToken = null;
    tokenBootstrapped = false;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tokenCookie) {
    headers['Set-Cookie'] = tokenCookie;
  }

  return { body, status: res.status, headers };
}

/**
 * Installs a route interceptor on the given context that proxies
 * /api/proxy/auth/refresh-token calls through Node.
 * Must be called per-context since Playwright creates a fresh context per test.
 */
async function installRefreshInterceptor(context: BrowserContext): Promise<void> {
  await context.route('**/api/proxy/auth/refresh-token', async (route) => {
    const { body, status, headers } = await callRefreshFromNode();
    await route.fulfill({
      status,
      headers,
      body: JSON.stringify(body),
    });
  });
}

export const test = base.extend<Fixtures>({
  adminPage: async ({ page }, use) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },

  goto: async ({ adminPage, context }, use) => {
    // Install the interceptor for this test's fresh browser context
    await installRefreshInterceptor(context);

    const navigate = async (url: string): Promise<void> => {
      await adminPage.goto(url);
      // AuthProvider calls /api/proxy/auth/refresh-token on mount.
      // Our interceptor handles it via Node. The browser then calls fetchMe().
      // Wait for networkidle — this fires after refreshToken + fetchMe complete,
      // meaning the auth flow is done and the dashboard content is ready.
      await adminPage.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(navigate);
  },
});

export { expect } from '@playwright/test';
