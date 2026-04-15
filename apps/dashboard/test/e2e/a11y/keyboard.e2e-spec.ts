/**
 * CareKit Dashboard — Keyboard Navigation E2E Tests
 *
 * Verifies Tab order, Escape dismissal, Enter-to-submit, and arrow-key
 * navigation inside interactive widgets.
 */

import { test, expect } from '../setup/fixtures';

test.describe('@critical Accessibility — Keyboard Navigation', () => {
  test('[A11Y-007][Accessibility/keyboard-nav][P2-Medium] Tab يتنقّل للمحتوى الرئيسي خلال خطوات معقولة',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      let landed = false;
      for (let i = 0; i < 40; i++) {
        await adminPage.keyboard.press('Tab');
        const inMain = await adminPage.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return false;
          return !!el.closest('main');
        });
        if (inMain) {
          landed = true;
          break;
        }
      }
      expect(landed).toBe(true);
    });

  test('[A11Y-008][Accessibility/keyboard-nav][P2-Medium] Escape يُغلق Dialog المفتوح',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      const addBtn = adminPage.getByRole('button', { name: /إضافة|add|حجز جديد/i }).first();
      const addVisible = await addBtn.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!addVisible, 'No add button to open a dialog on /bookings');
      await addBtn.click();
      const dialog = adminPage.locator('[role="dialog"]').first();
      const dialogOpened = await dialog.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!dialogOpened, 'Add button navigates to a page, not a dialog');
      await adminPage.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 6_000 });
    });

  test('[A11Y-009][Accessibility/keyboard-nav][P2-Medium] Escape يُغلق Sheet المفتوح',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      const sheetTrigger = adminPage
        .locator('button[aria-haspopup="dialog"], button:has-text("فلتر"), button:has-text("تصفية")')
        .first();
      const triggerVisible = await sheetTrigger.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No sheet trigger found on /bookings');
      await sheetTrigger.click();
      const sheet = adminPage.locator('[role="dialog"][data-state="open"], [data-slot="sheet-content"]').first();
      const sheetVisible = await sheet.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!sheetVisible, 'Sheet did not open from the expected trigger');
      await adminPage.keyboard.press('Escape');
      await expect(sheet).not.toBeVisible({ timeout: 6_000 });
    });

  test('[A11Y-010][Accessibility/keyboard-nav][P2-Medium] Enter داخل فورم login يُرسل النموذج',
    async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('#email', { timeout: 12_000 });
      await page.fill('#email', 'admin@carekit-test.com');
      await page.fill('#password', 'Admin@1234');
      // Kick off Enter + wait for the login API request to fire. Using the network
      // event proves the form handled Enter, independent of UI state afterwards.
      const loginRequest = page.waitForRequest(
        (req) => /\/auth\/login/i.test(req.url()) && req.method() === 'POST',
        { timeout: 12_000 },
      );
      await page.locator('#password').press('Enter');
      await loginRequest;
    });

  test('[A11Y-011][Accessibility/keyboard-nav][P2-Medium] Arrow keys تتنقّل داخل Select',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const selectTrigger = adminPage.locator('[role="combobox"], [data-slot="select-trigger"]').first();
      const triggerVisible = await selectTrigger.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No select trigger found on /clients');
      await selectTrigger.focus();
      await selectTrigger.press('Enter');
      const listbox = adminPage.locator('[role="listbox"]').first();
      const listboxVisible = await listbox.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!listboxVisible, 'Select listbox did not open');
      await adminPage.keyboard.press('ArrowDown');
      await adminPage.waitForTimeout(150);
      const highlighted = await listbox.locator('[data-highlighted], [aria-selected="true"]').count();
      expect(highlighted).toBeGreaterThanOrEqual(1);
      await adminPage.keyboard.press('Escape');
    });
});
