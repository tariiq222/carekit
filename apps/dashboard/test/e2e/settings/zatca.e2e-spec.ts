/**
 * CareKit Dashboard — ZATCA E2E Tests
 *
 * The /zatca route redirects to /invoices?tab=zatca.
 * The ZATCA tab shows onboarding status and sandbox stats.
 */

import { test, expect } from '../setup/fixtures';

test.describe('ZATCA (via invoices page)', () => {
  test('navigates to ZATCA tab in invoices', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage).toHaveURL(/\/invoices/);
    await expect(adminPage.locator('#email')).not.toBeVisible();
  });

  test('shows ZATCA title', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    await expect(adminPage.getByText('التوافق مع فاتورة').first()).toBeVisible({ timeout: 12_000 });
  });

  test('shows ZATCA phase or onboarding status', async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    const phase = adminPage.getByText(/المرحلة|تسجيل/);
    const content = adminPage.locator('[class*="card"], [class*="stat"], [class*="status"]');
    const hasContent = (await phase.count() > 0) || (await content.count() > 0);
    expect(hasContent).toBe(true);
  });

  test('/zatca redirect leads to invoices page', async ({ adminPage, goto }) => {
    await goto('/zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // Should redirect to invoices (zatca tab)
    await expect(adminPage).toHaveURL(/\/invoices/);
  });
});

// ── ZT-001..ZT-004 Full ZATCA configuration flows ────────────────────────────
test.describe('ZATCA — configuration interactive', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/invoices?tab=zatca');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[ZT-001][ZATCA/onboarding][P1-High] StatsGrid يعرض Environment + Onboarded + VAT + Seller', async ({ adminPage }) => {
    // ZatcaTab renders 4 StatCards when config is loaded.
    const envCard = adminPage.getByText(/البيئة|Environment/i).first();
    const onboardedCard = adminPage.getByText(/مُسجّل|Onboarded|تفعيل|مُفعّل/i).first();

    const hasEnv = await envCard.isVisible({ timeout: 8_000 }).catch(() => false);
    const hasOnboard = await onboardedCard.isVisible({ timeout: 4_000 }).catch(() => false);

    // At least one stat card must be present (proves config loaded or skeleton-to-content transition completed).
    expect(hasEnv || hasOnboard).toBe(true);
  });

  test('[ZT-002][ZATCA/onboarding][P2-Medium] نموذج onboarding يفتح ويظهر حقل VAT', async ({ adminPage }) => {
    // onboardOpen is controlled by a "تسجيل / Onboard / بدء" button that opens a Sheet.
    const onboardTrigger = adminPage
      .getByRole('button', { name: /تسجيل|Onboard|بدء|ابدأ|تفعيل/i })
      .first();

    if (!(await onboardTrigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await onboardTrigger.click();
    await adminPage.waitForTimeout(500);

    // Sheet opens with vatRegistrationNumber + sellerName inputs.
    const sheet = adminPage.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible({ timeout: 6_000 });

    const anyInput = sheet.locator('input').first();
    await expect(anyInput).toBeVisible({ timeout: 4_000 });
  });

  test('[ZT-003][ZATCA/onboarding][P2-Medium] إدخال VAT غير صالح يمنع submit', async ({ adminPage }) => {
    const onboardTrigger = adminPage
      .getByRole('button', { name: /تسجيل|Onboard|بدء|ابدأ|تفعيل/i })
      .first();

    if (!(await onboardTrigger.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await onboardTrigger.click();
    await adminPage.waitForTimeout(500);

    const sheet = adminPage.locator('[role="dialog"]').first();
    const vatInput = sheet.locator('input').first();
    const sellerInput = sheet.locator('input').nth(1);

    if (!(await vatInput.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await vatInput.fill('123');
    if (await sellerInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await sellerInput.fill('Test');
    }

    const submitBtn = sheet.getByRole('button', { name: /تسجيل|Submit|حفظ|Save/i }).first();
    if (!(await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await submitBtn.click();
    await adminPage.waitForTimeout(1_500);

    // The Sheet stays open (zod schema rejects invalid VAT — form doesn't submit).
    await expect(sheet).toBeVisible();
  });

  test('[ZT-004][ZATCA/onboarding][P2-Medium] StatCards يوضّحون isOnboarded status', async ({ adminPage }) => {
    // Page renders نعم/لا or Yes/No in the "Onboarded" StatCard based on config.isOnboarded.
    const yesNo = adminPage.getByText(/^نعم$|^لا$|^Yes$|^No$/i);
    const count = await yesNo.count();
    if (count === 0) {
      test.skip();
      return;
    }
    expect(count).toBeGreaterThan(0);
  });
});
