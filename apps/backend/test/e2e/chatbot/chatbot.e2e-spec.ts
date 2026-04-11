// E2E tests for Chatbot module

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
  TEST_USERS,
  TestApp,
  AuthResult,
} from '../setup/setup';

const CHATBOT_URL = `${API_PREFIX}/chatbot`;
const GHOST_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Server = ReturnType<INestApplication['getHttpServer']>;

const unauthed = (s: Server, m: Method, p: string) =>
  request(s)[m](p).expect(401);
const forbidden = (s: Server, m: Method, p: string, t: string) =>
  request(s)[m](p).set(getAuthHeaders(t)).expect(403);

describe('Chatbot Module (e2e)', () => {
  let testApp: TestApp;
  let httpServer: Server;
  let adminAuth: AuthResult;
  let patientAuth: AuthResult;
  let accountantAuth: AuthResult;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;

    adminAuth = await loginTestUser(
      httpServer,
      TEST_USERS.super_admin.email,
      TEST_USERS.super_admin.password,
    );
    patientAuth = await registerTestPatient(httpServer, TEST_USERS.patient);
    accountantAuth = await createTestUserWithRole(
      httpServer,
      adminAuth.accessToken,
      TEST_USERS.accountant,
      'accountant',
    );
  }, 60_000);

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ═══════════════════════════════════════════════════════════
  // Sessions (ChatbotController) — no @CheckPermissions guard
  // Any authenticated user can access session endpoints.
  // ═══════════════════════════════════════════════════════════

  describe('Sessions (ChatbotController)', () => {
    let sessionId: string;

    it('POST /sessions 401 — no token', () =>
      unauthed(httpServer, 'post', `${CHATBOT_URL}/sessions`));

    it('POST /sessions 400 — invalid language', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/sessions`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .send({ language: 'fr' })
        .expect(400);
    });

    it('POST /sessions 201 — patient creates session', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/sessions`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .send({ language: 'ar' })
        .expect(201);
      expectSuccessResponse(res.body as Record<string, unknown>);
      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >;
      expect(data).toHaveProperty('session');
      const session = data.session as Record<string, unknown>;
      expect(session).toHaveProperty('id');
      sessionId = session.id as string;
    });

    it('GET /sessions 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/sessions`));

    it('GET /sessions 200 — patient lists own sessions', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/sessions`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('GET /sessions 200 — admin lists all sessions', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/sessions`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('GET /sessions/:id 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/sessions/${GHOST_ID}`));

    it('GET /sessions/:id 403 or 404 — patient cannot access ghost session', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/sessions/${GHOST_ID}`)
        .set(getAuthHeaders(patientAuth.accessToken));
      expect([403, 404]).toContain(res.status);
    });

    it('GET /sessions/:id 200 — patient retrieves own session', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/sessions/${sessionId}`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    // Send message — OpenRouter may be unavailable in test env
    it('POST /sessions/:id/messages 401 — no token', () =>
      unauthed(
        httpServer,
        'post',
        `${CHATBOT_URL}/sessions/${GHOST_ID}/messages`,
      ));

    it('POST /sessions/:id/messages 400 — missing content', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${sessionId}/messages`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .send({})
        .expect(400);
    });

    it('POST /sessions/:id/messages 400 — content over 2000 chars', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${sessionId}/messages`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .send({ content: 'a'.repeat(2001) })
        .expect(400);
    });

    it('POST /sessions/:id/messages — reaches service (OpenRouter may be absent)', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${sessionId}/messages`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .send({ content: 'What are your clinic hours?' });
      expect([201, 500, 502, 503, 504]).toContain(res.status);
    });

    // SSE stream — auth only (no permission check on sessions controller)
    it('POST /sessions/:id/messages/stream 401 — no token', () =>
      unauthed(
        httpServer,
        'post',
        `${CHATBOT_URL}/sessions/${GHOST_ID}/messages/stream`,
      ));

    it('POST /sessions/:id/end 401 — no token', () =>
      unauthed(httpServer, 'post', `${CHATBOT_URL}/sessions/${GHOST_ID}/end`));

    it('POST /sessions/:id/end 200 — patient ends session', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${sessionId}/end`)
        .set(getAuthHeaders(patientAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('POST /sessions/:id/end — already-ended session returns 200 or 4xx', async () => {
      // Service may be idempotent (200) or reject (4xx) — both are valid
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${sessionId}/end`)
        .set(getAuthHeaders(patientAuth.accessToken));
      expect([200, 400, 409, 422]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Config & Analytics (ChatbotAdminController)
  // Requires chatbot:view or chatbot:edit — accountant has neither.
  // ═══════════════════════════════════════════════════════════

  describe('Config & Analytics (ChatbotAdminController)', () => {
    it('GET /config 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/config`));
    it('GET /config 403 — accountant', () =>
      forbidden(
        httpServer,
        'get',
        `${CHATBOT_URL}/config`,
        accountantAuth.accessToken,
      ));

    it('GET /config 200 — admin', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/config`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('PUT /config 401 — no token', () =>
      unauthed(httpServer, 'put', `${CHATBOT_URL}/config`));
    it('PUT /config 403 — accountant', () =>
      forbidden(
        httpServer,
        'put',
        `${CHATBOT_URL}/config`,
        accountantAuth.accessToken,
      ));

    it('POST /config/seed 401 — no token', () =>
      unauthed(httpServer, 'post', `${CHATBOT_URL}/config/seed`));
    it('POST /config/seed 403 — accountant', () =>
      forbidden(
        httpServer,
        'post',
        `${CHATBOT_URL}/config/seed`,
        accountantAuth.accessToken,
      ));

    it('POST /config/seed 200/201 — admin', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/config/seed`)
        .set(getAuthHeaders(adminAuth.accessToken));
      expect([200, 201]).toContain(res.status);
    });

    it('GET /analytics 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/analytics`));
    it('GET /analytics 403 — accountant', () =>
      forbidden(
        httpServer,
        'get',
        `${CHATBOT_URL}/analytics`,
        accountantAuth.accessToken,
      ));

    it('GET /analytics 200 — admin', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/analytics`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('GET /analytics/questions 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/analytics/questions`));
    it('GET /analytics/questions 403 — accountant', () =>
      forbidden(
        httpServer,
        'get',
        `${CHATBOT_URL}/analytics/questions`,
        accountantAuth.accessToken,
      ));

    it('GET /analytics/questions 200 — admin', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/analytics/questions`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('POST /sessions/:id/staff-messages 401 — no token', () =>
      unauthed(
        httpServer,
        'post',
        `${CHATBOT_URL}/sessions/${GHOST_ID}/staff-messages`,
      ));

    it('POST /sessions/:id/staff-messages 403 — accountant', () =>
      forbidden(
        httpServer,
        'post',
        `${CHATBOT_URL}/sessions/${GHOST_ID}/staff-messages`,
        accountantAuth.accessToken,
      ));

    it('POST /sessions/:id/staff-messages 400 — missing content', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/sessions/${GHOST_ID}/staff-messages`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .send({})
        .expect(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Knowledge Base (ChatbotKbController)
  // Requires chatbot:view/create/edit/delete — accountant has none.
  // KB create triggers OpenRouter embedding — may return 500 in CI.
  // ═══════════════════════════════════════════════════════════

  describe('Knowledge Base (ChatbotKbController)', () => {
    let kbEntryId: string | undefined;

    it('POST /knowledge-base 401 — no token', () =>
      unauthed(httpServer, 'post', `${CHATBOT_URL}/knowledge-base`));

    it('POST /knowledge-base 403 — accountant', () =>
      forbidden(
        httpServer,
        'post',
        `${CHATBOT_URL}/knowledge-base`,
        accountantAuth.accessToken,
      ));

    it('POST /knowledge-base 400 — missing required fields', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/knowledge-base`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .send({})
        .expect(400);
    });

    it('POST /knowledge-base 400 — title over 500 chars', async () => {
      await request(httpServer)
        .post(`${CHATBOT_URL}/knowledge-base`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .send({ title: 'T'.repeat(501), content: 'Valid content' })
        .expect(400);
    });

    it('POST /knowledge-base 201 or 500 — admin creates entry (OpenRouter may be absent)', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/knowledge-base`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .send({
          title: 'Clinic Hours',
          content: 'Open 9am–5pm Sunday–Thursday',
          category: 'general',
        });
      expect([201, 500]).toContain(res.status);
      if (res.status === 201) {
        expectSuccessResponse(res.body as Record<string, unknown>);
        const data = (res.body as Record<string, unknown>).data as Record<
          string,
          unknown
        >;
        expect(data).toHaveProperty('id');
        kbEntryId = data.id as string;
      }
    });

    it('GET /knowledge-base 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/knowledge-base`));
    it('GET /knowledge-base 403 — accountant', () =>
      forbidden(
        httpServer,
        'get',
        `${CHATBOT_URL}/knowledge-base`,
        accountantAuth.accessToken,
      ));

    it('GET /knowledge-base 200 — admin lists entries', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/knowledge-base`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('GET /knowledge-base/files 401 — no token', () =>
      unauthed(httpServer, 'get', `${CHATBOT_URL}/knowledge-base/files`));
    it('GET /knowledge-base/files 403 — accountant', () =>
      forbidden(
        httpServer,
        'get',
        `${CHATBOT_URL}/knowledge-base/files`,
        accountantAuth.accessToken,
      ));

    it('GET /knowledge-base/files 200 — admin', async () => {
      const res = await request(httpServer)
        .get(`${CHATBOT_URL}/knowledge-base/files`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('PATCH /knowledge-base/:id 401 — no token', () =>
      unauthed(
        httpServer,
        'patch',
        `${CHATBOT_URL}/knowledge-base/${GHOST_ID}`,
      ));

    it('PATCH /knowledge-base/:id 403 — accountant', () =>
      forbidden(
        httpServer,
        'patch',
        `${CHATBOT_URL}/knowledge-base/${GHOST_ID}`,
        accountantAuth.accessToken,
      ));

    it('PATCH /knowledge-base/:id 200 or skip — admin updates entry (skipped if KB create failed)', async () => {
      if (!kbEntryId) return; // KB entry not created (OpenRouter absent) — skip
      const res = await request(httpServer)
        .patch(`${CHATBOT_URL}/knowledge-base/${kbEntryId}`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .send({ isActive: false })
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });

    it('POST /knowledge-base/sync 401 — no token', () =>
      unauthed(httpServer, 'post', `${CHATBOT_URL}/knowledge-base/sync`));

    it('POST /knowledge-base/sync 403 — accountant', () =>
      forbidden(
        httpServer,
        'post',
        `${CHATBOT_URL}/knowledge-base/sync`,
        accountantAuth.accessToken,
      ));

    it('POST /knowledge-base/sync — reaches service (embedding may be absent)', async () => {
      const res = await request(httpServer)
        .post(`${CHATBOT_URL}/knowledge-base/sync`)
        .set(getAuthHeaders(adminAuth.accessToken));
      expect([200, 201, 500, 502]).toContain(res.status);
    });

    it('DELETE /knowledge-base/:id 401 — no token', () =>
      unauthed(
        httpServer,
        'delete',
        `${CHATBOT_URL}/knowledge-base/${GHOST_ID}`,
      ));

    it('DELETE /knowledge-base/:id 403 — accountant', () =>
      forbidden(
        httpServer,
        'delete',
        `${CHATBOT_URL}/knowledge-base/${GHOST_ID}`,
        accountantAuth.accessToken,
      ));

    it('DELETE /knowledge-base/:id 200 or skip — admin deletes entry (skipped if KB create failed)', async () => {
      if (!kbEntryId) return; // KB entry not created (OpenRouter absent) — skip
      const res = await request(httpServer)
        .delete(`${CHATBOT_URL}/knowledge-base/${kbEntryId}`)
        .set(getAuthHeaders(adminAuth.accessToken))
        .expect(200);
      expectSuccessResponse(res.body as Record<string, unknown>);
    });
  });
});
