/**
 * CareKit — Services Export E2E Tests
 *
 * Tests:
 *   GET /services/export?format=csv → 200, BOM + header row
 *   GET /services/export?format=xlsx → 200, Content-Type: application/vnd.ms-excel
 *   GET /services/export → 401 without auth
 *
 * Route order: @Get('export') is defined before @Get(':id') to prevent 'export'
 * from being interpreted as a UUID.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const SERVICES_URL = `${API_PREFIX}/services`;

describe('Services Export (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
  });

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  describe('GET /services/export', () => {
    it('returns 401 when no auth token is provided', async () => {
      const response = await request(httpServer)
        .get(`${SERVICES_URL}/export`)
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('returns CSV with BOM and header row for format=csv', async () => {
      const response = await request(httpServer)
        .get(`${SERVICES_URL}/export?format=csv`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-type']).toContain('charset=utf-8');
      expect(response.headers['content-disposition']).toContain('services.csv');

      // BOM + first header row
      const body = response.text;
      expect(body.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
      expect(body).toContain('"ID"');
      expect(body).toContain('"Name (AR)"');
      expect(body).toContain('"Name (EN)"');
    });

    it('returns application/vnd.ms-excel for format=xlsx', async () => {
      const response = await request(httpServer)
        .get(`${SERVICES_URL}/export?format=xlsx`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain(
        'application/vnd.ms-excel',
      );
      expect(response.headers['content-disposition']).toContain(
        'services.xlsx',
      );
    });

    it('defaults to CSV when format param is omitted', async () => {
      const response = await request(httpServer)
        .get(`${SERVICES_URL}/export`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('services.csv');
    });
  });

  describe('Route order — export before :id', () => {
    it('does not interpret "export" as a UUID parameter', async () => {
      // If the route order is wrong, 'export' would be matched as an ID
      // and would try to parse "export" as a UUID, causing a 400 or 404.
      // Instead it should match the explicit /export route and return 200.
      const response = await request(httpServer)
        .get(`${SERVICES_URL}/export`)
        .set('Authorization', `Bearer ${superAdmin.accessToken}`)
        .expect(200);

      expect(response.status).toBe(200);
    });
  });
});
