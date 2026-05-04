import { Page } from '@playwright/test';

const MOCK_MEMBERSHIPS = [
  {
    id: 'mem-1',
    organizationId: 'org-1',
    role: 'OWNER',
    isActive: true,
    displayName: 'Test Org 1',
    jobTitle: 'Owner',
    avatarUrl: null,
    organization: {
      id: 'org-1',
      slug: 'test-org-1',
      nameAr: 'منظمة الاختبار الأولى',
      nameEn: 'Test Organization One',
      status: 'ACTIVE',
    },
  },
  {
    id: 'mem-2',
    organizationId: 'org-2',
    role: 'ADMIN',
    isActive: false,
    displayName: 'Test Org 2',
    jobTitle: 'Admin',
    avatarUrl: null,
    organization: {
      id: 'org-2',
      slug: 'test-org-2',
      nameAr: 'منظمة الاختبار الثانية',
      nameEn: 'Test Organization Two',
      status: 'ACTIVE',
    },
  },
];

export async function mockMultipleMemberships(page: Page): Promise<void> {
  await page.route('**/api/proxy/auth/memberships', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_MEMBERSHIPS),
    });
  });
}

export async function mockSingleMembership(page: Page): Promise<void> {
  await page.route('**/api/proxy/auth/memberships', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([MOCK_MEMBERSHIPS[0]]),
    });
  });
}

export async function mockMembershipsLoading(page: Page): Promise<void> {
  await page.route('**/api/proxy/auth/memberships', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}