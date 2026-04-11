/**
 * CareKit — Health Module E2E Tests
 *
 * GET /health — PUBLIC (no auth required)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  type TestApp,
} from '../setup/setup';

const URL = `${API_PREFIX}/health`;

describe('Health Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  describe('GET /health', () => {
    it('should return 200 with overall status', async () => {
      const res = await request(httpServer).get(URL).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status');
      expect(['ok', 'error', 'shutting_down']).toContain(res.body.data.status);
    });

    it('should include database, redis, and minio indicators', async () => {
      const res = await request(httpServer).get(URL).expect(200);

      const { data } = res.body;
      expect(data).toHaveProperty('info');
      expect(data.info).toHaveProperty('database');
      expect(data.info).toHaveProperty('redis');
      expect(data.info).toHaveProperty('minio');
    });

    it('should include uptime, timestamp, version, and startedAt fields', async () => {
      const res = await request(httpServer).get(URL).expect(200);

      const { data } = res.body;
      expect(typeof data.uptime).toBe('number');
      expect(typeof data.timestamp).toBe('string');
      expect(typeof data.version).toBe('string');
      expect(typeof data.startedAt).toBe('string');
    });

    it('should be accessible without Authorization header', async () => {
      await request(httpServer).get(URL).expect(200);
    });
  });
});
