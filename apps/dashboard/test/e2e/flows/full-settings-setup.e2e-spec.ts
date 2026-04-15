/**
 * CareKit Dashboard — Critical Flow: Full Settings Setup
 *
 * المسار الكامل:
 * 1. إنشاء فرع جديد (seed)
 * 2. إنشاء خدمة جديدة (seed)
 * 3. إنشاء موظف جديد (seed)
 * 4. التحقق من ظهور كل الكيانات في الداشبورد
 * 5. التحقق من أن الحجز ممكن (صفحة create تحمل)
 */

import { test, expect } from '../setup/fixtures';
import {
  createBranch, deleteBranch,
  createService, deleteService,
  createEmployee, deleteEmployee,
  type SeededBranch,
  type SeededService,
  type SeededEmployee,
} from '../setup/seeds';

test.describe('Flow: Full Settings Setup', () => {
  let branch: SeededBranch;
  let service: SeededService;
  let employee: SeededEmployee;

  test.beforeAll(async () => {
    [branch, service, employee] = await Promise.all([
      createBranch({ nameAr: 'فرع الإعداد الكامل', city: 'جدة' }),
      createService({ nameAr: 'خدمة الإعداد', price: 150, durationMins: 45 }),
      createEmployee({ name: 'موظف الإعداد الكامل' }),
    ]);
  });

  test.afterAll(async () => {
    await Promise.allSettled([
      deleteBranch(branch.id),
      deleteService(service.id),
      deleteEmployee(employee.id),
    ]);
  });

  test('[FLOW-SET-01] @critical — الفرع المُنشأ يظهر في قائمة الفروع', async ({ adminPage, searchInList }) => {
    await searchInList('/branches', 'الإعداد الكامل');
    const row = adminPage.locator('table tbody tr, [class*="card"]').filter({ hasText: 'الإعداد الكامل' }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-SET-02] @critical — الخدمة المُنشأة تظهر في قائمة الخدمات', async ({ adminPage, searchInList }) => {
    await searchInList('/services', service.nameAr);
    const row = adminPage.locator('table tbody tr, [class*="card"]').filter({ hasText: service.nameAr }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-SET-03] @critical — الموظف المُنشأ يظهر في قائمة الموظفين', async ({ adminPage, searchInList }) => {
    await searchInList('/employees', 'الإعداد الكامل');
    const row = adminPage.locator('table tbody tr').filter({ hasText: 'الإعداد الكامل' }).first();
    await expect(row).toBeVisible({ timeout: 12_000 });
  });

  test('[FLOW-SET-04] @critical — صفحة إعدادات العيادة تحمل بدون خطأ', async ({ adminPage, goto }) => {
    await goto('/settings');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    const content = adminPage.locator('main, [class*="page"], h1').first();
    await expect(content).toBeVisible({ timeout: 10_000 });
  });

  test('[FLOW-SET-05] @critical — صفحة الحجوزات تحمل بعد اكتمال الإعداد', async ({ adminPage, goto }) => {
    await goto('/bookings');
    const content = adminPage.locator('table, [role="table"], [class*="empty"], [class*="skeleton"]').first();
    await expect(content).toBeVisible({ timeout: 12_000 });
  });
});
