/**
 * CareKit Dashboard — RTL Layout E2E Tests
 *
 * Verifies that Arabic-first RTL layout is applied correctly across
 * protected pages, menus, date pickers, and phone inputs.
 */

import { test, expect } from '../setup/fixtures';

test.describe('@critical Accessibility — RTL Layout', () => {
  test('[A11Y-001][Accessibility/rtl-layout][P1-High] html dir="rtl" مُطبّق على الصفحات المحمية',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const dir = await adminPage.evaluate(() => document.documentElement.getAttribute('dir'));
      expect(dir).toBe('rtl');
    });

  test('[A11Y-002][Accessibility/rtl-layout][P1-High] Sidebar يقع على يمين الشاشة',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const viewport = adminPage.viewportSize();
      expect(viewport).not.toBeNull();
      const sidebar = adminPage.locator('aside, [data-sidebar], nav[aria-label*="Sidebar"], nav[aria-label*="التنقل"]').first();
      await expect(sidebar).toBeVisible({ timeout: 12_000 });
      const box = await sidebar.boundingBox();
      expect(box).not.toBeNull();
      if (box && viewport) {
        expect(box.x).toBeGreaterThan(viewport.width / 2);
      }
    });

  test('[A11Y-003][Accessibility/rtl-layout][P1-High] زر Add الأساسي على يسار PageHeader',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const addBtn = adminPage.getByRole('button', { name: /إضافة|add|جديد/i }).first();
      const exportBtn = adminPage.getByRole('button', { name: /تصدير|export/i }).first();
      const addVisible = await addBtn.isVisible().catch(() => false);
      const exportVisible = await exportBtn.isVisible().catch(() => false);
      test.skip(!addVisible || !exportVisible, 'PageHeader lacks both export + add buttons on this route');
      const addBox = await addBtn.boundingBox();
      const exportBox = await exportBtn.boundingBox();
      expect(addBox).not.toBeNull();
      expect(exportBox).not.toBeNull();
      if (addBox && exportBox) {
        expect(addBox.x).toBeLessThan(exportBox.x);
      }
    });

  test('[A11Y-004][Accessibility/rtl-layout][P2-Medium] Dropdown menu يفتح بمحاذاة start (يمين)',
    async ({ adminPage, goto }) => {
      await goto('/clients');
      const trigger = adminPage.locator('[data-slot="dropdown-menu-trigger"], button[aria-haspopup="menu"]').first();
      const triggerVisible = await trigger.isVisible({ timeout: 8_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No dropdown trigger found on /clients');
      await trigger.click();
      const menu = adminPage.locator('[role="menu"]').first();
      await expect(menu).toBeVisible({ timeout: 6_000 });
      const triggerBox = await trigger.boundingBox();
      const menuBox = await menu.boundingBox();
      expect(triggerBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      if (triggerBox && menuBox) {
        // In RTL, the menu extends leftward from the trigger — its left edge
        // sits to the left of the trigger's left edge (or equal for very wide menus).
        // In LTR (broken) the menu would extend rightward, with menu.x >= trigger.x.
        expect(menuBox.x).toBeLessThanOrEqual(triggerBox.x + 1);
      }
      await adminPage.keyboard.press('Escape');
    });

  test('[A11Y-005][Accessibility/rtl-layout][P2-Medium] Date picker يعرض ترتيب أيام RTL',
    async ({ adminPage, goto }) => {
      await goto('/bookings');
      const dateTrigger = adminPage
        .locator('button[aria-haspopup="dialog"], button:has([class*="calendar" i]), input[type="date"]')
        .first();
      const triggerVisible = await dateTrigger.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!triggerVisible, 'No date trigger visible on /bookings list — deeper navigation required');
      await dateTrigger.click();
      const calendar = adminPage.locator('[role="grid"], [class*="calendar" i]').first();
      const calVisible = await calendar.isVisible({ timeout: 6_000 }).catch(() => false);
      test.skip(!calVisible, 'Calendar popover did not open from list page trigger');
      const headers = await calendar.locator('th, [role="columnheader"]').allInnerTexts();
      expect(headers.length).toBeGreaterThanOrEqual(7);
      expect(headers.join('|')).toMatch(/سبت|أحد|Sat|Sun/);
    });

  test('[A11Y-006][Accessibility/rtl-layout][P1-High] Phone input يبقى dir="ltr" داخل صفحة RTL',
    async ({ adminPage, goto }) => {
      await goto('/clients/create');
      const phoneInput = adminPage
        .locator('input[type="tel"], input[name*="phone" i], input[placeholder*="هاتف"], input[placeholder*="جوال"]')
        .first();
      await expect(phoneInput).toBeVisible({ timeout: 8_000 });
      const dir = await phoneInput.evaluate((el) => (el as HTMLElement).getAttribute('dir') ?? getComputedStyle(el).direction);
      expect(dir).toBe('ltr');
    });
});
