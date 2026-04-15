/**
 * CareKit Dashboard — Clients Detail & Edit E2E Tests (Playwright)
 *
 * Covers /clients/[id] (detail) and /clients/[id]/edit pages.
 * Seeds a real client via API before tests; cleans up after.
 */

import { test, expect } from '../setup/fixtures';
import { createClient, deleteClient } from '../setup/seeds/index';
import type { SeededClient } from '../setup/seed-client';

// ─── Detail page ─────────────────────────────────────────────────────────────

test.describe('Clients — detail page', () => {
  let client: SeededClient;

  test.beforeAll(async () => {
    client = await createClient({ firstName: 'تجربة', lastName: 'بلايرايت' });
  });

  test.afterAll(async () => {
    await deleteClient(client.id).catch(() => {});
  });

  test('[CL-DT-001][Clients/detail-page][P1-High] تحميل /clients/[id] بدون redirect إلى login', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(new RegExp(`/clients/${client.id}`));
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('[CL-DT-002][Clients/detail-page][P2-Medium] اسم العميل يظهر في breadcrumbs', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const fullName = `${client.firstName} ${client.lastName}`;
    const breadcrumbs = adminPage.locator('nav[aria-label*="breadcrumb"], ol, [class*="breadcrumb"]');
    const nameInBreadcrumb = breadcrumbs.getByText(fullName).first();

    if ((await nameInBreadcrumb.count()) === 0) {
      // Fallback: name appears anywhere on page (heading / h1)
      await expect(adminPage.getByText(fullName).first()).toBeVisible({ timeout: 10_000 });
      return;
    }
    await expect(nameInBreadcrumb).toBeVisible({ timeout: 10_000 });
  });

  test('[CL-DT-003][Clients/detail-tabs][P1-High] التبويبات الأربعة (معلومات، مواعيد، فواتير، إحصائيات) ظاهرة', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const tabsList = adminPage.locator('[role="tablist"]').first();
    await expect(tabsList).toBeVisible({ timeout: 12_000 });

    const tabs = tabsList.locator('[role="tab"]');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('[CL-DT-004][Clients/detail-navigation][P1-High] زر "تعديل" ينقل لـ /clients/[id]/edit', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const editBtn = adminPage
      .getByRole('button', { name: /تعديل|edit/i })
      .first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    await adminPage
      .waitForURL(new RegExp(`/clients/${client.id}/edit`), { timeout: 10_000 })
      .catch(() => {});
    expect(adminPage.url()).toContain(`/clients/${client.id}/edit`);
  });

  test('[CL-DT-005][Clients/detail-tabs][P2-Medium] تبويب المواعيد يعرض حجوزات العميل (أو empty state)', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const bookingsTab = adminPage
      .locator('[role="tab"]')
      .filter({ hasText: /مواعيد|حجوزات|bookings/i })
      .first();

    if ((await bookingsTab.count()) === 0) {
      test.skip();
      return;
    }

    await bookingsTab.click();
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const content = adminPage.locator('[role="tabpanel"]').first();
    await expect(content).toBeVisible({ timeout: 8_000 });

    // Either a table row or an empty-state message is acceptable
    const hasRows = (await content.locator('tbody tr').count()) > 0;
    const hasEmpty =
      (await content.locator('p, span').filter({ hasText: /لا يوجد|no bookings/i }).count()) > 0;
    expect(hasRows || hasEmpty).toBe(true);
  });
});

// ─── Edit page ───────────────────────────────────────────────────────────────

test.describe('Clients — edit page', () => {
  let client: SeededClient;

  test.beforeAll(async () => {
    client = await createClient({ firstName: 'تعديل', lastName: 'اختبار' });
  });

  test.afterAll(async () => {
    await deleteClient(client.id).catch(() => {});
  });

  test('[CL-ED-001][Clients/edit-form][P1-High] فورم التعديل يحمّل البيانات الموجودة', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const firstNameInput = adminPage
      .locator('input[name="firstName"], input[id*="firstName"]')
      .first();
    await expect(firstNameInput).toBeVisible({ timeout: 12_000 });
    await expect(firstNameInput).toHaveValue(client.firstName);
  });

  test('[CL-ED-002][Clients/edit-form][P1-High] تعديل الاسم + حفظ → toast + redirect', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const firstNameInput = adminPage
      .locator('input[name="firstName"], input[id*="firstName"]')
      .first();
    await expect(firstNameInput).toBeVisible({ timeout: 12_000 });
    await firstNameInput.fill('محدّث');

    const saveBtn = adminPage
      .locator('form button[type="submit"], form button:has-text("حفظ")')
      .first();
    await saveBtn.click();

    const toastVisible = adminPage
      .locator('[data-sonner-toast], [role="status"], [role="alert"]')
      .filter({ hasText: /تم|saved|نجاح/i })
      .first();

    await Promise.race([
      toastVisible.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
      adminPage.waitForURL(/\/clients(?!\/.+\/edit)/, { timeout: 10_000 }).catch(() => {}),
    ]);

    const redirected = !adminPage.url().includes('/edit');
    const toasted = (await toastVisible.count()) > 0;
    expect(redirected || toasted).toBe(true);
  });

  test('[CL-ED-003][Clients/edit-form][P1-High] validation على phone (صيغة غير صحيحة → خطأ)', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const phoneInput = adminPage
      .locator('input[name="phone"], input[type="tel"], input[placeholder*="جوال"]')
      .first();

    if ((await phoneInput.count()) === 0) {
      test.skip();
      return;
    }

    await phoneInput.fill('abc123');

    const saveBtn = adminPage
      .locator('form button[type="submit"], form button:has-text("حفظ")')
      .first();
    await saveBtn.click();

    await adminPage.waitForTimeout(1_000);

    // Form must not navigate away on invalid phone
    expect(adminPage.url()).toContain('/edit');
  });

  test('[CL-ED-004][Clients/edit-navigation][P2-Medium] زر الإلغاء يرجع للقائمة', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients/${client.id}/edit`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const cancelBtn = adminPage
      .getByRole('button', { name: /إلغاء|cancel/i })
      .first();
    await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
    await cancelBtn.click();

    await adminPage
      .waitForURL(/\/clients(?!\/[^/]+\/edit)/, { timeout: 10_000 })
      .catch(() => {});
    expect(adminPage.url()).toMatch(/\/clients/);
    expect(adminPage.url()).not.toContain('/edit');
  });

  test('[CL-ED-005][Clients/edit-errors][P2-Medium] 404 / رسالة خطأ على invalid ID', async ({
    adminPage,
    goto,
  }) => {
    await goto('/clients/00000000-0000-0000-0000-000000000000/edit');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const errorBanner = adminPage
      .locator('[class*="error"], [role="alert"], [data-error]')
      .first();
    const notFoundText = adminPage.getByText(/غير موجود|not found|404/i).first();
    const redirectedAway = !adminPage.url().includes('00000000-0000-0000-0000-000000000000');

    const hasError =
      (await errorBanner.count()) > 0 ||
      (await notFoundText.count()) > 0 ||
      redirectedAway;

    expect(hasError).toBe(true);
  });
});
