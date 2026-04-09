/**
 * Feature Flags Module E2E Tests
 *
 * Endpoints:
 *   GET    /api/v1/feature-flags       — list all flags (whitelabel:view)
 *   GET    /api/v1/feature-flags/map   — public flag map (no auth)
 *   PATCH  /api/v1/feature-flags/:key  — toggle flag (whitelabel:edit)
 *
 * Coverage:
 *   - Auth/permission gating on each endpoint
 *   - Response shape validation
 *   - Toggle reflects immediately in /map (cache invalidation)
 *   - 404 for unknown flag key
 *   - 400 for invalid body on PATCH
 */

import request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  API_PREFIX,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const FLAGS_URL = `${API_PREFIX}/feature-flags`;
const FLAGS_MAP_URL = `${FLAGS_URL}/map`;

describe('Feature Flags Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  /** First available flag key from DB — populated lazily */
  let firstFlagKey: string | null = null;

  async function getSuperAdminHeaders(): Promise<Record<string, string>> {
    return getAuthHeaders(superAdmin.accessToken);
  }

  /** Fetch and cache the first available flag key from the DB */
  async function getFirstFlagKey(): Promise<string> {
    if (firstFlagKey) return firstFlagKey;

    const res = await request(httpServer)
      .get(FLAGS_URL)
      .set(await getSuperAdminHeaders());

    if (res.status !== 200) throw new Error(`Cannot fetch feature flags: ${res.status}`);

    const flags = (res.body.data ?? res.body) as Array<Record<string, unknown>>;
    if (!flags.length) throw new Error('No feature flags seeded in DB');

    firstFlagKey = flags[0].key as string;
    return firstFlagKey;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patient = await registerTestPatient(httpServer);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/v1/feature-flags  (whitelabel:view required)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /feature-flags', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(httpServer).get(FLAGS_URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('returns 403 for patient user (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(FLAGS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('returns 200 with array of flags for super_admin', async () => {
      const res = await request(httpServer)
        .get(FLAGS_URL)
        .set(await getSuperAdminHeaders())
        .expect(200);
      expectSuccessResponse(res.body);
      const flags = res.body.data as unknown[];
      expect(Array.isArray(flags)).toBe(true);
      expect(flags.length).toBeGreaterThan(0);
    });

    it('each flag has key (string) and enabled (boolean)', async () => {
      const res = await request(httpServer)
        .get(FLAGS_URL)
        .set(await getSuperAdminHeaders())
        .expect(200);

      const flags = res.body.data as Array<Record<string, unknown>>;
      for (const flag of flags) {
        expect(typeof flag.key).toBe('string');
        expect(flag.key.length).toBeGreaterThan(0);
        expect(typeof flag.enabled).toBe('boolean');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/v1/feature-flags/map  (@Public — no auth required)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /feature-flags/map', () => {
    it('returns 200 without any auth token', async () => {
      const res = await request(httpServer).get(FLAGS_MAP_URL).expect(200);
      expectSuccessResponse(res.body);
    });

    it('returns object (not array) with string keys and boolean values', async () => {
      const res = await request(httpServer).get(FLAGS_MAP_URL).expect(200);
      const map = res.body.data as Record<string, unknown>;

      expect(typeof map).toBe('object');
      expect(Array.isArray(map)).toBe(false);
      expect(Object.keys(map).length).toBeGreaterThan(0);

      for (const [key, value] of Object.entries(map)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('boolean');
      }
    });

    it('/map keys and values match the full /feature-flags list', async () => {
      const [fullRes, mapRes] = await Promise.all([
        request(httpServer).get(FLAGS_URL).set(await getSuperAdminHeaders()),
        request(httpServer).get(FLAGS_MAP_URL),
      ]);

      const flags = fullRes.body.data as Array<{ key: string; enabled: boolean }>;
      const map = mapRes.body.data as Record<string, boolean>;

      for (const flag of flags) {
        expect(map).toHaveProperty(flag.key);
        expect(map[flag.key]).toBe(flag.enabled);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PATCH /api/v1/feature-flags/:key  (whitelabel:edit required)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('PATCH /feature-flags/:key', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/some_flag`)
        .send({ enabled: false })
        .expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('returns 403 for patient user (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/some_flag`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ enabled: false })
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('returns 200 when toggling an existing flag to false', async () => {
      const key = await getFirstFlagKey();
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.key).toBe(key);
      expect(res.body.data.enabled).toBe(false);
    });

    it('returns 200 when toggling an existing flag to true', async () => {
      const key = await getFirstFlagKey();
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: true })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data.key).toBe(key);
      expect(res.body.data.enabled).toBe(true);
    });

    it('returns 404 for non-existent flag key', async () => {
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/nonexistent_flag_xyz_e2e_test`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: true })
        .expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('returns 400 for missing enabled field in body', async () => {
      const key = await getFirstFlagKey();
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({})
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('returns 400 when enabled field is a string instead of boolean', async () => {
      const key = await getFirstFlagKey();
      const res = await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: 'yes' })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration: PATCH reflects immediately in GET /map (cache invalidation)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Integration: toggle reflects in /map', () => {
    it('GET /map returns false after PATCH with enabled:false', async () => {
      const key = await getFirstFlagKey();

      await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: false })
        .expect(200);

      const mapRes = await request(httpServer).get(FLAGS_MAP_URL).expect(200);
      const map = mapRes.body.data as Record<string, boolean>;
      expect(map[key]).toBe(false);
    });

    it('GET /map returns true after PATCH with enabled:true', async () => {
      const key = await getFirstFlagKey();

      await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: true })
        .expect(200);

      const mapRes = await request(httpServer).get(FLAGS_MAP_URL).expect(200);
      const map = mapRes.body.data as Record<string, boolean>;
      expect(map[key]).toBe(true);
    });

    it('double-toggle restores original value in /map', async () => {
      const key = await getFirstFlagKey();

      // Capture current state
      const before = await request(httpServer).get(FLAGS_MAP_URL);
      const originalEnabled = (before.body.data as Record<string, boolean>)[key];

      // Toggle twice
      await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: !originalEnabled });

      await request(httpServer)
        .patch(`${FLAGS_URL}/${key}`)
        .set(await getSuperAdminHeaders())
        .send({ enabled: originalEnabled });

      const after = await request(httpServer).get(FLAGS_MAP_URL);
      const restoredEnabled = (after.body.data as Record<string, boolean>)[key];
      expect(restoredEnabled).toBe(originalEnabled);
    });
  });
});
