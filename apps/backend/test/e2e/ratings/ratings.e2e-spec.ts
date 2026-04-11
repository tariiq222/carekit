/**
 * CareKit — Ratings Module E2E Tests
 *
 * Covers:
 *   POST /api/v1/ratings                           - submit a rating for a completed booking
 *   GET  /api/v1/ratings/practitioner/:id          - paginated ratings by practitioner
 *   GET  /api/v1/ratings/booking/:bookingId        - get rating for a specific booking
 *
 * Permission matrix (from seed.data.ts):
 *   super_admin  → ratings: create, view (all permissions)
 *   practitioner → ratings: view
 *   patient      → ratings: create, view
 *   accountant   → NO ratings permissions → 403 on all endpoints
 */

import * as crypto from 'crypto';
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

const RATINGS_URL = `${API_PREFIX}/ratings`;

// A structurally valid UUID that will never exist in the test DB
const GHOST_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;

let adminAuth: AuthResult;
let patientAuth: AuthResult;
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

  patientAuth = await registerTestPatient(httpServer, TEST_USERS.patient);

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
// POST /ratings — DTO validation (no DB hit, rejected before service layer)
// ---------------------------------------------------------------------------

describe('POST /ratings — validation', () => {
  it('returns 400 when stars = 0 (below @Min(1))', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 0 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when stars = 6 (above @Max(5))', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 6 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when bookingId is missing', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ stars: 4 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when bookingId is not a valid UUID', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: 'not-a-uuid', stars: 3 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when stars is a float (1.5) — @IsInt() fails', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 1.5 })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when comment exceeds 2000 characters', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 5, comment: 'x'.repeat(2001) })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when non-whitelisted fields are sent', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 4, injected: true })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /ratings — auth & permissions
// ---------------------------------------------------------------------------

describe('POST /ratings — auth and permissions', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .send({ bookingId: GHOST_UUID, stars: 4 })
      .expect(401);

    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for accountant (no ratings:create permission)', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 3 })
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 403 for practitioner (has ratings:view but not ratings:create)', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 3 })
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 404 when patient posts a valid UUID booking that does not exist', async () => {
    // DTO passes validation; service does DB lookup → NotFoundException
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ bookingId: crypto.randomUUID(), stars: 4 })
      .expect(404);

    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 404 when super_admin posts a valid UUID booking that does not exist', async () => {
    const res = await request(httpServer)
      .post(RATINGS_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ bookingId: GHOST_UUID, stars: 5 })
      .expect(404);

    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// GET /ratings/practitioner/:practitionerId
// ---------------------------------------------------------------------------

describe('GET /ratings/practitioner/:practitionerId', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}`)
      .expect(401);

    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 400 for non-UUID practitionerId', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 403 for accountant (no ratings:view permission)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 200 with empty list for valid UUID with no ratings (super_admin)', async () => {
    // findByPractitioner never throws — returns empty paginated list
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(Array.isArray(data.items)).toBe(true);
    expect((data.items as unknown[]).length).toBe(0);
  });

  it('returns 200 for patient role (has ratings:view)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 for practitioner role (has ratings:view)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns pagination meta when page and perPage params are provided', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/practitioner/${GHOST_UUID}?page=1&perPage=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    expect(data).toHaveProperty('meta');
  });
});

// ---------------------------------------------------------------------------
// GET /ratings/booking/:bookingId
// ---------------------------------------------------------------------------

describe('GET /ratings/booking/:bookingId', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${GHOST_UUID}`)
      .expect(401);

    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 400 for non-UUID bookingId', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 403 for accountant (no ratings:view permission)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${GHOST_UUID}`)
      .set(getAuthHeaders(accountantAuth.accessToken))
      .expect(403);

    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 200 for booking UUID with no rating (super_admin)', async () => {
    // findByBooking uses findUnique — returns null, interceptor wraps as success
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 for patient role (has ratings:view)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${GHOST_UUID}`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 for practitioner role (has ratings:view)', async () => {
    const res = await request(httpServer)
      .get(`${RATINGS_URL}/booking/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });
});
