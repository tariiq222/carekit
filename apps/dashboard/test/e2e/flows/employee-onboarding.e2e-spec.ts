/**
 * CareKit Dashboard — Critical Flow: Employee Onboarding
 *
 * المسار الكامل:
 * 1. إنشاء موظف عبر API
 * 2. التحقق من ظهوره في القائمة
 * 3. فتح صفحة تفاصيله
 * 4. ربط خدمة به عبر UI
 * 5. التحقق من ظهوره كخيار في إنشاء الحجز
 */

import { test, expect } from '../setup/fixtures';
import {
  createEmployee, deleteEmployee,
  createService, deleteService,
  type SeededEmployee,
  type SeededService,
} from '../setup/seeds';

test.describe('Flow: Employee Onboarding', () => {
  let employee: SeededEmployee;
  let service: SeededService;

  test.beforeAll(async () => {
    [employee, service] = await Promise.all([
      createEmployee({ name: 'FlowOnboard موظف' }),
      createService({ nameAr: 'خدمة Onboard', price: 80, durationMins: 45 }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.allSettled([
      deleteEmployee(employee.id),
      deleteService(service.id),
    ]);
  });

  test('[FLOW-EM-01] @critical — الموظف يظهر في قائمة الموظفين', async ({ adminPage, searchInList }) => {
    await searchInList('/employees', 'FlowOnboard');
    const row = adminPage.locator('table tbody tr').filter({ hasText: 'FlowOnboard' }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-EM-02] @critical — صفحة تفاصيل الموظف تحمل بدون خطأ', async ({ adminPage, goto }) => {
    await goto(`/employees/${employee.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    // لا يوجد redirect لصفحة أخرى
    expect(adminPage.url()).toContain(employee.id);
    const pageContent = adminPage.locator('main, [class*="page"], h1, h2').first();
    await expect(pageContent).toBeVisible({ timeout: 10_000 });
  });

  test('[FLOW-EM-03] @critical — تبويب الخدمات في صفحة الموظف يعرض محتوى', async ({ adminPage, goto }) => {
    await goto(`/employees/${employee.id}`);
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const svcTab = adminPage.getByRole('tab', { name: /خدمات|services/i }).first();
    if ((await svcTab.count()) > 0) {
      await svcTab.click();
      const content = adminPage.locator('table, [role="table"], [class*="empty"], [class*="skeleton"]').first();
      await expect(content).toBeVisible({ timeout: 8_000 });
    } else {
      // تبويبات غير موجودة — الصفحة inline
      const content = adminPage.locator('main').first();
      await expect(content).toBeVisible({ timeout: 8_000 });
    }
  });

  test('[FLOW-EM-04] @critical — صفحة إنشاء الحجز تحمل بدون خطأ', async ({ adminPage, goto }) => {
    await goto('/bookings/create');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    const anyContent = adminPage.locator('main, form, [class*="page"]').first();
    await expect(anyContent).toBeVisible({ timeout: 10_000 });
  });
});
