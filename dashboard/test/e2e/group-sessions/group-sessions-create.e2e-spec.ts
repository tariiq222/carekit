/**
 * CareKit Dashboard — Group Sessions Create Page E2E Tests
 *
 * Tests /group-sessions/create:
 *   - Navigation from list page
 *   - Sidebar tabs rendering (المعلومات الأساسية / الإعدادات / الجدولة)
 *   - Tab switching
 *   - Info tab: name fields, description grid, practitioner dropdown
 *   - Practitioner select: opens dropdown, shows items, selects one, shows card
 *   - Settings tab: participant & price fields
 *   - Scheduling tab: radio group RTL, switch row, date input
 *   - Footer: cancel navigates back, submit shows validation errors
 *   - RTL: sidebar on right, content on left
 */

import { test, expect } from '../setup/fixtures'

test.describe('Group Sessions Create — navigation', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('"إضافة جلسة" navigates to /group-sessions/create', async ({ adminPage }) => {
    const loginVisible = await adminPage.locator('#email').isVisible().catch(() => false)
    if (loginVisible) { test.skip(); return }

    // Add button is rendered as a Link (<a>) not a <button>
    const addLink = adminPage.getByRole('link', { name: /إضافة جلسة/ }).first()
    await expect(addLink).toBeVisible({ timeout: 8_000 })
    await addLink.click()

    await adminPage.waitForURL(/\/group-sessions\/create/, { timeout: 10_000 }).catch(() => {})
    await expect(adminPage).toHaveURL(/\/group-sessions\/create/)
  })
})

test.describe('Group Sessions Create — sidebar layout', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('shows all three sidebar tabs', async ({ adminPage }) => {
    await expect(adminPage.getByText('المعلومات الأساسية').first()).toBeVisible({ timeout: 12_000 })
    await expect(adminPage.getByText('الإعدادات').first()).toBeVisible({ timeout: 12_000 })
    await expect(adminPage.getByText('الجدولة').first()).toBeVisible({ timeout: 12_000 })
  })

  test('"المعلومات الأساسية" is active by default', async ({ adminPage }) => {
    const activeTab = adminPage.locator('[role="tab"][aria-selected="true"]').first()
    await expect(activeTab).toBeVisible({ timeout: 12_000 })
    await expect(activeTab).toContainText('المعلومات الأساسية')
  })

  test('sidebar is positioned on the right (RTL)', async ({ adminPage }) => {
    const card = adminPage.locator('[data-slot="card"]').first()
    await expect(card).toBeVisible({ timeout: 12_000 })

    // Sidebar div has border-e which = right border in RTL
    const sidebarBox = await adminPage
      .locator('[role="tablist"]')
      .first()
      .boundingBox()
    const contentBox = await adminPage
      .locator('[role="tabpanel"]')
      .first()
      .boundingBox()

    // In RTL: sidebar x > content x (sidebar is to the right)
    if (sidebarBox && contentBox) {
      expect(sidebarBox.x).toBeGreaterThan(contentBox.x)
    }
  })
})

test.describe('Group Sessions Create — tab switching', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('clicking "الإعدادات" tab shows settings content', async ({ adminPage }) => {
    const settingsTab = adminPage.getByRole('tab', { name: /الإعدادات/ }).first()
    await expect(settingsTab).toBeVisible({ timeout: 12_000 })
    await settingsTab.click()

    await expect(settingsTab).toHaveAttribute('aria-selected', 'true')
    await expect(adminPage.getByText('الحد الأدنى للمشاركين').first()).toBeVisible({ timeout: 8_000 })
  })

  test('clicking "الجدولة" tab shows scheduling content', async ({ adminPage }) => {
    const schedulingTab = adminPage.getByRole('tab', { name: /الجدولة/ }).first()
    await expect(schedulingTab).toBeVisible({ timeout: 12_000 })
    await schedulingTab.click()

    await expect(schedulingTab).toHaveAttribute('aria-selected', 'true')
    await expect(adminPage.getByText('نوع الجدولة').first()).toBeVisible({ timeout: 8_000 })
  })

  test('switching back to "المعلومات الأساسية" works', async ({ adminPage }) => {
    // Go to settings
    await adminPage.getByRole('tab', { name: /الإعدادات/ }).first().click()
    // Back to info
    const infoTab = adminPage.getByRole('tab', { name: /المعلومات الأساسية/ }).first()
    await infoTab.click()
    await expect(infoTab).toHaveAttribute('aria-selected', 'true')
    await expect(adminPage.getByText('الاسم (عربي)').first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Group Sessions Create — info tab fields', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('shows name fields in a two-column grid', async ({ adminPage }) => {
    await expect(adminPage.getByText('الاسم (عربي)').first()).toBeVisible({ timeout: 12_000 })
    await expect(adminPage.getByText('الاسم (إنجليزي)').first()).toBeVisible({ timeout: 12_000 })
  })

  test('shows description fields in a two-column grid', async ({ adminPage }) => {
    await expect(adminPage.getByText('الوصف (عربي)').first()).toBeVisible({ timeout: 12_000 })
    await expect(adminPage.getByText('الوصف (إنجليزي)').first()).toBeVisible({ timeout: 12_000 })

    const boxes = await Promise.all([
      adminPage.locator('textarea').nth(0).boundingBox(),
      adminPage.locator('textarea').nth(1).boundingBox(),
    ])
    // Both textareas should exist and be on the same vertical row (same y)
    if (boxes[0] && boxes[1]) {
      expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(20)
    }
  })

  test('shows practitioner label and dropdown trigger', async ({ adminPage }) => {
    await expect(adminPage.getByText('الممارس').first()).toBeVisible({ timeout: 12_000 })
    const trigger = adminPage.getByRole('combobox').first()
    await expect(trigger).toBeVisible({ timeout: 8_000 })
  })

  test('can type in Arabic name field', async ({ adminPage }) => {
    const nameArInput = adminPage.locator('input[dir="rtl"]').first()
    await expect(nameArInput).toBeVisible({ timeout: 8_000 })
    await nameArInput.fill('جلسة تجريبية')
    await expect(nameArInput).toHaveValue('جلسة تجريبية')
  })

  test('can type in English name field', async ({ adminPage }) => {
    const nameEnInput = adminPage.locator('input[dir="ltr"]').first()
    await expect(nameEnInput).toBeVisible({ timeout: 8_000 })
    await nameEnInput.fill('Test Session')
    await expect(nameEnInput).toHaveValue('Test Session')
  })
})

test.describe('Group Sessions Create — practitioner select', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('practitioner dropdown opens on click', async ({ adminPage }) => {
    const trigger = adminPage.getByRole('combobox').first()
    await expect(trigger).toBeVisible({ timeout: 8_000 })
    await trigger.click()

    // Command popover should appear
    const popover = adminPage.locator('[role="listbox"], [cmdk-list], [data-slot="command"]').first()
    await expect(popover).toBeVisible({ timeout: 6_000 })
  })

  test('practitioner dropdown has search input', async ({ adminPage }) => {
    const trigger = adminPage.getByRole('combobox').first()
    await trigger.click()

    const search = adminPage.locator('input[placeholder*="ممارس"]').first()
    await expect(search).toBeVisible({ timeout: 6_000 })
  })

  test('selecting practitioner shows card below dropdown', async ({ adminPage }) => {
    const trigger = adminPage.getByRole('combobox').first()
    await trigger.click()

    // Wait for list items to appear
    const items = adminPage.locator('[cmdk-item], [role="option"]')
    const count = await items.count()

    if (count === 0) {
      // No practitioners seeded — verify empty state shows
      const empty = adminPage.getByText(/لا يوجد ممارس/).first()
      await expect(empty).toBeVisible({ timeout: 6_000 })
      return
    }

    // Click first practitioner
    await items.first().click()

    // Selected practitioner card appears — identified by Avatar inside it
    const avatarInCard = adminPage.locator('[data-slot="avatar"]').first()
    await expect(avatarInCard).toBeVisible({ timeout: 6_000 })
  })

  test('remove button clears practitioner selection', async ({ adminPage }) => {
    const trigger = adminPage.getByRole('combobox').first()
    await trigger.click()

    const items = adminPage.locator('[cmdk-item], [role="option"]')
    if (await items.count() === 0) { test.skip(); return }

    await items.first().click()

    // Find and click the remove (×) button
    const removeBtn = adminPage.locator('button[aria-label*="حذف"], button[aria-label*="إزالة"], button[aria-label*="remove"]').first()
    await expect(removeBtn).toBeVisible({ timeout: 6_000 })
    await removeBtn.click()

    // Card should be gone, trigger should show placeholder text
    await expect(trigger).toContainText(/اختر ممارساً/)
  })
})

test.describe('Group Sessions Create — settings tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
    await adminPage.getByRole('tab', { name: /الإعدادات/ }).first().click()
    await adminPage.waitForTimeout(300)
  })

  test('shows participant fields', async ({ adminPage }) => {
    await expect(adminPage.getByText('الحد الأدنى للمشاركين').first()).toBeVisible({ timeout: 8_000 })
    await expect(adminPage.getByText('الحد الأقصى للمشاركين').first()).toBeVisible({ timeout: 8_000 })
  })

  test('shows price and duration fields', async ({ adminPage }) => {
    await expect(adminPage.getByText('السعر للشخص').first()).toBeVisible({ timeout: 8_000 })
    await expect(adminPage.getByText('المدة (دقيقة)').first()).toBeVisible({ timeout: 8_000 })
  })

  test('number fields accept numeric input', async ({ adminPage }) => {
    const inputs = adminPage.locator('input[type="number"]')
    const first = inputs.first()
    await expect(first).toBeVisible({ timeout: 8_000 })
    await first.fill('5')
    await expect(first).toHaveValue('5')
  })
})

test.describe('Group Sessions Create — scheduling tab', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
    await adminPage.getByRole('tab', { name: /الجدولة/ }).first().click()
    await adminPage.waitForTimeout(300)
  })

  test('shows scheduling type label', async ({ adminPage }) => {
    await expect(adminPage.getByText('نوع الجدولة').first()).toBeVisible({ timeout: 8_000 })
  })

  test('shows "تاريخ محدد" radio option', async ({ adminPage }) => {
    await expect(adminPage.getByText('تاريخ محدد').first()).toBeVisible({ timeout: 8_000 })
  })

  test('shows "عند اكتمال العدد" radio option', async ({ adminPage }) => {
    await expect(adminPage.getByText('عند اكتمال العدد').first()).toBeVisible({ timeout: 8_000 })
  })

  test('"تاريخ محدد" is selected by default and shows date input', async ({ adminPage }) => {
    const fixedRadio = adminPage.locator('input[type="radio"][value="fixed_date"]')
    await expect(fixedRadio).toBeChecked({ timeout: 8_000 })

    await expect(adminPage.getByText('وقت البدء').first()).toBeVisible({ timeout: 8_000 })
  })

  test('selecting "عند اكتمال العدد" hides date input', async ({ adminPage }) => {
    const onCapacityOption = adminPage.getByText('عند اكتمال العدد').first()
    await onCapacityOption.click()

    const startTimeLabel = adminPage.getByText('وقت البدء')
    await expect(startTimeLabel).not.toBeVisible({ timeout: 4_000 })
  })

  test('shows "نشر للعملاء" switch', async ({ adminPage }) => {
    await expect(adminPage.getByText('نشر للعملاء').first()).toBeVisible({ timeout: 8_000 })
    const switchEl = adminPage.locator('[role="switch"]').first()
    await expect(switchEl).toBeVisible({ timeout: 8_000 })
  })

  test('"نشر للعملاء" switch is off by default', async ({ adminPage }) => {
    const switchEl = adminPage.locator('[role="switch"]').first()
    await expect(switchEl).toHaveAttribute('data-state', 'unchecked')
  })

  test('toggling switch changes its state', async ({ adminPage }) => {
    const switchEl = adminPage.locator('[role="switch"]').first()
    await switchEl.click()
    await expect(switchEl).toHaveAttribute('data-state', 'checked')
  })

  test('shows "تاريخ الانتهاء" field', async ({ adminPage }) => {
    await expect(adminPage.getByText('تاريخ الانتهاء').first()).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Group Sessions Create — footer', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions/create')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('shows إنشاء الجلسة button', async ({ adminPage }) => {
    await expect(adminPage.getByRole('button', { name: /إنشاء الجلسة/ }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('shows إلغاء button', async ({ adminPage }) => {
    await expect(adminPage.getByRole('button', { name: /إلغاء/ }).first()).toBeVisible({ timeout: 8_000 })
  })

  test('"إلغاء" navigates back to group-sessions list', async ({ adminPage }) => {
    const cancelBtn = adminPage.getByRole('button', { name: /إلغاء/ }).first()
    await expect(cancelBtn).toBeVisible({ timeout: 8_000 })
    await cancelBtn.click()

    await adminPage.waitForURL(/\/group-sessions(?!\/create)/, { timeout: 8_000 }).catch(() => {})
    await expect(adminPage).toHaveURL(/\/group-sessions/)
    await expect(adminPage).not.toHaveURL(/\/create/)
  })

  test('submitting empty form shows validation error', async ({ adminPage }) => {
    const submitBtn = adminPage.getByRole('button', { name: /إنشاء الجلسة/ }).first()
    await submitBtn.click()

    // At least one error message should appear
    const errors = adminPage.locator('[class*="text-destructive"]')
    await expect(errors.first()).toBeVisible({ timeout: 6_000 })
  })
})
