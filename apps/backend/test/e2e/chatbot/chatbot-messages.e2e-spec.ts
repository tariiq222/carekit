/**
 * CareKit — Chatbot Messages E2E Tests
 *
 * Endpoints:
 *   POST /chatbot/sessions/:id/messages        — send message (AI involved)
 *   POST /chatbot/sessions/:id/messages/stream — SSE stream (AI involved)
 *
 * The AI call requires OpenRouter API key which is not available in test env.
 * We test: routing, auth, validation, and 404/400 error paths.
 * The "reaches service" test accepts any non-auth error (200/201/500/503).
 */

import * as crypto from 'crypto';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  API_PREFIX,
  createTestApp,
  closeTestApp,
  registerTestPatient,
  getAuthHeaders,
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
let patientAuth: AuthResult;

let activeSessionId: string;

beforeAll(async () => {
  testApp = await createTestApp();
  httpServer = testApp.httpServer;

  patientAuth = await registerTestPatient(httpServer, TEST_USERS.patient);

  // Create a session for message tests
  const res = await request(httpServer)
    .post(SESSIONS_URL)
    .set(getAuthHeaders(patientAuth.accessToken))
    .send({ language: 'en' });

  activeSessionId = (res.body as { data: { session: { id: string } } }).data
    .session.id;
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// POST /chatbot/sessions/:id/messages
// ---------------------------------------------------------------------------

describe('POST /chatbot/sessions/:id/messages', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages`)
      .send({ content: 'Hello' })
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({})
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when content is empty string', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: '' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 when content exceeds 2000 chars', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'x'.repeat(2001) })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 for non-UUID session id', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/not-a-uuid/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'Hello' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for a ghost session UUID', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${GHOST_UUID}/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'Hello' })
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  /**
   * With a valid session the request reaches the AI service which calls
   * OpenRouter. In test env there is no API key so expect 5xx/4xx — not 401/403/400.
   */
  it('reaches AI service layer for valid session + content', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'What services do you offer?' });

    // Must not be an auth/permission/validation error
    expect([401, 403, 400]).not.toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/sessions/:id/messages/stream
// ---------------------------------------------------------------------------

describe('POST /chatbot/sessions/:id/messages/stream', () => {
  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages/stream`)
      .send({ content: 'Hello' })
      .expect(401);
    expectErrorResponse(
      res.body as Record<string, unknown>,
      'AUTH_TOKEN_INVALID',
    );
  });

  it('returns 400 when content is missing', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages/stream`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({})
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 for non-UUID session id', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/not-a-uuid/messages/stream`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'Hello' })
      .expect(400);
    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  /**
   * Stream endpoint sets headers and opens an SSE connection. Any response
   * that isn't a validation/auth rejection shows the route is reachable.
   * Supertest buffers SSE data until the response ends.
   */
  it('returns non-auth response for valid session (stream endpoint reachable)', async () => {
    const res = await request(httpServer)
      .post(`${SESSIONS_URL}/${activeSessionId}/messages/stream`)
      .set(getAuthHeaders(patientAuth.accessToken))
      .send({ content: 'Hello' })
      .buffer(true)
      .parse((_res, callback) => {
        let data = '';
        _res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        _res.on('end', () => callback(null, data));
      });

    expect([401, 403, 400]).not.toContain(res.status);
  });
});
