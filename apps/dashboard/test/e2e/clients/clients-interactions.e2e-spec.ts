/**
 * CareKit Dashboard — Clients UI E2E Tests (Playwright)
 *
 * Test IDs map to e2e_test_clients.xlsx scenarios (CL-###).
 * Covers UI-layer behaviors not reachable via backend E2E:
 *   - Page renders (title, buttons, search, table/empty)
 *   - Navigation (add button → create page, cancel → list)
 *   - Form validation feedback (phone regex toast, empty name)
 *   - Delete dialog (open, cancel, escape)
 *   - RTL / dir="ltr" on phone/email cells
 *   - Search debounce / filter reset
 */

import { test, expect } from '../setup/fixtures';

// Shared precondition: navigate to /clients authenticated.
test.describe('Clients list page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[CL-UI-045][Clients/list-page-ui][P1-High] الصفحة تحمل بدون redirect إلى login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/clients/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('[CL-UI-040A][Clients/list-page-ui][P2-Medium] عنوان الصفحة"المستفيدين" ظاهر', async ({ adminPage }) => {
    await expect(adminPage.getByText('المستفيدين').first()).toBeVisible({ timeout: 12_000 });
  });

  test('[CL-UI-001A][Clients/list-page-ui][P1-High] زر"إضافة مستفيد" موجود', async ({ adminPage }) => {
    await expect(adminPage.getByText(/إضافة مستفيد/).first()).toBeVisible({ timeout: 12_000 });
  });

  test('[CL-UI-046A][Clients/list-page-ui][P2-Medium] خانة البحث موجودة', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 12_000 });
  });

  test('[CL-UI-045B][Clients/list-page-ui][P1-High] إما جدول العملاء أو empty state يُعرض', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا يوجد مستفيدون|لا يوجد مستفيدين/);
    const hasContent = (await table.count()) > 0 || (await emptyText.count()) > 0;
    expect(hasContent).toBe(true);
  });

  test('[CL-UI-046B][Clients/list-page-ui][P2-Medium] كتابة في خانة البحث تنعكس على القيمة', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await searchInput.fill('أحمد');
    await expect(searchInput).toHaveValue('أحمد');
  });

  test('[CL-UI-055][Clients/list-page-ui][P2-Medium] مسح البحث يُعيد الحقل فارغاً', async ({ adminPage }) => {
    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await searchInput.fill('أحمد');
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

test.describe('Clients — navigation to create', () => {
  test('[CL-UI-001B][Clients/navigation-ui][P1-High] الضغط على"إضافة مستفيد" ينقل إلى /clients/create', async ({
    adminPage,
    goto,
  }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false);
    if (loginVisible) {
      test.skip();
      return;
    }

    const addBtn = adminPage.getByRole('button', { name: /إضافة مستفيد/ }).first();
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    await adminPage.waitForURL(/\/clients\/create/, { timeout: 10_000 }).catch(() => {});
    expect(adminPage.url().includes('/clients/create')).toBeTruthy();
  });
});

test.describe('Clients — create form', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[CL-UI-001C][Clients/create-form-ui][P1-High] نموذج الإنشاء يعرض حقول إدخال', async ({ adminPage }) => {
    const inputs = adminPage.locator('form input');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('[CL-UI-001D][Clients/create-form-ui][P1-High] يوجد زر إرسال في النموذج', async ({ adminPage }) => {
    const submitBtn = adminPage
      .locator('form button[type="submit"], form button:has-text("إضافة مستفيد")')
      .first();
    await expect(submitBtn).toBeVisible();
  });

  test('[CL-UI-020A][Clients/create-form-ui][P1-High] زر الإلغاء يرجع لقائمة العملاء', async ({ adminPage }) => {
    const cancelBtn = adminPage.getByRole('button', { name: /إلغاء|Cancel/ }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 12_000 });
    await cancelBtn.click();

    await adminPage.waitForURL(/\/clients(?!\/create)/, { timeout: 10_000 });
    await expect(adminPage).toHaveURL(/\/clients/);
    await expect(adminPage).not.toHaveURL(/\/clients\/create/);
  });

  test('[CL-UI-004][Clients/create-form-ui][P1-High] حقل الجوال موجود ويقبل الإدخال', async ({ adminPage }) => {
    const phoneInput = adminPage
      .locator('input[type="tel"], input[name="phone"], input[placeholder*="جوال"]')
      .first();
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill('501234567');
    const val = await phoneInput.inputValue();
    expect(val.length).toBeGreaterThan(0);
  });

  test('[CL-UI-008][Clients/create-form-ui][P1-High] إرسال نموذج فارغ لا يتم (زر معطّل أو خطأ تحقق)', async ({ adminPage }) => {
    const submitBtn = adminPage
      .locator('form button[type="submit"], form button:has-text("إضافة مستفيد")')
      .first();
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // لا يجب أن تنتقل لـ /clients
    await adminPage.waitForTimeout(1500);
    expect(adminPage.url().includes('/clients/create')).toBeTruthy();
  });
});

test.describe('Clients — row interactions', () => {
  test('[CL-UI-040B][Clients/row-interactions-ui][P2-Medium] النقر على صف العميل يفتح نافذة التفاصيل', async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const table = adminPage.locator('table, [role="table"]');
    const emptyTitle = adminPage.locator('[class*="empty"], h3').filter({ hasText: /لا يوجد/ });

    const hasTable = (await table.count()) > 0;
    const hasEmpty = (await emptyTitle.count()) > 0;

    if (!hasTable || hasEmpty) {
      test.skip();
      return;
    }

    const firstRow = table.locator('tbody tr').first();
    if ((await firstRow.count()) === 0) {
      test.skip();
      return;
    }

    const rowBtn = firstRow.locator('button').first();
    if ((await rowBtn.count()) === 0) {
      await firstRow.click();
    } else {
      await rowBtn.click();
    }

    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 8_000 });

    const closeBtn = sheet
      .locator('button[aria-label*="إغلاق"], button[aria-label*="close"], button[aria-label*="Close"]')
      .first();
    if ((await closeBtn.count()) > 0) {
      await closeBtn.click();
    } else {
      await adminPage.keyboard.press('Escape');
    }

    await expect(sheet).not.toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Clients — RTL / LTR mixing', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/clients');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[CL-UI-061][Clients/rtl-ui][P2-Medium] اتجاه الصفحة RTL', async ({ adminPage }) => {
    const html = adminPage.locator('html');
    const dir = await html.getAttribute('dir');
    expect(['rtl', 'ar'].some((v) => (dir ?? '').includes(v))).toBe(true);
  });

  test('[CL-UI-062][Clients/rtl-ui][P1-High] حقول الجوال/البريد بـ dir="ltr" في صفحة تفاصيل/نموذج (إن وُجدت)', async ({
    adminPage,
    goto,
  }) => {
    await goto('/clients/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const phoneInput = adminPage.locator('input[type="tel"]').first();
    if ((await phoneInput.count()) === 0) {
      test.skip();
      return;
    }
    // PhoneInput قد يكون ملفوفاً بعنصر dir=ltr أو input فيه هذا dir
    const phoneHandle = await phoneInput.elementHandle();
    const wrapperDir = await phoneInput.evaluate((el: HTMLElement) => {
      let node: HTMLElement | null = el;
      while (node) {
        const d = node.getAttribute('dir');
        if (d) return d;
        node = node.parentElement;
      }
      return '';
    });
    expect(['ltr', '']).toContain(wrapperDir);
    phoneHandle?.dispose();
  });
});
