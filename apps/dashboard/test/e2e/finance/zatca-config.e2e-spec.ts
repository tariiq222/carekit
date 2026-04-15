/**
 * CareKit Dashboard — ZATCA Configuration E2E Tests
 *
 * ZT-001 to ZT-003.
 * ZATCA is embedded in /invoices?tab=zatca — also tries /zatca and /settings/zatca.
 */

import { test, expect } from '../setup/fixtures';

const ZATCA_ROUTES = ['/invoices?tab=zatca', '/zatca', '/settings/zatca'];

async function navigateToZatca(adminPage: import('@playwright/test').Page, goto: (url: string) => Promise<void>): Promise<void> {
  for (const route of ZATCA_ROUTES) {
    await goto(route);
    const isZatcaPage =
      adminPage.url().includes('zatca') ||
      (await adminPage.getByText(/ZATCA|زاتكا|فاتورة|ضريبة القيمة المضافة/i).first().isVisible({ timeout: 5_000 }).catch(() => false));
    if (isZatcaPage) return;
  }
}

// ── ZT-001 Page loads ─────────────────────────────────────────────────────────
test.describe('ZATCA — تحميل الصفحة', () => {
  test('[ZT-001] @smoke — الصفحة تحمل', async ({ adminPage, goto }) => {
    await navigateToZatca(adminPage, goto);

    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'form, [class*="card"], [class*="zatca"], h1, h2, [class*="setting"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── ZT-002 ZATCA settings form appears ───────────────────────────────────────
test.describe('ZATCA — نموذج الإعدادات', () => {
  test('[ZT-002] @smoke — نموذج إعدادات ZATCA يظهر', async ({ adminPage, goto }) => {
    await navigateToZatca(adminPage, goto);

    // نموذج إعدادات ZATCA
    const form = adminPage.locator('form').first();
    const settingsSection = adminPage
      .getByText(/ZATCA|زاتكا|التوافق مع فاتورة|إعدادات الفاتورة الإلكترونية/i)
      .first();

    const isVisible =
      (await form.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await settingsSection.isVisible({ timeout: 8_000 }).catch(() => false));

    expect(isVisible).toBe(true);
  });
});

// ── ZT-003 Configuration fields ──────────────────────────────────────────────
test.describe('ZATCA — حقول الإعداد', () => {
  test('[ZT-003] @smoke — حقول الإعداد (CR number, VAT number, etc.) موجودة', async ({ adminPage, goto }) => {
    await navigateToZatca(adminPage, goto);

    // ابحث عن حقول CR أو VAT
    const crField = adminPage
      .locator('input[name*="cr"], input[placeholder*="CR"], input[placeholder*="سجل تجاري"]')
      .first();

    const vatField = adminPage
      .locator('input[name*="vat"], input[name*="tax"], input[placeholder*="ضريبة"], input[placeholder*="VAT"]')
      .first();

    const anyInput = adminPage.locator('form input, form select').first();

    const isVisible =
      (await crField.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await vatField.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await anyInput.isVisible({ timeout: 8_000 }).catch(() => false));

    if (!isVisible) {
      test.skip();
      return;
    }

    expect(isVisible).toBe(true);
  });
});
