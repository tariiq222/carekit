/**
 * E2E — Branch UI visibility gated on multi_branch feature flag
 *
 * Verifies that "تقييد الفروع" section in the service create page and the
 * branch filter in the services list are visible only when multi_branch is
 * enabled (both license AND feature flag). When disabled via license, both
 * must be hidden.
 *
 * Strategy: intercept /api/proxy/feature-flags/map to control the flag value
 * without touching the real database. This makes the test deterministic and
 * avoids side effects on shared state.
 */

import { test, expect } from '../setup/fixtures';

const BRANCH_CARD_TEXT = 'تقييد الفروع';
const BRANCH_FILTER_PLACEHOLDER = /الفروع/;

test.describe('Service create page — branch UI visibility', () => {
  test('hides "تقييد الفروع" card when multi_branch is disabled', async ({
    adminPage,
    goto,
    context,
  }) => {
    // Intercept the feature-flags map and return multi_branch: false
    await context.route('**/api/proxy/feature-flags/map', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            multi_branch: false,
            chatbot: true,
            ratings: true,
            intake_forms: true,
            reports: true,
            coupons: true,
          },
        }),
      });
    });

    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Branch restriction card must NOT be visible
    await expect(adminPage.getByText(BRANCH_CARD_TEXT)).not.toBeVisible({ timeout: 10_000 });
  });

  test('shows "تقييد الفروع" card when multi_branch is enabled', async ({
    adminPage,
    goto,
    context,
  }) => {
    // Intercept the feature-flags map and return multi_branch: true
    await context.route('**/api/proxy/feature-flags/map', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            multi_branch: true,
            chatbot: true,
            ratings: true,
            intake_forms: true,
            reports: true,
            coupons: true,
          },
        }),
      });
    });

    await goto('/services/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Branch restriction card MUST be visible
    await expect(adminPage.getByText(BRANCH_CARD_TEXT)).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Services list page — branch filter visibility', () => {
  test('hides branch filter when multi_branch is disabled', async ({
    adminPage,
    goto,
    context,
  }) => {
    await context.route('**/api/proxy/feature-flags/map', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { multi_branch: false },
        }),
      });
    });

    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Branch select filter must NOT be visible
    const branchFilter = adminPage.getByRole('combobox').filter({ hasText: BRANCH_FILTER_PLACEHOLDER });
    await expect(branchFilter).not.toBeVisible({ timeout: 10_000 });
  });

  test('shows branch filter when multi_branch is enabled', async ({
    adminPage,
    goto,
    context,
  }) => {
    await context.route('**/api/proxy/feature-flags/map', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { multi_branch: true },
        }),
      });
    });

    await goto('/services');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Branch select filter MUST be present somewhere in the FilterBar
    const branchFilter = adminPage.getByPlaceholder(BRANCH_FILTER_PLACEHOLDER);
    const branchSelect = adminPage.locator('button, [role="combobox"]').filter({ hasText: /الفروع/ });
    const hasFilter = (await branchFilter.count()) > 0 || (await branchSelect.count()) > 0;
    expect(hasFilter).toBe(true);
  });
});
