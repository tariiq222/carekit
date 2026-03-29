/**
 * CareKit Dashboard — Chatbot Page E2E Tests
 *
 * The /chatbot route has 4 tabs: المحادثات, قاعدة المعرفة, الإعدادات, التحليلات
 */

import { test, expect } from '../setup/fixtures';

test.describe('Chatbot page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/chatbot');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('loads without being redirected to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/chatbot/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows the page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('إدارة الشات بوت').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows sessions tab', async ({ adminPage }) => {
    await expect(adminPage.getByText('المحادثات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows knowledge base tab', async ({ adminPage }) => {
    await expect(adminPage.getByText('قاعدة المعرفة').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows analytics tab', async ({ adminPage }) => {
    await expect(adminPage.getByText('التحليلات').first()).toBeVisible({ timeout: 12_000 });
  });

  test('renders sessions list or empty state by default', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText('لا توجد محادثات بعد');
    const hasContent = (await table.count() > 0) || (await emptyText.count() > 0);
    expect(hasContent).toBe(true);
  });
});
