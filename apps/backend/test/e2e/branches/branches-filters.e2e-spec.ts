/**
 * CareKit — Branches Query Filters E2E Tests
 *
 * Covers GET /branches query parameters:
 *   - search (nameAr, nameEn)
 *   - isActive filter
 *   - pagination (page, perPage)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  getAuthHeaders,
  expectSuccessResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const URL = `${API_PREFIX}/branches`;

describe('Branches Filters (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let inactiveBranchId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    const res = await request(httpServer)
      .post(URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameAr: 'فرع جدة المميز',
        nameEn: 'Jeddah Distinct Branch',
        address: 'طريق الملك عبدالعزيز',
        isActive: false,
      })
      .expect(201);
    inactiveBranchId = (res.body.data as { id: string }).id;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  it('should filter by search term matching nameAr', async () => {
    const res = await request(httpServer)
      .get(`${URL}?search=جدة المميز`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);
    expectSuccessResponse(res.body);
    const items = (res.body.data?.items ?? res.body.data) as Array<{
      nameAr: string;
      nameEn: string;
    }>;
    expect(items.some((b) => b.nameAr.includes('جدة'))).toBe(true);
  });

  it('should filter by search term matching nameEn', async () => {
    const res = await request(httpServer)
      .get(`${URL}?search=Jeddah Distinct`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);
    expectSuccessResponse(res.body);
    const items = (res.body.data?.items ?? res.body.data) as Array<{
      id: string;
    }>;
    expect(items.some((b) => b.id === inactiveBranchId)).toBe(true);
  });

  it('should return only inactive branches with isActive=false', async () => {
    const res = await request(httpServer)
      .get(`${URL}?isActive=false`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);
    expectSuccessResponse(res.body);
    const items = (res.body.data?.items ?? res.body.data) as Array<{
      isActive: boolean;
    }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((b) => b.isActive === false)).toBe(true);
  });

  it('should return only active branches with isActive=true', async () => {
    const res = await request(httpServer)
      .get(`${URL}?isActive=true`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);
    expectSuccessResponse(res.body);
    const items = (res.body.data?.items ?? res.body.data) as Array<{
      isActive: boolean;
    }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((b) => b.isActive === true)).toBe(true);
  });

  it('should paginate with page=1&perPage=1 returning one item and correct meta', async () => {
    const res = await request(httpServer)
      .get(`${URL}?page=1&perPage=1`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);
    expectSuccessResponse(res.body);
    const data = res.body.data as {
      items?: unknown[];
      meta?: { page: number; perPage: number };
    };
    if (data.items) {
      expect(data.items).toHaveLength(1);
      expect(data.meta?.page).toBe(1);
      expect(data.meta?.perPage).toBe(1);
    }
  });
});
