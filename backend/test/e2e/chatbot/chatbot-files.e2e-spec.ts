/**
 * CareKit — Chatbot Knowledge Base Files E2E Tests
 *
 * Permission matrix:
 *   super_admin  → chatbot: view, create, edit, delete (all)
 *   practitioner → NO chatbot permissions → 403 on all endpoints
 *
 * Endpoints:
 *   POST   /chatbot/knowledge-base/files          → chatbot:create (file upload)
 *   GET    /chatbot/knowledge-base/files          → chatbot:view
 *   POST   /chatbot/knowledge-base/files/:id/process → chatbot:edit
 *   DELETE /chatbot/knowledge-base/files/:id      → chatbot:delete
 *
 * Notes:
 *   - POST /files returns 201 (NestJS default for POST without @HttpCode)
 *   - POST /files/:id/process and DELETE return 200/@HttpCode(200)
 *   - processFile calls OpenRouter for embeddings — will fail in test env
 *   - fileService.processFile/deleteFile have proper NOT_FOUND error objects → 404
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

const FILES_URL = `${API_PREFIX}/chatbot/knowledge-base/files`;
const GHOST_UUID = crypto.randomUUID();

let testApp: TestApp;
let httpServer: ReturnType<INestApplication['getHttpServer']>;
let adminAuth: AuthResult;
let practitionerAuth: AuthResult;

// File uploaded in beforeAll for later tests
let uploadedFileId: string | null = null;

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

  // Attempt to upload a test file for use in process/delete tests
  const txtContent = Buffer.from('This is a test knowledge base document for CareKit e2e tests.');
  const uploadRes = await request(httpServer)
    .post(FILES_URL)
    .set(getAuthHeaders(adminAuth.accessToken))
    .attach('file', txtContent, { filename: 'test-kb.txt', contentType: 'text/plain' });

  if (uploadRes.status === 201) {
    uploadedFileId = (uploadRes.body as { data: { id: string } }).data?.id ?? null;
  }
});

afterAll(async () => {
  await closeTestApp(testApp.app);
});

// ---------------------------------------------------------------------------
// POST /chatbot/knowledge-base/files — chatbot:create
// ---------------------------------------------------------------------------

describe('POST /chatbot/knowledge-base/files', () => {
  it('returns 400 when no file is provided', async () => {
    const res = await request(httpServer)
      .post(FILES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 400 for unsupported file type (image)', async () => {
    const fakeImage = Buffer.from('GIF89a'); // GIF magic bytes
    const res = await request(httpServer)
      .post(FILES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .attach('file', fakeImage, { filename: 'test.gif', contentType: 'image/gif' })
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 401 without token', async () => {
    const txtContent = Buffer.from('test content');
    const res = await request(httpServer)
      .post(FILES_URL)
      .attach('file', txtContent, { filename: 'test.txt', contentType: 'text/plain' })
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:create)', async () => {
    const txtContent = Buffer.from('test content');
    const res = await request(httpServer)
      .post(FILES_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .attach('file', txtContent, { filename: 'test.txt', contentType: 'text/plain' })
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 201 and file record for super_admin with valid txt file', async () => {
    const txtContent = Buffer.from('Knowledge base content: CareKit clinic services and practitioners.');
    const res = await request(httpServer)
      .post(FILES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .attach('file', txtContent, { filename: 'kb-upload.txt', contentType: 'text/plain' })
      .expect(201);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(typeof data['id']).toBe('string');
    expect(data['status']).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// GET /chatbot/knowledge-base/files — chatbot:view
// ---------------------------------------------------------------------------

describe('GET /chatbot/knowledge-base/files', () => {
  it('returns 200 with paginated files list for super_admin', async () => {
    const res = await request(httpServer)
      .get(FILES_URL)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('meta');
  });

  it('returns 200 with pagination params', async () => {
    const res = await request(httpServer)
      .get(`${FILES_URL}?page=1&perPage=5`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .get(FILES_URL)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:view)', async () => {
    const res = await request(httpServer)
      .get(FILES_URL)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /chatbot/knowledge-base/files/:id/process — chatbot:edit
// ---------------------------------------------------------------------------

describe('POST /chatbot/knowledge-base/files/:id/process', () => {
  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .post(`${FILES_URL}/not-a-uuid/process`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for ghost file UUID (NOT_FOUND)', async () => {
    const res = await request(httpServer)
      .post(`${FILES_URL}/${GHOST_UUID}/process`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .post(`${FILES_URL}/${GHOST_UUID}/process`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:edit)', async () => {
    const res = await request(httpServer)
      .post(`${FILES_URL}/${GHOST_UUID}/process`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  /**
   * If upload succeeded in beforeAll, process triggers embedding generation
   * (OpenRouter call). No API key in test env → processFile catches the error
   * internally and marks file as 'failed', but returns 200 with { processed: true }.
   * The endpoint itself does not throw — the error is handled inside processFile.
   */
  it('returns 200 for uploaded file (process handled internally)', async () => {
    if (!uploadedFileId) {
      // If upload failed (e.g. MinIO not available), skip gracefully
      console.warn('Skipping process test — file upload failed in beforeAll');
      return;
    }

    const res = await request(httpServer)
      .post(`${FILES_URL}/${uploadedFileId}/process`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data['processed']).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /chatbot/knowledge-base/files/:id — chatbot:delete
// ---------------------------------------------------------------------------

describe('DELETE /chatbot/knowledge-base/files/:id', () => {
  it('returns 400 for non-UUID id', async () => {
    const res = await request(httpServer)
      .delete(`${FILES_URL}/not-a-uuid`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(400);

    expect((res.body as Record<string, unknown>).success).toBe(false);
  });

  it('returns 404 for ghost file UUID (NOT_FOUND)', async () => {
    const res = await request(httpServer)
      .delete(`${FILES_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(404);
    expectErrorResponse(res.body as Record<string, unknown>, 'NOT_FOUND');
  });

  it('returns 401 without token', async () => {
    const res = await request(httpServer)
      .delete(`${FILES_URL}/${GHOST_UUID}`)
      .expect(401);
    expectErrorResponse(res.body as Record<string, unknown>, 'AUTH_TOKEN_INVALID');
  });

  it('returns 403 for practitioner (no chatbot:delete)', async () => {
    const res = await request(httpServer)
      .delete(`${FILES_URL}/${GHOST_UUID}`)
      .set(getAuthHeaders(practitionerAuth.accessToken))
      .expect(403);
    expectErrorResponse(res.body as Record<string, unknown>, 'FORBIDDEN');
  });

  it('returns 200 and deletes the uploaded file', async () => {
    if (!uploadedFileId) {
      console.warn('Skipping delete test — file upload failed in beforeAll');
      return;
    }

    const res = await request(httpServer)
      .delete(`${FILES_URL}/${uploadedFileId}`)
      .set(getAuthHeaders(adminAuth.accessToken))
      .expect(200);

    expectSuccessResponse(res.body as Record<string, unknown>);
    const data = (res.body as { data: Record<string, unknown> }).data;
    expect(data['deleted']).toBe(true);
  });
});
