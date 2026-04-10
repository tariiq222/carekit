/**
 * CareKit — Chatbot Admin E2E Tests
 *
 * Permission matrix:
 *   super_admin  → chatbot: view, create, edit, delete (all)
 *   practitioner → NO chatbot permissions → 403 on all admin endpoints
 *
 * Endpoints:
 *   GET  /chatbot/config              → chatbot:view
 *   GET  /chatbot/config/:category    → chatbot:view
 *   PUT  /chatbot/config              → chatbot:edit
 *   POST /chatbot/config/seed         → chatbot:edit
 *   GET  /chatbot/analytics           → chatbot:view
 *   GET  /chatbot/analytics/questions → chatbot:view
 *   POST /chatbot/sessions/:id/staff-messages → chatbot:edit
 */

import * as crypto from 'crypto';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
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
  TestApp,
  AuthResult,
} from '../setup/setup';

const CHATBOT_URL = `${API_PREFIX}/chatbot`;
const GHOST_UUID = crypto.randomUUID();

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;
let adminAuth: AuthResult;
let practitionerAuth: AuthResult;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  adminAuth = await loginTestUser(
    httpServer,
    TEST_USERS.super_admin.email,
    TEST_USERS.super_admin.password,
  );

  practitionerAuth = await createTestUserWithRole(
    httpServer,
    adminAuth.accessToken,
    TEST_USERS.practitioner,
    'practitioner',
  );
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// GET /chatbot/config — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/config', () => {
  it('returns 200 with config entries for super_admin', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: unknown }).data;
    expect(data !== null && typeof data === 'object').toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/config/:category — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/config/:category', () => {
  it('returns 200 for a valid category (super_admin)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config/general`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 for unknown category (returns empty list, no error)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config/nonexistent-category`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config/general`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/config/general`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// PUT /chatbot/config — chatbot:edit
// ---------------------------------------------------------------------------

describe('PUT /chatbot/config', () => {
  const validConfig = {
    configs: [{ key: 'e2e_test_key', value: 'e2e_value', category: 'test' }],
  };

  it('returns 200 and upserts config for super_admin', async () => {
    const res = await request(httpServer)
      .put(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send(validConfig)
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 400 when configs array is missing', async () => {
    const res = await request(httpServer)
      .put(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({})
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when a config item is missing required key field', async () => {
    const res = await request(httpServer)
      .put(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ configs: [{ value: 'no_key', category: 'test' }] })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .put(`${CHATBOT_URL}/config`)
      .send(validConfig)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .put(`${CHATBOT_URL}/config`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send(validConfig)
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/config/seed — chatbot:edit
// ---------------------------------------------------------------------------

describe('POST /chatbot/config/seed', () => {
  it('returns 200 and seeds default config for super_admin', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/config/seed`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(typeof data.seeded).toBe('number');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/config/seed`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/config/seed`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/analytics — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/analytics', () => {
  it('returns 200 with session stats for super_admin', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(typeof data['totalSessions']).toBe('number');
    expect(typeof data['totalMessages']).toBe('number');
  });

  it('returns 200 with date range filter', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics?from=2025-01-01&to=2025-12-31`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/analytics/questions — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/analytics/questions', () => {
  it('returns 200 with top questions list for super_admin', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics/questions`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: unknown }).data;
    expect(Array.isArray(data)).toBe(true);
  });

  it('returns 200 with limit param', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics/questions?limit=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics/questions`)
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(`${CHATBOT_URL}/analytics/questions`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/sessions/:id/staff-messages — chatbot:edit
// ---------------------------------------------------------------------------

describe('POST /chatbot/sessions/:id/staff-messages', () => {
  it('returns 404 for a ghost session UUID (super_admin)', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/sessions/${GHOST_UUID}/staff-messages`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ content: 'Hello from staff' })
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/sessions/${GHOST_UUID}/staff-messages`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({})
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/sessions/${GHOST_UUID}/staff-messages`)
      .send({ content: 'Hello' })
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .post(`${CHATBOT_URL}/sessions/${GHOST_UUID}/staff-messages`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({ content: 'Hello' })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});
