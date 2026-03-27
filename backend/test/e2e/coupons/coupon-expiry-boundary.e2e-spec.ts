/**
 * CareKit — Coupon Expiry Boundary E2E Tests
 *
 * Tests coupon expiry boundary conditions, usage limits, and edge cases.
 * The expiry check is strictly less-than: `expiresAt < new Date()` — so
 * a coupon whose expiresAt is exactly now is NOT yet expired.
 *
 * Key error codes:
 *   COUPON_EXPIRED          — 400
 *   COUPON_LIMIT_REACHED    — 400
 *   COUPON_USER_LIMIT_REACHED — 400
 *   COUPON_NOT_FOUND        — 404 (inactive coupon)
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  getAuthHeaders,
  expectErrorResponse,
  TEST_USERS,
  type TestApp,
  type AuthResult,
  type TestUserData,
} from '../setup/setup';

const COUPONS_URL = `${API_PREFIX}/coupons`;
const APPLY_URL = `${COUPONS_URL}/apply`;

const PATIENT_A: TestUserData = {
  email: 'coupon-boundary-pa@carekit-test.com',
  password: 'C0up0n!BndA1',
  firstName: 'نادية',
  lastName: 'المطيري',
  phone: '+966507004001',
  gender: 'female',
};

const PATIENT_B: TestUserData = {
  email: 'coupon-boundary-pb@carekit-test.com',
  password: 'C0up0n!BndB2',
  firstName: 'طلال',
  lastName: 'الغامدي',
  phone: '+966507004002',
  gender: 'male',
};

/** Creates a unique coupon code to avoid conflicts between test runs. */
function uniqueCode(suffix: string): string {
  return `BNDTEST${suffix}${Date.now().toString(36).toUpperCase()}`;
}

describe('Coupon Expiry Boundary (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<TestApp['app']['getHttpServer']>;
  let superAdmin: AuthResult;
  let patientA: AuthResult;
  let patientB: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    superAdmin = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );

    patientA = await registerTestPatient(httpServer, PATIENT_A);
    patientB = await registerTestPatient(httpServer, PATIENT_B);
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ---------------------------------------------------------------------------

  it('applying an active coupon with no expiry — always succeeds', async () => {
    const code = uniqueCode('NOEXP');

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'fixed',
        discountValue: 50,
        isActive: true,
      })
      .expect(201);

    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 500 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.discountAmount).toBeGreaterThanOrEqual(0);
  });

  // ---------------------------------------------------------------------------

  it('applying a coupon with future expiry — succeeds', async () => {
    const code = uniqueCode('FUTURE');
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1 hour

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'fixed',
        discountValue: 30,
        expiresAt: futureDate,
        isActive: true,
      })
      .expect(201);

    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 300 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.discountAmount).toBeGreaterThanOrEqual(0);
  });

  // ---------------------------------------------------------------------------

  it('applying an expired coupon — 400 COUPON_EXPIRED', async () => {
    const code = uniqueCode('EXPIRED');
    const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second ago

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'fixed',
        discountValue: 20,
        expiresAt: pastDate,
        isActive: true,
      })
      .expect(201);

    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 200 })
      .expect(400);

    expectErrorResponse(res.body as Record<string, unknown>, 'COUPON_EXPIRED');
  });

  // ---------------------------------------------------------------------------

  it('applying a coupon 1 ms past expiry — 400 COUPON_EXPIRED', async () => {
    const code = uniqueCode('ONEMS');
    // expiresAt < new Date() is the check — 1ms ago is strictly in the past
    const justPast = new Date(Date.now() - 1).toISOString();

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'percentage',
        discountValue: 10,
        expiresAt: justPast,
        isActive: true,
      })
      .expect(201);

    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 100 })
      .expect(400);

    expectErrorResponse(res.body as Record<string, unknown>, 'COUPON_EXPIRED');
  });

  // ---------------------------------------------------------------------------

  it('coupon with maxUses=1 — second use rejected with COUPON_LIMIT_REACHED', async () => {
    const code = uniqueCode('MAXONE');

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'fixed',
        discountValue: 25,
        maxUses: 1,
        isActive: true,
      })
      .expect(201);

    // First use — should succeed
    await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 250 })
      .expect(201);

    // Second use — limit reached
    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientB.accessToken))
      .send({ code, amount: 250 })
      .expect(400);

    expectErrorResponse(res.body as Record<string, unknown>, 'COUPON_LIMIT_REACHED');
  });

  // ---------------------------------------------------------------------------

  it('inactive coupon — 404 COUPON_NOT_FOUND (not 400)', async () => {
    const code = uniqueCode('INACT');

    const createRes = await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code,
        discountType: 'fixed',
        discountValue: 15,
        isActive: true,
      })
      .expect(201);

    const couponId = (createRes.body.data as Record<string, unknown>).id as string;

    // Deactivate via PATCH
    await request(httpServer)
      .patch(`${COUPONS_URL}/${couponId}`)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({ isActive: false })
      .expect(200);

    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code, amount: 150 })
      .expect(404);

    expectErrorResponse(res.body as Record<string, unknown>, 'COUPON_NOT_FOUND');
  });

  // ---------------------------------------------------------------------------

  it('coupon code is case-insensitive — lowercased input matches uppercase record', async () => {
    const upperCode = uniqueCode('CASE');

    await request(httpServer)
      .post(COUPONS_URL)
      .set(getAuthHeaders(superAdmin.accessToken))
      .send({
        code: upperCode,
        discountType: 'fixed',
        discountValue: 40,
        isActive: true,
      })
      .expect(201);

    // Send lowercase
    const res = await request(httpServer)
      .post(APPLY_URL)
      .set(getAuthHeaders(patientA.accessToken))
      .send({ code: upperCode.toLowerCase(), amount: 400 })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.discountAmount).toBeGreaterThanOrEqual(0);
  });
});
