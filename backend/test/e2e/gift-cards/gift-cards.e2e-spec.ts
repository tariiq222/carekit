/**
 * CareKit — Gift Cards Module E2E Tests
 *
 *   GET    /gift-cards                  — list (PERMISSION:gift-cards:view)
 *   GET    /gift-cards/:id              — get by ID (PERMISSION:gift-cards:view)
 *   POST   /gift-cards                  — create (PERMISSION:gift-cards:create)
 *   PATCH  /gift-cards/:id              — update (PERMISSION:gift-cards:edit)
 *   DELETE /gift-cards/:id              — deactivate (PERMISSION:gift-cards:delete)
 *   POST   /gift-cards/check-balance    — check balance (PUBLIC)
 *   POST   /gift-cards/:id/credit       — add credit (PERMISSION:gift-cards:edit)
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

const GIFT_CARDS_URL = `${API_PREFIX}/gift-cards`;

describe('Gift Cards Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

  let superAdmin: AuthResult;
  let patient: AuthResult;

  let giftCardId: string;
  let giftCardCode: string;
  let deletableCardId: string;

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
  // GET /gift-cards — List Gift Cards
  // ─────────────────────────────────────────────────────────────

  describe('GET /gift-cards', () => {
    it('should return paginated list for super_admin', async () => {
      const res = await request(httpServer)
        .get(GIFT_CARDS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('meta');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await request(httpServer)
        .get(GIFT_CARDS_URL)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no gift-cards:view)', async () => {
      const res = await request(httpServer)
        .get(GIFT_CARDS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /gift-cards — Create Gift Card
  // ─────────────────────────────────────────────────────────────

  describe('POST /gift-cards', () => {
    it('should create gift card with auto-generated GC- code (201)', async () => {
      const res = await request(httpServer)
        .post(GIFT_CARDS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ initialAmount: 500 })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('code');
      expect(res.body.data).toHaveProperty('balance', 500);
      expect(res.body.data).toHaveProperty('isActive', true);
      expect((res.body.data.code as string).startsWith('GC-')).toBe(true);

      giftCardId = res.body.data.id as string;
      giftCardCode = res.body.data.code as string;
    });

    it('should return 400 for duplicate code when explicitly specified', async () => {
      // Create with explicit code first
      const firstRes = await request(httpServer)
        .post(GIFT_CARDS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ initialAmount: 100, code: 'GC-DUPTEST' })
        .expect(201);

      deletableCardId = firstRes.body.data.id as string;

      // Try to create duplicate
      const res = await request(httpServer)
        .post(GIFT_CARDS_URL)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ initialAmount: 200, code: 'GC-DUPTEST' })
        .expect(400);

      expectErrorResponse(res.body, 'CODE_EXISTS');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(GIFT_CARDS_URL)
        .send({ initialAmount: 500 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no gift-cards:create)', async () => {
      const res = await request(httpServer)
        .post(GIFT_CARDS_URL)
        .set(getAuthHeaders(patient.accessToken))
        .send({ initialAmount: 500 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /gift-cards/:id — Get Gift Card by ID
  // ─────────────────────────────────────────────────────────────

  describe('GET /gift-cards/:id', () => {
    it('should return gift card by ID for super_admin', async () => {
      const res = await request(httpServer)
        .get(`${GIFT_CARDS_URL}/${giftCardId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('id', giftCardId);
      expect(res.body.data).toHaveProperty('code', giftCardCode);
      expect(res.body.data).toHaveProperty('balance');
    });

    it('should return 404 for non-existent gift card', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .get(`${GIFT_CARDS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /gift-cards/:id — Update Gift Card
  // ─────────────────────────────────────────────────────────────

  describe('PATCH /gift-cards/:id', () => {
    it('should update isActive and expiresAt as super_admin', async () => {
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(httpServer)
        .patch(`${GIFT_CARDS_URL}/${giftCardId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: true, expiresAt })
        .expect(200);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isActive', true);
      expect(res.body.data).toHaveProperty('expiresAt');
    });

    it('should return 404 for non-existent gift card', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .patch(`${GIFT_CARDS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ isActive: false })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .patch(`${GIFT_CARDS_URL}/${giftCardId}`)
        .send({ isActive: false })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /gift-cards/check-balance — Check Balance (PUBLIC)
  // ─────────────────────────────────────────────────────────────

  describe('POST /gift-cards/check-balance', () => {
    it('should return balance and isValid for valid code', async () => {
      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/check-balance`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ code: giftCardCode })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('balance');
      expect(res.body.data).toHaveProperty('isValid');
      expect(typeof res.body.data.balance).toBe('number');
      expect(typeof res.body.data.isValid).toBe('boolean');
      expect(res.body.data.isValid).toBe(true);
    });

    it('should return isValid=false for unknown code', async () => {
      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/check-balance`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ code: 'GC-DOESNOTEXIST000' })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('isValid', false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /gift-cards/:id/credit — Add Credit
  // ─────────────────────────────────────────────────────────────

  describe('POST /gift-cards/:id/credit', () => {
    it('should add credit and return updated balance', async () => {
      const balanceBefore = 500;
      const creditAmount = 200;

      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/${giftCardId}/credit`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ amount: creditAmount })
        .expect(201);

      expectSuccessResponse(res.body);
      expect(res.body.data).toHaveProperty('balance', balanceBefore + creditAmount);
    });

    it('should return 404 for non-existent gift card', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/${fakeId}/credit`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .send({ amount: 100 })
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/${giftCardId}/credit`)
        .send({ amount: 100 })
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no gift-cards:edit)', async () => {
      const res = await request(httpServer)
        .post(`${GIFT_CARDS_URL}/${giftCardId}/credit`)
        .set(getAuthHeaders(patient.accessToken))
        .send({ amount: 100 })
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /gift-cards/:id — Deactivate Gift Card
  // ─────────────────────────────────────────────────────────────

  describe('DELETE /gift-cards/:id', () => {
    it('should deactivate gift card as super_admin', async () => {
      const res = await request(httpServer)
        .delete(`${GIFT_CARDS_URL}/${deletableCardId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(200);

      expectSuccessResponse(res.body);
    });

    it('should return 404 for non-existent gift card', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const res = await request(httpServer)
        .delete(`${GIFT_CARDS_URL}/${fakeId}`)
        .set(getAuthHeaders(superAdmin.accessToken))
        .expect(404);

      expectErrorResponse(res.body, 'NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const res = await request(httpServer)
        .delete(`${GIFT_CARDS_URL}/${giftCardId}`)
        .expect(401);

      expectErrorResponse(res.body, 'AUTH_TOKEN_INVALID');
    });

    it('should return 403 for patient (no gift-cards:delete)', async () => {
      const res = await request(httpServer)
        .delete(`${GIFT_CARDS_URL}/${giftCardId}`)
        .set(getAuthHeaders(patient.accessToken))
        .expect(403);

      expectErrorResponse(res.body, 'FORBIDDEN');
    });
  });
});
