/**
 * CareKit Dashboard — Group Sessions Page E2E Tests
 *
 * Tests the /group-sessions route:
 *   - Page loads without auth redirect
 *   - Title visible
 *   - Add session button present
 *   - List or empty state renders
 */

import { test, expect } from '../setup/fixtures'

test.describe('Group Sessions — list page', () => {
  test.beforeEach(async ({ adminPage, goto }) => {
    await goto('/group-sessions')
    await adminPage.waitForLoadState('networkidle').catch(() => {})
  })

  test('loads without redirect to login', async ({ adminPage }) => {
    await expect(adminPage).toHaveURL(/\/group-sessions/)
    await expect(adminPage.locator('#email')).not.toBeVisible()
  })

  test('shows page title', async ({ adminPage }) => {
    await expect(adminPage.getByText('الجلسات الجماعية').first()).toBeVisible({ timeout: 12_000 })
  })

  test('shows add session button', async ({ adminPage }) => {
    await expect(adminPage.getByText('إضافة جلسة').first()).toBeVisible({ timeout: 12_000 })
  })

  test('renders list or empty state', async ({ adminPage }) => {
    const table = adminPage.locator('table, [role="table"]')
    const emptyText = adminPage.getByText(/لا توجد|لا يوجد/)
    const hasContent =
      (await table.count()) > 0 || (await emptyText.count()) > 0
    expect(hasContent).toBe(true)
  })
})
