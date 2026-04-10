/**
 * CareKit — Chatbot Sessions E2E Tests
 *
 * Sessions controller has no @CheckPermissions — any authenticated user can
 * create and access their own sessions. Admin users see all sessions.
 *
 * NOTE: POST /sessions has @Throttle({ limit: 5, ttl: 60 }). We create a
 * minimal number of sessions in beforeAll to stay within limits.
 *
 * Endpoints:
 *   POST   /chatbot/sessions          — any auth user
 *   GET    /chatbot/sessions          — any auth user (self) | admin sees all
 *   GET    /chatbot/sessions/:id      — session owner only
 *   POST   /chatbot/sessions/:id/end  — session owner only
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
  getAuthHeaders,
  expectSuccessResponse,
  expectErrorResponse,
  TEST_USERS,
  TestApp,
  AuthResult,
} from '../setup/setup';

const CHATBOT_URL = `${API_PREFIX}/chatbot`;
const SESSIONS_URL = `${CHATBOT_URL}/sessions`;
const GHOST_UUID = crypto.randomUUID();

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;
let adminAuth: AuthResult;
let patientAuth: AuthResult;

// Sessions created in beforeAll for use in later describe blocks
let patientSessionId: string;
let endableSessionId: string;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  adminAuth = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  patientAuth = await registerTestPatient(httpServer, TEST_USERS.patient);

  // Create 2 sessions — one for GET tests, one for end tests
  const [sess1, sess2] = await Promise.all([
    request(httpServer)
      .post(SESSIONS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ language: 'en' }),
    request(httpServer)
      .post(SESSIONS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ language: 'ar' }),
  ]);

  patientSessionId = (sess1.body as { data: { session: { id: string } } }).data
    .session.id;
  endableSessionId = (sess2.body as { data: { session: { id: string } } }).data
    .session.id;
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// POST /chatbot/sessions
// ---------------------------------------------------------------------------

describe('POST /chatbot/sessions', () => {
  it('returns 400 for invalid language value', async () => {
    const res = await request(httpServer)
      .post(SESSIONS_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ language: 'fr' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 for non-whitelisted fields', async () => {
    const res = await request(httpServer)
      .post(SESSIONS_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ language: 'en', injected: true })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 or 429 without token (throttle may apply)', async () => {
    const res = await request(httpServer)
      .post(SESSIONS_URL)
      .send({ language: 'en' });
    // POST /sessions is throttled at 5/min; unauthenticated requests count toward
    // the limit — accept either 401 (auth rejected) or 429 (rate limited)
    expect([401, 429]).toContain(res.status);
  });

  it('sessions created in beforeAll have correct shape', () => {
    expect(typeof patientSessionId).toBe('string');
    expect(patientSessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/sessions
// ---------------------------------------------------------------------------

describe('GET /chatbot/sessions', () => {
  it('returns 200 with patient own sessions list', async () => {
    const res = await request(httpServer)
      .get(SESSIONS_URL)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('returns 200 for admin with all sessions', async () => {
    const res = await request(httpServer)
      .get(SESSIONS_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 with pagination meta when page + perPage provided', async () => {
    const res = await request(httpServer)
      .get(`${SESSIONS_URL}?page=1&perPage=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('meta');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer).get(SESSIONS_URL).expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/sessions/:id
// ---------------------------------------------------------------------------

describe('GET /chatbot/sessions/:id', () => {
  it('returns 200 for the session owner with messages array', async () => {
    const res = await request(httpServer)
      .get(`${SESSIONS_URL}/${patientSessionId}`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data.id).toBe(patientSessionId);
    expect(Array.isArray(data.messages)).toBe(true);
  });

  it('returns 404 for a ghost session UUID (owner check)', async () => {
    const res = await request(httpServer)
      .get(`${SESSIONS_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .get(`${SESSIONS_URL}/not-a-uuid`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${SESSIONS_URL}/${patientSessionId}`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/sessions/:id/end
// ---------------------------------------------------------------------------

describe('POST /chatbot/sessions/:id/end', () => {
  it('returns 200 when patient ends their own session', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${endableSessionId}/end`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data).toHaveProperty('endedAt');
  });

  it('returns 404 for a ghost session UUID', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${GHOST_UUID}/end`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/not-a-uuid/end`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${endableSessionId}/end`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });
});
