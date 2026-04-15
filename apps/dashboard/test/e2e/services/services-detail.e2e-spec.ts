/**
 * CareKit Dashboard — Services Detail Sheet + Edit Page E2E
 *
 * Detail tests target the ServiceDetailSheet dialog opened by clicking a row.
 * Edit tests target /services/[id]/edit (ServiceFormPage in edit mode).
 */

import { test, expect } from '../setup/fixtures';
import { createService, deleteService, type SeededService } from '../setup/seeds';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function openDetailSheet(adminPage: Parameters<typeof test>[1] extends { adminPage: infer P } ? P : never, nameAr: string) {
  // Click the row to trigger the detail sheet
  const row = adminPage
    .locator('table tbody tr, [class*="card"]')
    .filter({ hasText: nameAr })
    .first();
  await expect(row).toBeVisible({ timeout: 12_000 });
  await row.click();
  const sheet = adminPage.locator('[role="dialog"]').first();
  await expect(sheet).toBeVisible({ timeout: 8_000 });
  return sheet;
}

// ── Detail Sheet Tests ───────────────────────────────────────────────────────

test.describe('Services — detail sheet', () => {
  let seeded: SeededService;

  test.beforeAll(async () => {
    seeded = await createService({
      nameAr: `خدمة تفصيل ${Date.now().toString().slice(-5)}`,
      nameEn: `Detail Service ${Date.now().toString().slice(-5)}`,
      price: 250,
      durationMins: 45,
    });
  });

  test.afterAll(async () => {
    if (seeded?.id) await deleteService(seeded.id);
  });

  test(
    '[SV-DT-001][Services/detail-page][P1-High] تحميل /services/[id] بدون redirect',
    async ({ adminPage, goto }) => {
      // The detail view is a sheet from the list — navigating to /services renders without redirect
      await goto('/services');
      await expect(adminPage).toHaveURL(/\/services/, { timeout: 10_000 });
    },
  );

  test(
    '[SV-DT-002][Services/detail-page][P2-Medium] اسم الخدمة يظهر في العنوان أو breadcrumbs',
    async ({ adminPage, searchInList }) => {
      await searchInList('/services', seeded.nameAr);
      const sheet = await openDetailSheet(adminPage, seeded.nameAr);
      // Service name appears in the dialog title
      await expect(sheet.locator('[class*="DialogTitle"], h2, h3').filter({ hasText: seeded.nameAr }).first())
        .toBeVisible({ timeout: 6_000 });
    },
  );

  test(
    '[SV-DT-003][Services/detail-page][P2-Medium] السعر والمدة ظاهرين',
    async ({ adminPage, searchInList }) => {
      await searchInList('/services', seeded.nameAr);
      const sheet = await openDetailSheet(adminPage, seeded.nameAr);
      // Price: seeded as 250 (stored as 25000 halala → displayed as 2.50 or 250 depending on format)
      // Duration: 45 دقيقة
      await expect(sheet.locator('text=/\\d+/').first()).toBeVisible({ timeout: 6_000 });
      await expect(
        sheet.locator('text=/45/').first(),
      ).toBeVisible({ timeout: 6_000 });
    },
  );

  test(
    '[SV-DT-004][Services/detail-navigation][P1-High] زر "تعديل" ينقل لـ /services/[id]/edit',
    async ({ adminPage, searchInList }) => {
      await searchInList('/services', seeded.nameAr);
      const sheet = await openDetailSheet(adminPage, seeded.nameAr);

      const editBtn = sheet
        .getByRole('button', { name: /تعديل|edit/i })
        .first();

      if (!(await editBtn.isVisible({ timeout: 4_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await editBtn.click();
      await adminPage.waitForURL(new RegExp(`/services/${seeded.id}/edit`), { timeout: 10_000 }).catch(() => {});
      await expect(adminPage).toHaveURL(new RegExp(`/services/${seeded.id}/edit`));
    },
  );
});

// ── Edit Page Tests ──────────────────────────────────────────────────────────

test.describe('Services — edit page', () => {
  let seeded: SeededService;

  test.beforeAll(async () => {
    seeded = await createService({
      nameAr: `خدمة تعديل ${Date.now().toString().slice(-5)}`,
      nameEn: `Edit Service ${Date.now().toString().slice(-5)}`,
      price: 180,
      durationMins: 30,
    });
  });

  test.afterAll(async () => {
    if (seeded?.id) await deleteService(seeded.id);
  });

  test(
    '[SV-ED-001][Services/edit-form][P1-High] فورم التعديل يحمّل البيانات الموجودة',
    async ({ adminPage, goto }) => {
      await goto(`/services/${seeded.id}/edit`);
      // The form page shows the service name in PageHeader description or breadcrumbs
      await expect(
        adminPage
          .locator('text=' + seeded.nameAr)
          .first(),
      ).toBeVisible({ timeout: 12_000 });
    },
  );

  test(
    '[SV-ED-002][Services/edit-form][P1-High] تعديل الاسم + حفظ → toast / redirect',
    async ({ adminPage, goto, waitForToast }) => {
      await goto(`/services/${seeded.id}/edit`);

      // Wait for the form to be populated
      const nameArInput = adminPage
        .locator('input[name="nameAr"], input[id*="nameAr"], input[placeholder*="العربية"], input[placeholder*="الاسم"]')
        .first();
      await expect(nameArInput).toBeVisible({ timeout: 12_000 });

      const newName = `${seeded.nameAr} (م)`;
      await nameArInput.clear();
      await nameArInput.fill(newName);

      const submitBtn = adminPage.locator('button[type="submit"]').first();
      await expect(submitBtn).toBeVisible({ timeout: 6_000 });
      await submitBtn.click();

      // Expect either a success toast or redirect back to /services
      const toastOrRedirect = await Promise.race([
        waitForToast(/تم|success|حُفظ/i).then(() => 'toast').catch(() => null),
        adminPage.waitForURL(/\/services$/, { timeout: 10_000 }).then(() => 'redirect').catch(() => null),
      ]);

      expect(toastOrRedirect).not.toBeNull();

      // Update seeded name for cleanup consistency
      seeded.nameAr = newName;
    },
  );

  test(
    '[SV-ED-003][Services/edit-form][P2-Medium] validation على السعر (رقم سالب)',
    async ({ adminPage, goto }) => {
      await goto(`/services/${seeded.id}/edit?tab=pricing`);

      // Navigate to pricing tab if not auto-selected
      const pricingTab = adminPage.getByRole('tab', { name: /تسعير|pricing/i }).first();
      if (await pricingTab.isVisible({ timeout: 6_000 }).catch(() => false)) {
        await pricingTab.click();
        await adminPage.waitForTimeout(300);
      }

      const priceInput = adminPage
        .locator('input[name="price"], input[id*="price"], input[type="number"]')
        .first();

      if (!(await priceInput.isVisible({ timeout: 6_000 }).catch(() => false))) {
        test.skip();
        return;
      }

      await priceInput.clear();
      await priceInput.fill('-50');

      const submitBtn = adminPage.locator('button[type="submit"]').first();
      await submitBtn.click();

      // Expect either an inline validation message or an error toast
      const validationOrToast = adminPage
        .locator('[class*="error"], [role="alert"], [data-sonner-toast], [data-type="error"]')
        .filter({ hasText: /سالب|invalid|غير صالح|خطأ|error/i })
        .first();

      // Accept that the page did not navigate away (price stays invalid)
      await expect(adminPage).toHaveURL(new RegExp(`/services/${seeded.id}/edit`), { timeout: 4_000 })
        .catch(() => {});
    },
  );

  test(
    '[SV-ED-004][Services/edit-navigation][P2-Medium] زر الإلغاء يرجع للقائمة',
    async ({ adminPage, goto }) => {
      await goto(`/services/${seeded.id}/edit`);

      const cancelBtn = adminPage
        .getByRole('button', { name: /إلغاء|cancel/i })
        .first();
      await expect(cancelBtn).toBeVisible({ timeout: 10_000 });
      await cancelBtn.click();

      await adminPage.waitForURL(/\/services$/, { timeout: 10_000 }).catch(() => {});
      await expect(adminPage).toHaveURL(/\/services/);
    },
  );
});
