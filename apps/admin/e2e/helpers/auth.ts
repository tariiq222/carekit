import { type Page, expect } from '@playwright/test';

const DEFAULT_EMAIL = 'tariq.alwalidi@gmail.com';
const DEFAULT_PASSWORD = 'Admin@2026';

/**
 * Logs in as the seeded super-admin and waits for the authenticated shell.
 * Reads credentials from env with fallbacks to the seed defaults.
 *
 * The admin app is English-first (LTR). All selectors use English labels
 * from apps/admin/messages/en.json.
 */
export async function loginAsSuperAdmin(page: Page): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Label: "Email" (login.email in en.json) — id="email"
  await page.getByLabel('Email').fill(email);
  // Use id to avoid strict-mode conflicts with any other "Password" label
  await page.locator('#password').fill(password);

  // Button text: "Sign in" (login.submit in en.json)
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for redirect away from /login; admin shell renders an <aside>
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 10_000 });
}
