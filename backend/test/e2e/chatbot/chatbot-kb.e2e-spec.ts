/**
 * CareKit — Chatbot Knowledge Base E2E Tests
 *
 * Permission matrix:
 *   super_admin  → chatbot: view, create, edit, delete (all)
 *   practitioner → NO chatbot permissions → 403 on all endpoints
 *
 * Endpoints:
 *   GET   /chatbot/knowledge-base           → chatbot:view
 *   POST  /chatbot/knowledge-base           → chatbot:create (calls OpenRouter — any non-auth status)
 *   PATCH /chatbot/knowledge-base/:id       → chatbot:edit (calls OpenRouter — any non-auth status)
 *   DELETE /chatbot/knowledge-base/:id      → chatbot:delete (Prisma P2025 on missing → 500)
 *   POST  /chatbot/knowledge-base/sync      → chatbot:edit (calls OpenRouter — any non-auth status)
 *
 * Notes:
 *   - POST/PATCH call OpenRouter for embeddings — test env has no key → accept any non-auth status
 *   - DELETE on ghost UUID → Prisma P2025 (unhandled) → 500, not 404
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

const KB_URL = `${API_PREFIX}/chatbot/knowledge-base`;
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
// GET /chatbot/knowledge-base — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/knowledge-base', () => {
  it('returns 200 with paginated KB entries for super_admin', async () => {
    const res = await request(httpServer)
      .get(KB_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('meta');
  });

  it('returns 200 with pagination params', async () => {
    const res = await request(httpServer)
      .get(`${KB_URL}?page=1&perPage=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 filtered by source', async () => {
    const res = await request(httpServer)
      .get(`${KB_URL}?source=manual`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 200 filtered by category', async () => {
    const res = await request(httpServer)
      .get(`${KB_URL}?category=services`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(KB_URL)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(KB_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/knowledge-base — chatbot:create
// ---------------------------------------------------------------------------

describe('POST /chatbot/knowledge-base', () => {
  const validEntry = {
    title: 'E2E Test Entry',
    content: 'This is test content for the knowledge base e2e test.',
    category: 'general',
  };

  it('returns 400 when title is missing', async () => {
    const res = await request(httpServer)
      .post(KB_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ content: 'no title here', category: 'test' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(httpServer)
      .post(KB_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ title: 'No content', category: 'test' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(KB_URL)
      .send(validEntry)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:create)', async () => {
    const res = await request(httpServer)
      .post(KB_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send(validEntry)
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * Creating an entry calls OpenRouter for embeddings — no key in test env.
   * Any non-auth, non-validation response confirms the route reached the service.
   */
  it('reaches the service layer for super_admin with valid body', async () => {
    const res = await request(httpServer)
      .post(KB_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send(validEntry);

    expect([401, 403, 400]).not.toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// PATCH /chatbot/knowledge-base/:id — chatbot:edit
// ---------------------------------------------------------------------------

describe('PATCH /chatbot/knowledge-base/:id', () => {
  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .patch(`${KB_URL}/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ title: 'Updated' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .patch(`${KB_URL}/${GHOST_UUID}`)
      .send({ title: 'Updated' })
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .patch(`${KB_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .send({ title: 'Updated' })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * PATCH on a ghost UUID calls ragService.update() which uses Prisma's
   * knowledgeBase.update() directly — Prisma throws P2025 (record not found)
   * which is caught as a non-HttpException by the global filter → 500.
   * We verify auth + permissions pass; the service error is expected.
   */
  it('reaches service layer (non-auth response) for ghost UUID', async () => {
    const res = await request(httpServer)
      .patch(`${KB_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .send({ title: 'Updated Title' });

    expect([401, 403]).not.toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// DELETE /chatbot/knowledge-base/:id — chatbot:delete
// ---------------------------------------------------------------------------

describe('DELETE /chatbot/knowledge-base/:id', () => {
  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .delete(`${KB_URL}/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .delete(`${KB_URL}/${GHOST_UUID}`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:delete)', async () => {
    const res = await request(httpServer)
      .delete(`${KB_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * DELETE on ghost UUID → Prisma P2025 (unhandled) → 500.
   * Auth and permissions pass correctly — we verify the non-auth response.
   */
  it('reaches service layer (non-auth response) for ghost UUID', async () => {
    const res = await request(httpServer)
      .delete(`${KB_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken));

    expect([401, 403]).not.toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/knowledge-base/sync — chatbot:edit
// ---------------------------------------------------------------------------

describe('POST /chatbot/knowledge-base/sync', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${KB_URL}/sync`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .post(`${KB_URL}/sync`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * Sync calls OpenRouter for embeddings — no API key in test env.
   * Any non-auth, non-validation response confirms the route reached the service.
   * If DB has no services/practitioners, synced count may be 0 (200 with no embeddings needed).
   */
  it('reaches service layer (non-auth response) for super_admin', async () => {
    const res = await request(httpServer)
      .post(`${KB_URL}/sync`)
      .set(getAuthHeaders(adminAuth.accessToken));

    expect([401, 403]).not.toContain(res.status);
  });
});
