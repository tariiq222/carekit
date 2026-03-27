/**
 * CareKit — Coupons Module E2E Tests
 *
 *   GET    /coupons           — list (PERMISSION:coupons:view)
 *   GET    /coupons/:id       — get by ID (PERMISSION:coupons:view)
 *   POST   /coupons           — create (PERMISSION:coupons:create)
 *   PATCH  /coupons/:id       — update (PERMISSION:coupons:edit)
 *   DELETE /coupons/:id       — delete (PERMISSION:coupons:delete)
 *   POST   /coupons/apply     — apply coupon (JWT only)
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

const COUPONS_URL = `${API_PREFIX}/coupons`;

const VALID_COUPON = {
  code: 'TEST20',
  discountType: 'percentage',
  discountValue: 20,
  minAmount: 0,
  isActive: true,
};

describe('Coupons Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  let couponId: string;
  let deletableCouponId: string;

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

  // ─────────────────────────────────────────────────────────────
  // GET /coupons — List Coupons
  // ─────────────────────────────────────────────────────────────

  describe('GET /coupons', () => {
    it('should return paginated list for super_admin', async () => {
      const res = await request(httpServer)
        .get(COUPONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(httpServer)
        .get(COUPONS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no coupons:view)', async () => {
      const res = await request(httpServer)
        .get(COUPONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /coupons — Create Coupon
  // ─────────────────────────────────────────────────────────────

  describe('POST /coupons', () => {
    it('should create coupon as super_admin (201)', async () => {
      const res = await request(httpServer)
        .post(COUPONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(VALID_COUPON)
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('code', VALID_COUPON.code);
      expect(res.body.data).toHaveProperty('discountType', VALID_COUPON.discountType);
      expect(res.body.data).toHaveProperty('discountValue', VALID_COUPON.discountValue);
      expect(res.body.data).toHaveProperty('isActive', true);

      couponId = res.body.data.id as string;
    });

    it('should return 409 for duplicate coupon code', async () => {
      const res = await request(httpServer)
        .post(COUPONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send(VALID_COUPON)
        .expect(409);

      expectErrorResponse(res.body, 'CONFLICT');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(httpServer)
        .post(COUPONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({})
        .expect(400);

      expectErrorResponse(res.body, 'VALIDATION_ERROR');
    });

    it('should return 403 for patient (no coupons:create)', async () => {
      const res = await request(httpServer)
        .post(COUPONS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({ ...VALID_COUPON, code: 'PATIENT10' })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });

    it('should create a second coupon for delete tests', async () => {
      const res = await request(httpServer)
        .post(COUPONS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ ...VALID_COUPON, code: 'DELETEME' })
        .expect(201);

      expectSuccessResponse(res.body);
      deletableCouponId = res.body.data.id as string;
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /coupons/:id — Get Coupon by ID
  // ─────────────────────────────────────────────────────────────

  describe('GET /coupons/:id', () => {
    it('should return coupon by ID for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${COUPONS_URL}/${couponId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', couponId);
      expect(res.body.data).toHaveProperty('code', VALID_COUPON.code);
    });

    it('should return 404 for non-existent coupon', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${COUPONS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /coupons/:id — Update Coupon
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /coupons/:id', () => {
    it('should update coupon fields as super_admin', async () => {
      const res = await request(httpServer)
        .patch(`${COUPONS_URL}/${couponId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ discountValue: 25, isActive: false })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('discountValue', 25);
      expect(res.body.data).toHaveProperty('isActive', false);
    });

    it('should return 404 for non-existent coupon', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${COUPONS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ discountValue: 10 })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .patch(`${COUPONS_URL}/${couponId}`)
        .send({ discountValue: 10 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /coupons/:id — Delete Coupon
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /coupons/:id', () => {
    it('should delete coupon as super_admin', async () => {
      const res = await request(httpServer)
        .delete(`${COUPONS_URL}/${deletableCouponId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent coupon', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .delete(`${COUPONS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 404 when deleting already-deleted coupon', async () => {
      const res = await request(httpServer)
        .delete(`${COUPONS_URL}/${deletableCouponId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /coupons/apply — Apply Coupon (JWT only)
  // ─────────────────────────────────────────────────────────────

  describe('POST /coupons/apply', () => {
    beforeAll(async () => {
      // Re-activate coupon so apply tests pass
      await request(httpServer)
        .patch(`${COUPONS_URL}/${couponId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true })
        .expect(200);
    });

    it('should return discountAmount for valid coupon code', async () => {
      const res = await request(httpServer)
        .post(`${COUPONS_URL}/apply`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ code: 'TEST20', amount: 100 })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('discountAmount');
      expect(typeof res.body.data.discountAmount).toBe('number');
    });

    it('should return 404 for invalid coupon code (POST apply)', async () => {
      const res = await request(httpServer)
        .post(`${COUPONS_URL}/apply`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ code: 'INVALIDCODE999', amount: 100 })
        .expect(404);

      expectErrorResponse(res.body, 'COUPON_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(`${COUPONS_URL}/apply`)
        .send({ code: 'TEST20', amount: 100 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });
});
