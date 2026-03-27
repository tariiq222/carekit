/**
 * CareKit — Email Templates Module E2E Tests
 *
 * GET   /email-templates             — whitelabel:view
 * GET   /email-templates/:slug       — whitelabel:view
 * PATCH /email-templates/:id         — whitelabel:edit
 * POST  /email-templates/:slug/preview — whitelabel:view
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const BASE_URL = `${API_PREFIX}/email-templates`;
const FAKE_ID = '00000000-0000-0000-0000-000000000000';

describe('Email Templates Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  let templateId: string;
  let templateSlug: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
    patient = await registerTestPatient(httpServer);

    // Resolve a real template ID + slug for PATCH and preview tests
    const listRes = await request(httpServer)
      .get(BASE_URL)
      .set(getAuthHeaders(superAdmin.accessToken));

    const templates = listRes.body.data as Array<{ id: string; slug: string }>;
    templateId = templates[0].id;
    templateSlug = templates[0].slug;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ─── GET /email-templates ────────────────────────────────────────

  describe('GET /email-templates', () => {
    it('should return all templates for super_admin (200)', async () => {
      const res = await request(httpServer)
        .get(BASE_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should include required fields and seeded slugs', async () => {
      const res = await request(httpServer)
        .get(BASE_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      const item = res.body.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('slug');
      expect(item).toHaveProperty('subjectAr');
      expect(item).toHaveProperty('subjectEn');

      const slugs = (res.body.data as Array<{ slug: string }>).map((t) => t.slug);
      expect(slugs).toContain('welcome');
      expect(slugs).toContain('otp-login');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer).get(BASE_URL).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .get(BASE_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── GET /email-templates/:slug ──────────────────────────────────

  describe('GET /email-templates/:slug', () => {
    it('should return template by slug (200)', async () => {
      const res = await request(httpServer)
        .get(`${BASE_URL}/welcome`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('slug', 'welcome');
    });

    it('should return template by slug otp-login (200)', async () => {
      const res = await request(httpServer)
        .get(`${BASE_URL}/otp-login`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('slug', 'otp-login');
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(httpServer)
        .get(`${BASE_URL}/ghost-template-xyz`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer).get(`${BASE_URL}/welcome`).expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient', async () => {
      const res = await request(httpServer)
        .get(`${BASE_URL}/welcome`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─── PATCH /email-templates/:id ─────────────────────────────────

  describe('PATCH /email-templates/:id', () => {
    it('should update subjectEn for super_admin (200)', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${templateId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ subjectEn: 'Updated E2E Subject' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('subjectEn', 'Updated E2E Subject');
    });

    it('should accept partial update (isActive only)', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${templateId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent id', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${FAKE_ID}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ subjectEn: 'Test' })
        .expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 400 for invalid uuid param', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/not-a-valid-uuid`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ subjectEn: 'Test' })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 400 for subjectAr exceeding 500 chars', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${templateId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ subjectAr: 'أ'.repeat(501) })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 403 for patient (no whitelabel:edit)', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${templateId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ subjectEn: 'Test' })
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer)
        .patch(`${BASE_URL}/${templateId}`)
        .send({ subjectEn: 'Test' })
        .expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─── POST /email-templates/:slug/preview ─────────────────────────

  describe('POST /email-templates/:slug/preview', () => {
    const validBody = { context: { firstName: 'أحمد', code: '123456' }, lang: 'ar' };

    it('should render preview in Arabic (200)', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/otp-login/preview`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validBody)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('subject');
      expect(res.body.data).toHaveProperty('body');
    });

    it('should render preview in English (201)', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/otp-login/preview`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ context: { firstName: 'Ahmed', code: '654321' }, lang: 'en' })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/ghost-template-xyz/preview`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(validBody)
        .expect(404);
      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 400 for missing lang', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/${templateSlug}/preview`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ context: {} })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 400 for invalid lang value', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/${templateSlug}/preview`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ context: {}, lang: 'fr' })
        .expect(400);
      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 403 for patient (no whitelabel:view)', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/${templateSlug}/preview`)
        .set(getAuthHeaders(patient.accessToken))
        .send(validBody)
        .expect(403);
      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should return 401 without auth', async () => {
      const res = await request(httpServer)
        .post(`${BASE_URL}/${templateSlug}/preview`)
        .send(validBody)
        .expect(401);
      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });
});
