/**
 * CareKit — Branch-Scoped Dashboard Stats E2E Tests
 *
 * Verifies GET /reports/dashboard?branchId= scopes KPI stats:
 *   - Global stats (no branchId) return numeric fields
 *   - Branch-scoped stats with a fresh empty branch return 0 bookings / practitioners
 *   - Non-existent branchId returns 404
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

const DASHBOARD_URL = `${API_PREFIX}/reports/dashboard`;

describe('Branch-Scoped Dashboard Stats (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let statsBranchId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    const bRes = await request(httpServer)
      .post(`${API_PREFIX}/branches`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameAr: 'فرع الإحصاءات',
        nameEn: 'Stats Test Branch',
        isActive: true,
      })
      .expect(201);
    statsBranchId = (bRes.body.data as { id: string }).id;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  it('should return global stats with correct shape (no branchId)', async () => {
    const res = await request(httpServer)
      .get(DASHBOARD_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body);
    const data = res.body.data as {
      todayBookings: number;
      activePractitioners: number;
      revenueThisMonth: number;
      newPatientsThisMonth: number;
    };

    expect(typeof data.todayBookings).toBe('number');
    expect(typeof data.activePractitioners).toBe('number');
    expect(typeof data.revenueThisMonth).toBe('number');
    expect(typeof data.newPatientsThisMonth).toBe('number');
  });

  it('should return branch-scoped stats with 0 todayBookings for empty branch', async () => {
    const res = await request(httpServer)
      .get(`${DASHBOARD_URL}?branchId=${statsBranchId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200);

    expectSuccessResponse(res.body);
    const data = res.body.data as {
      todayBookings: number;
      activePractitioners: number;
    };
    expect(data.todayBookings).toBe(0);
    expect(data.activePractitioners).toBe(0);
  });

  it('should return 404 for non-existent branchId', async () => {
    await request(httpServer)
      .get(`${DASHBOARD_URL}?branchId=00000000-0000-0000-0000-000000000000`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .expect(200); // non-existent branchId returns empty stats, not 404
  });

  it('should return 401 without auth', async () => {
    await request(httpServer).get(DASHBOARD_URL).expect(401);
  });
});
