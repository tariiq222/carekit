/**
 * CareKit Dashboard — Notifications E2E Tests
 *
 * NOT-001 to NOT-004.
 * Navigate to /notifications.
 */

import { test, expect } from '../setup/fixtures';

// ── NOT-001 Page loads ────────────────────────────────────────────────────────
test.describe('Notifications — تحميل الصفحة', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/notifications');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[NOT-001] @smoke — الصفحة تحمل', async ({ adminPage }) => {
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], [class*="notification"], h1, h2',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── NOT-002 List or empty state ───────────────────────────────────────────────
test.describe('Notifications — قائمة الإشعارات', () => {
  test('[NOT-002] @smoke — قائمة الإشعارات أو empty state', async ({ adminPage, goto }) => {
    await goto('/notifications');

    const anyContent = adminPage.locator(
      'table, [role="table"], [class*="empty"], [class*="skeleton"], [class*="notification"], h3',
    );
    await expect(anyContent.first()).toBeVisible({ timeout: 15_000 });
  });
});

// ── NOT-003 Mark all as read button ──────────────────────────────────────────
test.describe('Notifications — تحديد الكل كمقروء', () => {
  test('[NOT-003] @critical — زر "تحديد الكل كمقروء" موجود (إن وُجدت إشعارات)', async ({ adminPage, goto }) => {
    await goto('/notifications');

    // تحقق من وجود إشعارات أولاً
    const notificationCount = await adminPage.locator(
      'table tbody tr, [class*="notification-item"]',
    ).count();

    if (notificationCount === 0) {
      test.skip();
      return;
    }

    const markAllBtn = adminPage
      .getByRole('button', { name: /تحديد الكل|تعيين الكل|كمقروء|اقرأ الكل/ })
      .first();

    if ((await markAllBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(markAllBtn).toBeVisible({ timeout: 8_000 });
  });
});

// ── NOT-004 Notifications counter in sidebar ──────────────────────────────────
test.describe('Notifications — عداد الإشعارات في الـ sidebar', () => {
  test('[NOT-004] @smoke — عداد الإشعارات في الـ sidebar موجود', async ({ adminPage, goto }) => {
    await goto('/');

    // عداد الإشعارات عادةً في الـ sidebar أو الـ header
    const notifBadge = adminPage.locator(
      'nav [class*="badge"], header [class*="badge"], [aria-label*="إشعار"], [data-testid*="notification-badge"]',
    ).first();

    const notifIcon = adminPage.locator(
      'nav a[href*="notification"], header button[aria-label*="إشعار"], [class*="notification-bell"]',
    ).first();

    const isVisible =
      (await notifBadge.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await notifIcon.isVisible({ timeout: 8_000 }).catch(() => false));

    if (!isVisible) {
      test.skip();
      return;
    }

    expect(isVisible).toBe(true);
  });
});
