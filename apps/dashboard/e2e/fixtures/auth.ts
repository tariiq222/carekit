/**
 * e2e/fixtures/auth.ts
 *
 * Auth persona helper for Playwright tests.
 *
 * Usage:
 *   import { loginAs } from '../fixtures/auth';
 *   await loginAs(page, 'admin');
 *
 * Credentials are sourced from env vars (set in CI) or fall back to the
 * seeded defaults from apps/backend/prisma/seed.ts.
 *
 * TODO: once globalSetup is enabled in playwright.config.ts, replace
 *       direct form login with storageState reuse for speed:
 *         test.use({ storageState: 'e2e/.auth/admin.json' });
 */

import { Page, expect } from '@playwright/test';

export type Persona = 'admin' | 'owner' | 'receptionist';

const PERSONA_CREDENTIALS: Record<Persona, { email: string; password: string }> = {
  admin: {
    email: process.env.SEED_EMAIL ?? 'admin@deqah-test.com',
    password: process.env.SEED_PASSWORD ?? 'Admin@1234',
  },
  owner: {
    email: process.env.SEED_OWNER_EMAIL ?? 'owner@deqah-test.com',
    password: process.env.SEED_OWNER_PASSWORD ?? 'Owner@1234',
  },
  receptionist: {
    email: process.env.SEED_RECEPTIONIST_EMAIL ?? 'receptionist@deqah-test.com',
    password: process.env.SEED_RECEPTIONIST_PASSWORD ?? 'Recept@1234',
  },
};

/**
 * Log in as a given persona by filling the login form.
 *
 * hCaptcha is bypassed automatically when NEXT_PUBLIC_HCAPTCHA_SITE_KEY
 * is unset — CaptchaField auto-issues "dev-bypass" on mount.
 */
export async function loginAs(page: Page, persona: Persona = 'admin'): Promise<void> {
  const { email, password } = PERSONA_CREDENTIALS[persona];

  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);

  // Wait for hCaptcha bypass to fire (mount effect) before filling form.
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="email"], #email', email);
  await page.fill('input[type="password"], #password', password);
  await page.click('button[type="submit"]');

  // Verify redirect to dashboard home.
  await page.waitForURL('/', { timeout: 30_000 });
}

/**
 * Log out the current user via the header user menu.
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/');

  // Header user button (last icon button in header)
  const userButton = page.locator('header button').filter({ has: page.locator('svg') }).last();
  if (await userButton.isVisible()) {
    await userButton.click();
    await page.waitForTimeout(300);

    const logoutButton = page.locator('text=/logout|تسجيل الخروج/i');
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForURL('/login', { timeout: 10_000 });
    }
  }
}

/**
 * Save storageState for a persona to disk.
 * Call this from globalSetup once storageState pre-seeding is enabled.
 *
 * TODO (fixtures/auth.ts): wire into globalSetup in playwright.config.ts
 *   globalSetup: require.resolve('./e2e/global-setup.ts')
 *   Then in tests: test.use({ storageState: storageStatePath('admin') })
 */
export function storageStatePath(persona: Persona): string {
  return `e2e/.auth/${persona}.json`;
}
