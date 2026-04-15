/**
 * Playwright Fixtures — CareKit Dashboard
 *
 * Provides:
 *   - `adminPage`: authenticated Page (auto-login per test)
 *   - `goto(url)`: navigates and waits for networkidle
 *   - `waitForToast(text)`: waits for a Sonner toast matching text/regex
 *   - `closeDialog()`: closes any open dialog via Escape or close button
 *
 * Strategy: per-test login via the login form. Simpler and more reliable than
 * storageState sharing, because the backend rotates refresh tokens — sharing
 * state across parallel/sequential contexts breaks after the first rotation.
 */

import { test as base, type Page, expect } from '@playwright/test';

const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env['TEST_ADMIN_PASSWORD'] ?? 'Admin@1234';

type Fixtures = {
  adminPage: Page;
  goto: (url: string) => Promise<void>;
  waitForToast: (text: string | RegExp, timeoutMs?: number) => Promise<void>;
  closeDialog: () => Promise<void>;
  /**
   * Navigate to a list page and filter by search term via the search input.
   * Some pages don't read ?search= from URL — this helper types in the input directly.
   */
  searchInList: (route: string, query: string) => Promise<void>;
};

async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForSelector('#email', { timeout: 20_000 });
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
  // انتظر حتى يختفي نموذج login (AuthProvider يحمل المستخدم)
  await page
    .waitForFunction(() => !document.querySelector('#email'), null, { timeout: 15_000 })
    .catch(() => {});
}

export const test = base.extend<Fixtures>({
  // Overwrite storageState so each context starts fresh (no shared cookies/ls).
  storageState: async ({}, use) => {
    await use(undefined);
  },

  adminPage: async ({ page }, use) => {
    await loginViaUI(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },

  goto: async ({ adminPage }, use) => {
    const navigate = async (url: string): Promise<void> => {
      await adminPage.goto(url);
      await adminPage.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(navigate);
  },

  waitForToast: async ({ adminPage }, use) => {
    const wait = async (text: string | RegExp, timeoutMs = 8_000): Promise<void> => {
      // Sonner renders toasts in [data-sonner-toast] or role="status"
      const toast = adminPage
        .locator('[data-sonner-toast], [role="status"], [data-type="success"], [data-type="error"]')
        .filter({ hasText: text })
        .first();
      await expect(toast).toBeVisible({ timeout: timeoutMs });
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(wait);
  },

  searchInList: async ({ adminPage }, use) => {
    const run = async (route: string, query: string): Promise<void> => {
      await adminPage.goto(route);
      await adminPage.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      const searchInput = adminPage
        .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
        .first();
      if (await searchInput.isVisible({ timeout: 6_000 }).catch(() => false)) {
        await searchInput.fill(query);
        await adminPage.waitForTimeout(600);
      }
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(run);
  },

  closeDialog: async ({ adminPage }, use) => {
    const close = async (): Promise<void> => {
      const dialog = adminPage.locator('[role="dialog"], [role="alertdialog"]').first();
      const isVisible = await dialog.isVisible().catch(() => false);
      if (!isVisible) return;

      // Try explicit close button first
      const closeBtn = dialog
        .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
        .first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
      } else {
        await adminPage.keyboard.press('Escape');
      }
      await expect(dialog).not.toBeVisible({ timeout: 6_000 });
    };
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(close);
  },
});

export { expect } from '@playwright/test';
