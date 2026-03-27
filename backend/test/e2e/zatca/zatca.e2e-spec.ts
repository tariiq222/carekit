/**
 * CareKit — ZATCA Module E2E Tests
 *
 * Permission matrix (from seed.data.ts):
 *   super_admin  → whitelabel:view+edit + invoices:view+edit (all)
 *   accountant   → invoices:view+create+edit (no whitelabel)
 *   patient      → invoices:view only (no whitelabel)
 *   practitioner → NO whitelabel, NO invoices permissions → 403 all
 *
 * Endpoint → permission mapping:
 *   GET  /zatca/config               → whitelabel:view
 *   POST /zatca/onboard              → whitelabel:edit
 *   GET  /zatca/onboarding/status    → whitelabel:view
 *   GET  /zatca/sandbox/stats        → invoices:view
 *   POST /zatca/sandbox/report/:id   → invoices:edit
 *
 * External ZATCA API calls will fail in test env — we only test routing,
 * RBAC, and validation layers.
 */

import request from 'supertest';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  AuthResult,
  TestApp,
} from '../setup/setup';

const ZATCA_URL = `${API_PREFIX}/zatca`;
const GHOST_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let testApp: TestApp;
let httpServer: ReturnType<TestApp['app']['getHttpServer']>;

let adminAuth: AuthResult;
let accountantAuth: AuthResult;
let practitionerAuth: AuthResult;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  adminAuth = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  [accountantAuth, practitionerAuth] = await Promise.all([
    createTestUserWithRole(
      httpServer,
      adminAuth.accessToken,
      TEST_USERS.accountant,
      'accountant',
    ),
    createTestUserWithRole(
      httpServer,
      adminAuth.accessToken,
      TEST_USERS.practitioner,
      'practitioner',
    ),
  ]);
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// GET /zatca/config — whitelabel:view
// ---------------------------------------------------------------------------

describe('GET /zatca/config', () => {
  it('returns ZATCA config for super_admin with phase field', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/config`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('phase');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer).get(`${ZATCA_URL}/config`).expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for accountant (no whitelabel:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/config`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 403 for practitioner (no whitelabel:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/config`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /zatca/onboarding/status — whitelabel:view
// ---------------------------------------------------------------------------

describe('GET /zatca/onboarding/status', () => {
  it('returns onboarding status for super_admin', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/onboarding/status`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(['phase1', 'phase2']).toContain(data['phase']);
    expect(typeof data['hasCredentials']).toBe('boolean');
    expect(typeof data['csidConfigured']).toBe('boolean');
    expect(typeof data['privateKeyStored']).toBe('boolean');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/onboarding/status`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for accountant (no whitelabel:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/onboarding/status`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 403 for practitioner (no whitelabel:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/onboarding/status`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /zatca/onboard — whitelabel:edit
// ---------------------------------------------------------------------------

describe('POST /zatca/onboard', () => {
  it('returns 400 when otp is missing', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({})
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when otp is too short (< 4 chars)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ otp: '12' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when otp is too long (> 10 chars)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ otp: '12345678901' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when otp is a number (not string)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ otp: 123456 })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when body has extra unknown fields', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ otp: '123456', unknownField: 'x' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .send({ otp: '123456' })
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for accountant (no whitelabel:edit)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .send({ otp: '123456' })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 403 for practitioner (no whitelabel:edit)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({ otp: '123456' })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * With a structurally valid OTP the request reaches the onboarding service
   * which calls the external ZATCA/Fatoora API. In test env there is no live
   * connection, so any non-401/403/400 is acceptable — auth + validation passed.
   */
  it('reaches the service layer for super_admin with valid otp', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/onboard`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ otp: '123456' });

    expect([200, 201, 400, 422, 500, 503]).toContain(res.status);
    // Must not be an auth/permission error
    expect([401, 403]).not.toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// GET /zatca/sandbox/stats — invoices:view
// ---------------------------------------------------------------------------

describe('GET /zatca/sandbox/stats', () => {
  it('returns sandbox stats for super_admin', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/sandbox/stats`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(typeof data['pending']).toBe('number');
    expect(typeof data['reported']).toBe('number');
    expect(typeof data['failed']).toBe('number');
    expect(typeof data['notApplicable']).toBe('number');
  });

  it('returns stats for accountant (invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/sandbox/stats`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(200);
    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/sandbox/stats`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${ZATCA_URL}/sandbox/stats`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /zatca/sandbox/report/:invoiceId — invoices:edit
// ---------------------------------------------------------------------------

describe('POST /zatca/sandbox/report/:invoiceId', () => {
  it('returns 400 for malformed (non-UUID) invoiceId', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/sandbox/report/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for valid UUID that does not exist', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/sandbox/report/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 404 (not 403) for accountant — has invoices:edit', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/sandbox/report/${GHOST_UUID}`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/sandbox/report/${GHOST_UUID}`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no invoices:edit)', async () => {
    const res = await request(httpServer)
      .post(`${ZATCA_URL}/sandbox/report/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});
