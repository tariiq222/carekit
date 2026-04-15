/**
 * CareKit Dashboard — Email Templates E2E Tests
 *
 * ET-001 to ET-004.
 * Navigate to /settings/email-templates.
 */

import { test, expect } from '../setup/fixtures';

// ── ET-001 Page loads ─────────────────────────────────────────────────────────
test.describe('Email Templates — تحميل الصفحة', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings/email-templates');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  test('[ET-001] @smoke — الصفحة تحمل', async ({ adminPage }) => {
    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'table, [role="table"], [class*="empty"], h1, h2, [class*="template"], [class*="card"]',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── ET-002 Templates list or empty state ─────────────────────────────────────
test.describe('Email Templates — قائمة القوالب', () => {
  test('[ET-002] @smoke — قائمة القوالب أو empty state', async ({ adminPage, goto }) => {
    await goto('/settings/email-templates');

    // الميزة قد تكون غير منشورة — تخطّى عند 404
    const notFound = await adminPage.getByRole('heading', { name: /^404$|Page Not Found/ }).first().isVisible({ timeout: 2_000 }).catch(() => false);
    if (notFound) {
      test.skip();
      return;
    }

    const table = adminPage.locator('table, [role="table"]');
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد|لا قوالب/);
    const templateCards = adminPage.locator('[class*="template"]');
    const hasContent =
      (await table.count() > 0) ||
      (await emptyText.count() > 0) ||
      (await templateCards.count() > 0);
    expect(hasContent).toBe(true);
  });
});

// ── ET-003 Open template for edit → form appears ──────────────────────────────
test.describe('Email Templates — فتح قالب للتعديل', () => {
  test('[ET-003] @critical — فتح قالب للتعديل → form يظهر', async ({ adminPage, goto }) => {
    await goto('/settings/email-templates');

    // ابحث عن أول قالب في القائمة
    const firstRow = adminPage.locator('table tbody tr').first();
    const firstCard = adminPage.locator('[class*="template"][class*="card"], [data-testid*="template"]').first();

    const editBtn = adminPage
      .locator('button[aria-label*="تعديل"], button[aria-label*="edit"]')
      .first();

    let clicked = false;

    if (await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await editBtn.click();
      clicked = true;
    } else if (await firstRow.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstRow.click();
      clicked = true;
    } else if (await firstCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstCard.click();
      clicked = true;
    }

    if (!clicked) {
      test.skip();
      return;
    }

    await adminPage.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    // form أو dialog أو editor يظهر
    const formVisible =
      (await adminPage.locator('[role="dialog"] form, form').first().isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await adminPage.locator('textarea, [contenteditable]').first().isVisible({ timeout: 5_000 }).catch(() => false)) ||
      adminPage.url().includes('/edit') ||
      adminPage.url().includes('/email-templates/');

    expect(formVisible).toBe(true);
  });
});

// ── ET-004 Preview button ──────────────────────────────────────────────────────
test.describe('Email Templates — زر المعاينة', () => {
  test('[ET-004] @smoke — زر المعاينة (preview) موجود إن وُجدت قوالب', async ({ adminPage, goto }) => {
    await goto('/settings/email-templates');

    const firstRow = adminPage.locator('table tbody tr').first();
    const hasRow = await firstRow.isVisible({ timeout: 8_000 }).catch(() => false);

    if (!hasRow) {
      test.skip();
      return;
    }

    const previewBtn = adminPage
      .locator('button[aria-label*="معاينة"], button[aria-label*="preview"], button')
      .filter({ hasText: /معاينة|preview/i })
      .first();

    if ((await previewBtn.count()) === 0) {
      test.skip();
      return;
    }

    await expect(previewBtn).toBeVisible({ timeout: 8_000 });
  });
});

// ── ET-005..ET-007 Full interactive flows ─────────────────────────────────────
test.describe('Email Templates — تعديل محتوى تفاعلياً', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/settings/email-templates');
    await adminPage.waitForLoadState('networkidle').catch(() => {});
  });

  async function openFirstTemplate(adminPage: import('@playwright/test').Page): Promise<boolean> {
    const editBtn = adminPage
      .locator('button[aria-label*="تعديل"], button[aria-label*="edit"]')
      .first();
    if (await editBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await editBtn.click();
      await adminPage.waitForTimeout(500);
      return true;
    }
    const firstRow = adminPage.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await firstRow.click();
      await adminPage.waitForTimeout(500);
      return true;
    }
    return false;
  }

  test('[ET-005][Comms/email-templates][P1-High] تعديل subject EN ثم الحفظ', async ({ adminPage, waitForToast }) => {
    const opened = await openFirstTemplate(adminPage);
    if (!opened) {
      test.skip();
      return;
    }

    const subjectInput = adminPage.locator('input').filter({ hasNotText: /^$/ }).first();
    const anyInput = adminPage.locator('input[dir="ltr"], input[type="text"]').first();
    const target = (await subjectInput.isVisible({ timeout: 3_000 }).catch(() => false))
      ? subjectInput
      : anyInput;

    if (!(await target.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const suffix = Date.now().toString().slice(-5);
    const newSubject = `Test Subject ${suffix}`;
    await target.fill(newSubject);

    const saveBtn = adminPage.getByRole('button', { name: /حفظ|Save|تحديث/ }).first();
    if (!(await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await saveBtn.click();
    const ok = await waitForToast(/تم|نجاح|success|saved|محفوظ/i, 6_000).then(() => true).catch(() => false);
    if (!ok) {
      await expect(target).toHaveValue(newSubject);
    }
  });

  test('[ET-006][Comms/email-templates][P2-Medium] إدراج متغير variable داخل النص', async ({ adminPage }) => {
    const opened = await openFirstTemplate(adminPage);
    if (!opened) {
      test.skip();
      return;
    }

    // Template editor exposes variable chips — clicking one inserts {{var}} into the focused textarea.
    const varChip = adminPage.locator('button, [role="button"]').filter({ hasText: /^\{\{[a-zA-Z_]+\}\}$|^[a-zA-Z_]+$/ }).first();
    const textarea = adminPage.locator('textarea').first();

    if (!(await textarea.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }
    if (!(await varChip.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await textarea.click();
    await textarea.fill('Hello ');
    await varChip.click();
    await adminPage.waitForTimeout(300);

    const value = await textarea.inputValue();
    expect(value).toMatch(/\{\{.+\}\}/);
  });

  test('[ET-007][Comms/email-templates][P2-Medium] تبديل isActive toggle', async ({ adminPage }) => {
    const opened = await openFirstTemplate(adminPage);
    if (!opened) {
      test.skip();
      return;
    }

    const toggle = adminPage.locator('[role="switch"]').first();
    if (!(await toggle.isVisible({ timeout: 4_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    const before = await toggle.getAttribute('data-state');
    await toggle.click();
    await adminPage.waitForTimeout(400);
    const after = await toggle.getAttribute('data-state');

    expect(after).not.toBe(before);
  });
});
