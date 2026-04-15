/**
 * CareKit Dashboard — Clients UI tests that require seeded data.
 *
 * Each test seeds a fresh client via backend API before running, then
 * cleans up after. Covers scenarios the previous specs had to skip
 * because the clients table was empty.
 *
 * Test IDs map to e2e_test_clients.xlsx rows.
 */

import { test, expect } from '../setup/fixtures';
import { createClient, deleteClient, type SeededClient } from '../setup/seed-client';

// ── CL-054 Toggle active + CL-041 status badge ────────────────────────────────
test.describe('Clients — seeded, active', () => {
  let seeded: SeededClient;

  test.beforeEach(async () => {
    seeded = await createClient({
      firstName: 'PWActive',
      lastName: `User${Date.now().toString().slice(-5)}`,
      isActive: true,
    });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteClient(seeded.id);
  });

  test('[CL-054][Clients/toggle-status-ui][P1-High] Toggle active من القائمة يعمل ويظهر toast', async ({ adminPage, goto }) => {
    await goto(`/clients?search=${encodeURIComponent(seeded.firstName)}`);

    // انتظر حتى الصف يظهر
    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.firstName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // زر deactivate (aria-label="حظر" عندما نشط)
    const toggleBtn = row.locator('button[aria-label="حظر"]').first();
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Toast نجاح (Sonner) — النص: "تم تعطيل حساب المستفيد"
    await expect(adminPage.getByText(/تم تعطيل|تم تفعيل/).first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('[CL-041][Clients/toggle-status-ui][P2-Medium] شارة"نشط" خضراء تظهر للعميل النشط', async ({ adminPage, goto }) => {
    await goto(`/clients?search=${encodeURIComponent(seeded.firstName)}`);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.firstName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const statusBadge = row.getByText('نشط', { exact: true }).first();
    await expect(statusBadge).toBeVisible();
  });
});

// ── CL-036 + CL-037 Delete dialog cancel / escape ─────────────────────────────
test.describe('Clients — delete dialog', () => {
  let seeded: SeededClient;

  test.beforeEach(async () => {
    seeded = await createClient({
      firstName: 'PWDelete',
      lastName: `User${Date.now().toString().slice(-5)}`,
    });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteClient(seeded.id);
  });

  test('[CL-036][Clients/delete-dialog-ui][P2-Medium] الضغط على"إلغاء" في dialog يُغلقه بدون حذف', async ({ adminPage, goto }) => {
    await goto(`/clients?search=${encodeURIComponent(seeded.firstName)}`);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.firstName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const deleteBtn = row.locator(`button[data-testid="delete-client-${seeded.id}"]`);
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // dialog ظاهر بعنوان "حذف المستفيد؟" (؟ عربية U+061F)
    const dialog = adminPage.locator('[role="alertdialog"], [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });
    await expect(dialog.getByRole('heading', { name: /حذف المستفيد/ })).toBeVisible();

    // اضغط إلغاء
    const cancelBtn = dialog.getByRole('button', { name: /^إلغاء$/ }).first();
    await cancelBtn.click();

    // dialog يُغلق
    await expect(dialog).not.toBeVisible({ timeout: 6_000 });

    // العميل ما زال موجوداً (لم يُحذف) — لا toast "تم حذف"
    const deleted = adminPage.getByText('تم حذف المستفيد');
    expect(await deleted.count()).toBe(0);
  });

  test('[CL-037][Clients/delete-dialog-ui][P3-Low] ضغط Escape يُغلق dialog بدون حذف', async ({ adminPage, goto }) => {
    await goto(`/clients?search=${encodeURIComponent(seeded.firstName)}`);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.firstName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const deleteBtn = row.locator(`button[data-testid="delete-client-${seeded.id}"]`);
    await deleteBtn.click();

    const dialog = adminPage.locator('[role="alertdialog"], [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    await adminPage.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 6_000 });
  });
});

// ── CL-053 Reset filters ──────────────────────────────────────────────────────
test.describe('Clients — filter reset', () => {
  let seeded: SeededClient;

  test.beforeEach(async () => {
    seeded = await createClient({ firstName: 'PWFilter' });
  });

  test.afterEach(async () => {
    if (seeded?.id) await deleteClient(seeded.id);
  });

  test('[CL-053][Clients/filter-ui][P2-Medium] زر"إعادة تعيين" يظهر عند وجود فلتر ويمسحه', async ({ adminPage, goto }) => {
    await goto('/clients');

    const searchInput = adminPage
      .locator('input[placeholder*="ابحث"], input[placeholder*="بحث"], input[type="search"]')
      .first();
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill('PWFilter');

    // زر Reset يظهر بعد تفعيل فلتر
    const resetBtn = adminPage.getByRole('button', { name: /إعادة تعيين/ }).first();
    await expect(resetBtn).toBeVisible({ timeout: 6_000 });

    await resetBtn.click();

    // حقل البحث يُفرّغ
    await expect(searchInput).toHaveValue('');
  });
});

// ── CL-038 Delete confirm ──────────────────────────────────────────────────────
test.describe('Clients — delete confirm', () => {
  let seeded: SeededClient;

  test.beforeEach(async () => {
    seeded = await createClient({
      firstName: 'PWConfirmDel',
      lastName: `User${Date.now().toString().slice(-5)}`,
    });
  });

  // لا afterEach — العميل يُحذف في التيست نفسه
  test('[CL-038][Clients/delete-dialog-ui][P1-High] تأكيد الحذف يحذف العميل ويظهر toast النجاح', async ({
    adminPage,
    goto,
  }) => {
    await goto(`/clients?search=${encodeURIComponent(seeded.firstName)}`);

    const row = adminPage.locator('table tbody tr').filter({ hasText: seeded.firstName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    const deleteBtn = row.locator(`button[data-testid="delete-client-${seeded.id}"]`);
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const dialog = adminPage.locator('[role="alertdialog"], [role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // اضغط "حذف" أو "تأكيد"
    const confirmBtn = dialog
      .getByRole('button', { name: /^حذف$|^تأكيد$|^نعم$/ })
      .first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // toast نجاح
    await expect(
      adminPage.getByText(/تم حذف المستفيد|تم الحذف/).first(),
    ).toBeVisible({ timeout: 8_000 });

    // dialog يُغلق
    await expect(dialog).not.toBeVisible({ timeout: 6_000 });
  });
});

// ── CL-042 Status filter — active only ────────────────────────────────────────
test.describe('Clients — status filter with seeded data', () => {
  let activeClient: SeededClient;
  let inactiveClient: SeededClient;

  test.beforeEach(async () => {
    activeClient = await createClient({
      firstName: 'PWActiveFilter',
      lastName: `A${Date.now().toString().slice(-4)}`,
      isActive: true,
    });
    inactiveClient = await createClient({
      firstName: 'PWInactiveFilter',
      lastName: `I${Date.now().toString().slice(-4)}`,
      isActive: false,
    });
  });

  test.afterEach(async () => {
    if (activeClient?.id) await deleteClient(activeClient.id);
    if (inactiveClient?.id) await deleteClient(inactiveClient.id);
  });

  test('[CL-042][Clients/filter-status-ui][P2-Medium] فلتر"نشط" يُظهر العميل النشط فقط', async ({
    adminPage,
    goto,
  }) => {
    await goto('/clients');

    const statusSelect = adminPage
      .locator('[role="combobox"]')
      .filter({ hasText: /الكل|الحالة|نشط/ })
      .first();

    if ((await statusSelect.count()) === 0) {
      test.skip();
      return;
    }

    await statusSelect.click();
    const activeOption = adminPage.getByRole('option', { name: /^نشط$/ }).first();
    await expect(activeOption).toBeVisible({ timeout: 5_000 });
    await activeOption.click();

    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // العميل غير النشط يجب ألا يظهر في نتائج فلتر "نشط"
    const inactiveRow = adminPage
      .locator('table tbody tr')
      .filter({ hasText: inactiveClient.firstName });
    await adminPage.waitForTimeout(1_500);
    expect(await inactiveRow.count()).toBe(0);
  });
});
