/**
 * CareKit — Invoices Module E2E Tests
 *
 * Permission matrix (from seed.data.ts):
 *   super_admin  → invoices: view, create, edit, delete
 *   accountant   → invoices: view, create, edit
 *   patient      → invoices: view  (own invoices)
 *   practitioner → NO invoices permissions → 403
 *
 * Endpoints:
 *   GET    /invoices/stats
 *   GET    /invoices
 *   GET    /invoices/payment/:paymentId
 *   GET    /invoices/:id
 *   POST   /invoices
 *   GET    /invoices/:id/html
 *   PATCH  /invoices/:id/send
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  loginTestUser,
  registerTestPatient,
  createTestUserWithRole,
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  TestApp,
  AuthResult,
} from '../setup/setup';

const INVOICES_URL = `${API_PREFIX}/invoices`;
// A structurally valid UUID that will never exist in the test DB
const GHOST_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;
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

  // Register patient (has invoices:view)
  await registerTestPatient(httpServer, TEST_USERS.patient);
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// GET /invoices/stats
// ---------------------------------------------------------------------------

describe('GET /invoices/stats', () => {
  it('returns 200 for super_admin with stats shape', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/stats`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(typeof data.total).toBe('number');
  });

  it('returns 200 for accountant (invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/stats`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(200);
    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/stats`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/stats`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /invoices
// ---------------------------------------------------------------------------

describe('GET /invoices', () => {
  it('returns 200 paginated list for super_admin', async () => {
    const res = await request(httpServer)
      .get(INVOICES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(Array.isArray(data.items ?? data)).toBe(true);
  });

  it('returns 200 for accountant (invoices:view)', async () => {
    const res = await request(httpServer)
      .get(INVOICES_URL)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(200);
    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 with pagination meta when page + perPage provided', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}?page=1&perPage=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);
    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(data).toHaveProperty('meta');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer).get(INVOICES_URL).expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices permissions)', async () => {
    const res = await request(httpServer)
      .get(INVOICES_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /invoices/:id
// ---------------------------------------------------------------------------

describe('GET /invoices/:id', () => {
  it('returns 404 for non-existent invoice (super_admin)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 404 for non-existent invoice (accountant)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 for malformed UUID', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /invoices/payment/:paymentId
// ---------------------------------------------------------------------------

describe('GET /invoices/payment/:paymentId', () => {
  it('returns 404 when no invoice for this payment (super_admin)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/payment/${GHOST_ID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 for malformed paymentId', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/payment/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/payment/${GHOST_ID}`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/payment/${GHOST_ID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 404 (not 403) for accountant with ghost paymentId', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/payment/${GHOST_ID}`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /invoices
// ---------------------------------------------------------------------------

describe('POST /invoices', () => {
  it('returns 404 when paymentId does not exist (super_admin)', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ paymentId: GHOST_ID })
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 when paymentId is missing', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({})
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when paymentId is not a valid UUID', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ paymentId: 'invalid-uuid' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when non-whitelisted fields are sent', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ paymentId: GHOST_ID, extra: 'injected' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .send({ paymentId: GHOST_ID })
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:create)', async () => {
    const res = await request(httpServer)
      .post(INVOICES_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({ paymentId: GHOST_ID })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /invoices/:id/html
// ---------------------------------------------------------------------------

describe('GET /invoices/:id/html', () => {
  it('returns 404 for non-existent invoice (super_admin)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}/html`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 404 (not 403) for accountant with ghost id', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}/html`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}/html`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:view)', async () => {
    const res = await request(httpServer)
      .get(`${INVOICES_URL}/${GHOST_ID}/html`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// PATCH /invoices/:id/send
// ---------------------------------------------------------------------------

describe('PATCH /invoices/:id/send', () => {
  it('returns 404 for non-existent invoice (super_admin)', async () => {
    const res = await request(httpServer)
      .patch(`${INVOICES_URL}/${GHOST_ID}/send`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 for malformed invoice UUID', async () => {
    const res = await request(httpServer)
      .patch(`${INVOICES_URL}/not-a-uuid/send`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .patch(`${INVOICES_URL}/${GHOST_ID}/send`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no invoices:edit)', async () => {
    const res = await request(httpServer)
      .patch(`${INVOICES_URL}/${GHOST_ID}/send`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 404 (not 403) for accountant — has invoices:edit', async () => {
    const res = await request(httpServer)
      .patch(`${INVOICES_URL}/${GHOST_ID}/send`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });
});
