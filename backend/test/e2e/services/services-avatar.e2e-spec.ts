/**
 * CareKit — Services Avatar & Icon E2E Tests
 *
 * Covers:
 *   POST  /services/:id/avatar          — upload image (multipart)
 *   PATCH /services/:id                 — iconName + iconBgColor fields
 *   PATCH /services/:id                 — null values for nullable fields (regression)
 *
 * Permission matrix:
 *   super_admin  → edit (avatar + icon)
 *   receptionist → edit (avatar + icon)
 *   patient      → 403
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  registerTestPatient,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
} from '../setup/setup';

const SERVICES_URL = `${API_PREFIX}/services`;
const CATEGORIES_URL = `${SERVICES_URL}/categories`;

/** Build a minimal valid PNG buffer (1×1 red pixel) */
function buildMinimalPng(): Buffer {
  // Minimal 1×1 transparent PNG — 67 bytes
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
    + '0000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
    'hex',
  );
}

describe('Services Avatar & Icon (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let receptionist: AuthResult;
  let patient: AuthResult;

  let categoryId: string;
  let serviceId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    receptionist = await createTestUserWithRole(
      httpServer,
      superAdmin.accessToken,
      TEST_USERS.receptionist,
      'receptionist',
    );

    patient = await registerTestPatient(httpServer);

    const catRes = await request(httpServer)
      .post(CATEGORIES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ nameEn: 'Avatar Test Category', nameAr: 'فئة اختبار الأفاتار' })
      .expect(201);

    categoryId = catRes.body.data.id as string;

    const svcRes = await request(httpServer)
      .post(SERVICES_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        nameEn: 'Avatar Test Service',
        nameAr: 'خدمة اختبار الأفاتار',
        categoryId,
        price: 10000,
        duration: 30,
      })
      .expect(201);

    serviceId = svcRes.body.data.id as string;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ═══════════════════════════════════════════════════════════════
  //  PATCH /services/:id — nullable fields (regression for 400 bug)
  // ═══════════════════════════════════════════════════════════════

  describe('PATCH /services/:id — nullable avatar fields', () => {
    it('should accept iconName: null without 400', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconName: null })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('iconName', null);
    });

    it('should accept iconBgColor: null without 400', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconBgColor: null })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('iconBgColor', null);
    });

    it('should accept imageUrl: null without 400', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ imageUrl: null })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('imageUrl', null);
    });

    it('should accept all three nullable fields as null simultaneously', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconName: null, iconBgColor: null, imageUrl: null })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should accept valid iconName string', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconName: 'StethoscopeIcon' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('iconName', 'StethoscopeIcon');
    });

    it('should accept valid iconBgColor hex', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconBgColor: '#354FD8' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('iconBgColor', '#354FD8');
    });

    it('should reject invalid iconBgColor (not hex)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ iconBgColor: 'blue' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should reject invalid imageUrl (not a URL)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ imageUrl: 'not-a-url' })
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('receptionist can patch icon fields', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(receptionist.accessToken))
        .send({ iconName: 'HeartIcon', iconBgColor: '#82CC17' })
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('patient cannot patch icon fields (403)', async () => {
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ iconName: 'HeartIcon' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  POST /services/:id/avatar — upload image
  // ═══════════════════════════════════════════════════════════════

  describe('POST /services/:id/avatar', () => {
    const pngBuffer = buildMinimalPng();

    it('should upload avatar as super_admin and return updated service', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(typeof res.body.data.imageUrl).toBe('string');
      expect(res.body.data.imageUrl).not.toBeNull();
      // icon fields should be cleared when image is uploaded
      expect(res.body.data).toHaveProperty('iconName', null);
      expect(res.body.data).toHaveProperty('iconBgColor', null);
    });

    it('should upload avatar as receptionist (has services:edit)', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .set(getAuthHeaders(receptionist.accessToken))
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201);

      expectSuccessResponse(res.body);
    });

    it('should reject upload by patient (403)', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .set(getAuthHeaders(patient.accessToken))
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should reject upload without authentication (401)', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 400 when no file is attached', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(400);

      // BadRequestException with string message → code = "Bad Request"
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 404 for non-existent service', async () => {
      const res = await request(httpServer)
        .post(`${SERVICES_URL}/00000000-0000-0000-0000-000000000000/avatar`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('after upload: setting iconName should clear imageUrl', async () => {
      // First upload an image
      await request(httpServer)
        .post(`${SERVICES_URL}/${serviceId}/avatar`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .attach('image', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' })
        .expect(201);

      // Then switch back to icon
      const res = await request(httpServer)
        .patch(`${SERVICES_URL}/${serviceId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ imageUrl: null, iconName: 'StethoscopeIcon', iconBgColor: '#354FD8' })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('imageUrl', null);
      expect(res.body.data).toHaveProperty('iconName', 'StethoscopeIcon');
    });
  });
});
