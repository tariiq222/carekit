import { test, expect } from '@playwright/test';

const FEATURE_GATED_PAGES = [
  { path: '/branches', name: 'Branches', feature: 'BRANCHES' },
  { path: '/intake-forms', name: 'Intake Forms', feature: 'INTAKE_FORMS' },
  { path: '/coupons', name: 'Coupons', feature: 'COUPONS' },
  { path: '/reports', name: 'Reports', feature: 'ADVANCED_REPORTS' },
  { path: '/chatbot', name: 'Chatbot', feature: 'AI_CHATBOT' },
  { path: '/activity-log', name: 'Activity Log', feature: 'ACTIVITY_LOG' },
];

test.describe('Feature-Gated Routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      const devEmail = process.env.NEXT_PUBLIC_DEV_EMAIL;
      const devPassword = process.env.NEXT_PUBLIC_DEV_PASSWORD;

      if (devEmail && devPassword) {
        const devLoginButton = page.locator('button:has-text("Dev Admin Login")');
        if (await devLoginButton.isVisible()) {
          await devLoginButton.click();
          await page.waitForURL('/', { timeout: 10000 });
        }
      }
    }

    await page.waitForTimeout(500);
  });

  for (const pageInfo of FEATURE_GATED_PAGES) {
    test(`should handle ${pageInfo.name} (${pageInfo.path}) route`, async ({ page }) => {
      test.skip(true, `Feature ${pageInfo.feature} requires premium plan - tested manually`);

      await page.goto(pageInfo.path, { timeout: 60000 });

      await page.waitForLoadState('domcontentloaded');

      await expect(page.locator('body')).toBeVisible();
    });
  }
});