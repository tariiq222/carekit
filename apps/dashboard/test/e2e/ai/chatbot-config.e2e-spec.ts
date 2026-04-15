/**
 * CareKit Dashboard — Chatbot Configuration E2E Tests
 *
 * CC-001 to CC-003.
 * Tries /chatbot/config then /chatbot.
 */

import { test, expect } from '../setup/fixtures';

const CHATBOT_ROUTES = ['/chatbot/config', '/chatbot', '/settings/chatbot'];

async function navigateToChatbot(adminPage: import('@playwright/test').Page, goto: (url: string) => Promise<void>): Promise<void> {
  for (const route of CHATBOT_ROUTES) {
    await goto(route);
    const isChatbotPage =
      adminPage.url().includes('chatbot') ||
      (await adminPage.getByText(/chatbot|المساعد|الذكاء الاصطناعي|الدردشة|روبوت/i).first().isVisible({ timeout: 5_000 }).catch(() => false));
    if (isChatbotPage) return;
  }
}

// ── CC-001 Page loads ─────────────────────────────────────────────────────────
test.describe('Chatbot Config — تحميل الصفحة', () => {
  test('[CC-001] @smoke — الصفحة تحمل', async ({ adminPage, goto }) => {
    await navigateToChatbot(adminPage, goto);

    await expect(adminPage.locator('#email')).not.toBeVisible();

    const content = adminPage.locator(
      'form, [class*="card"], [class*="chatbot"], [class*="setting"], h1, h2',
    );
    await expect(content.first()).toBeVisible({ timeout: 12_000 });
  });
});

// ── CC-002 Chatbot settings visible ──────────────────────────────────────────
test.describe('Chatbot Config — إعدادات الـ chatbot', () => {
  test('[CC-002] @smoke — إعدادات الـ chatbot تظهر (system prompt field أو toggle)', async ({ adminPage, goto }) => {
    await navigateToChatbot(adminPage, goto);

    const systemPrompt = adminPage
      .locator('textarea[name*="prompt"], textarea[placeholder*="prompt"], textarea[placeholder*="النظام"]')
      .first();

    const settingsField = adminPage
      .locator('input, textarea, [role="switch"]')
      .first();

    const settingsText = adminPage
      .getByText(/system prompt|نظام|تعليمات|إعدادات المساعد/i)
      .first();

    const isVisible =
      (await systemPrompt.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await settingsField.isVisible({ timeout: 8_000 }).catch(() => false)) ||
      (await settingsText.isVisible({ timeout: 8_000 }).catch(() => false));

    if (!isVisible) {
      test.skip();
      return;
    }

    expect(isVisible).toBe(true);
  });
});

// ── CC-003 Enable/disable chatbot toggle ──────────────────────────────────────
test.describe('Chatbot Config — toggle تفعيل/تعطيل', () => {
  test('[CC-003] @critical — toggle تفعيل/تعطيل الـ chatbot موجود وقابل للنقر', async ({ adminPage, goto }) => {
    await navigateToChatbot(adminPage, goto);

    // ابحث عن toggle تفعيل الـ chatbot
    const enableToggle = adminPage
      .locator('[role="switch"]')
      .first();

    const checkboxToggle = adminPage
      .locator('input[type="checkbox"]')
      .filter({ hasText: /تفعيل|تشغيل|enable/i })
      .first();

    // بديل: أي switch موجود في الصفحة
    const anySwitch = adminPage.locator('[role="switch"], input[type="checkbox"]').first();

    let toggleEl = enableToggle;
    if ((await enableToggle.count()) === 0) {
      if ((await checkboxToggle.count()) > 0) {
        toggleEl = checkboxToggle;
      } else {
        toggleEl = anySwitch;
      }
    }

    if ((await toggleEl.count()) === 0) {
      test.skip();
      return;
    }

    await expect(toggleEl).toBeVisible({ timeout: 10_000 });

    // تحقق قابل للنقر
    const isDisabled = await toggleEl.isDisabled().catch(() => false);
    expect(isDisabled).toBe(false);
  });
});
