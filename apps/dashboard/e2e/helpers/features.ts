import { Page } from '@playwright/test';

const ALL_FEATURES_ENABLED = {
  features: {
    BRANCHES: { enabled: true, limit: -1, currentCount: 0 },
    INTAKE_FORMS: { enabled: true, limit: -1, currentCount: 0 },
    COUPONS: { enabled: true, limit: -1, currentCount: 0 },
    ADVANCED_REPORTS: { enabled: true, limit: -1, currentCount: 0 },
    AI_CHATBOT: { enabled: true, limit: -1, currentCount: 0 },
    ACTIVITY_LOG: { enabled: true, limit: -1, currentCount: 0 },
    WALK_IN_BOOKINGS: { enabled: true, limit: -1, currentCount: 0 },
    ONLINE_BOOKINGS: { enabled: true, limit: -1, currentCount: 0 },
    EMPLOYEES: { enabled: true, limit: -1, currentCount: 0 },
    SMS: { enabled: true, limit: -1, currentCount: 0 },
    WHATSAPP: { enabled: true, limit: -1, currentCount: 0 },
    EMAIL: { enabled: true, limit: -1, currentCount: 0 },
    CUSTOM_DOMAIN: { enabled: true, limit: -1, currentCount: 0 },
    API_ACCESS: { enabled: true, limit: -1, currentCount: 0 },
  },
  plan: {
    id: 'plan-e2e',
    name: 'E2E Test Plan',
    billingCycle: 'MONTHLY',
  },
};

const ALL_FEATURES_DISABLED = {
  features: {
    BRANCHES: { enabled: false, limit: 0, currentCount: 0 },
    INTAKE_FORMS: { enabled: false, limit: 0, currentCount: 0 },
    COUPONS: { enabled: false, limit: 0, currentCount: 0 },
    ADVANCED_REPORTS: { enabled: false, limit: 0, currentCount: 0 },
    AI_CHATBOT: { enabled: false, limit: 0, currentCount: 0 },
    ACTIVITY_LOG: { enabled: false, limit: 0, currentCount: 0 },
    WALK_IN_BOOKINGS: { enabled: true, limit: -1, currentCount: 0 },
    ONLINE_BOOKINGS: { enabled: true, limit: -1, currentCount: 0 },
    EMPLOYEES: { enabled: true, limit: -1, currentCount: 0 },
    SMS: { enabled: true, limit: -1, currentCount: 0 },
    WHATSAPP: { enabled: true, limit: -1, currentCount: 0 },
    EMAIL: { enabled: true, limit: -1, currentCount: 0 },
    CUSTOM_DOMAIN: { enabled: true, limit: -1, currentCount: 0 },
    API_ACCESS: { enabled: true, limit: -1, currentCount: 0 },
  },
  plan: {
    id: 'plan-basic',
    name: 'Basic Plan',
    billingCycle: 'MONTHLY',
  },
};

export async function mockAllFeaturesEnabled(page: Page): Promise<void> {
  await page.route('**/api/proxy/dashboard/billing/my-features', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ALL_FEATURES_ENABLED),
    });
  });
}

export async function mockAllFeaturesDisabled(page: Page): Promise<void> {
  await page.route('**/api/proxy/dashboard/billing/my-features', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ALL_FEATURES_DISABLED),
    });
  });
}

export async function mockSpecificFeature(
  page: Page,
  feature: string,
  enabled: boolean
): Promise<void> {
  await page.route('**/api/proxy/dashboard/billing/my-features', (route) => {
    const base = enabled ? ALL_FEATURES_ENABLED : ALL_FEATURES_DISABLED;
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(base),
    });
  });
}