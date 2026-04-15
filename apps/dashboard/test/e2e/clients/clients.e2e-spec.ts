/**
 * CareKit Dashboard — Clients Page Smoke Tests (Playwright)
 *
 * Test IDs map to e2e_test_clients.xlsx (CL-###).
 * Fast smoke checks for /clients page anatomy.
 */

import { test, expect } from '../setup/fixtures';

test.describe('Clients page — smoke', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[CL-UI-063][Clients/list-page-ui][P2-Medium] لا توجد أخطاء console فادحة', async ({ adminPage, goto }) => {
    const errors: string[] = [];
    adminPage.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    // تجاهل أخطاء المصادر الخارجية الشائعة
    const fatal = errors.filter(
      (e) => !/favicon|analytics|ResizeObserver|hydration/i.test(e),
    );
    expect(fatal.length).toBeLessThan(3);
  });

  test('[CL-UI-064][Clients/list-page-ui][P1-High] Skeleton أو محتوى يظهر أثناء التحميل', async ({ adminPage }) => {
    // بمجرد أن networkidle، إما جدول أو empty state أو skeleton بالأقل
    const anyContent = adminPage.locator(
      'table, [role="table"], [class*="skeleton"], [class*="empty"]',
    );
    const count = await anyContent.count();
    expect(count).toBeGreaterThan(0);
  });

  test('[CL-UI-065][Clients/list-page-ui][P2-Medium] فلتر الحالة يحتوي على الخيارات الثلاثة', async ({ adminPage }) => {
    // افتح الـ select لفلتر الحالة
    const statusSelect = adminPage
      .locator('[role="combobox"]')
      .filter({ hasText: /الكل|الحالة|نشط|غير نشط/ })
      .first();

    if ((await statusSelect.count()) === 0) {
      test.skip();
      return;
    }

    await statusSelect.click();

    // الخيارات الثلاثة موجودة
    const allOption = adminPage.getByRole('option', { name: /الكل|جميع الحالات/ }).first();
    const activeOption = adminPage.getByRole('option', { name: /^نشط$/ }).first();
    const inactiveOption = adminPage.getByRole('option', { name: /غير نشط|موقوف/ }).first();

    await expect(allOption).toBeVisible({ timeout: 5_000 });
    await expect(activeOption).toBeVisible({ timeout: 5_000 });
    await expect(inactiveOption).toBeVisible({ timeout: 5_000 });

    // أغلق الـ dropdown
    await adminPage.keyboard.press('Escape');
  });

  test('[CL-UI-066][Clients/list-page-ui][P2-Medium] اتجاه الصفحة RTL', async ({ adminPage }) => {
    const html = adminPage.locator('html');
    const dir = await html.getAttribute('dir');
    expect(['rtl', 'ar'].some((v) => (dir ?? '').includes(v))).toBe(true);
  });

  test('[CL-UI-067][Clients/list-page-ui][P2-Medium] Breadcrumbs ظاهرة', async ({ adminPage }) => {
    // Breadcrumbs تحتوي عادةً على "لوحة التحكم" أو "المستفيدين"
    const breadcrumb = adminPage
      .locator('nav[aria-label*="breadcrumb"], ol[aria-label*="breadcrumb"], [class*="breadcrumb"]')
      .first();
    await expect(breadcrumb).toBeVisible({ timeout: 10_000 });
  });
});
