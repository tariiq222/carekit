/**
 * ThrottlerGuard E2E Tests
 *
 * Tests the global Redis-backed rate limiter (ThrottlerModule) with a real 429.
 *
 * ⚠️  Run with the dedicated config — NOT jest-e2e.json:
 *       npx jest --config test/jest-throttle.json
 *
 * Why a separate config?
 *   jest-e2e-setup.ts sets THROTTLE_LIMIT=10000 to protect all other suites
 *   from interfering with each other. THROTTLE_LIMIT is a module-level constant
 *   (read at first import of constants.ts), so it must be overridden in
 *   setupFiles BEFORE any module is loaded. jest-throttle-setup.ts sets
 *   THROTTLE_LIMIT=5, which makes 429 reachable with ~10 sequential requests.
 *
 * Coverage:
 *   - ThrottlerModule + ThrottlerRedisStorage bootstrap (no DI errors)
 *   - Returns 200 for requests within the limit (THROTTLE_LIMIT=5, req 1-5)
 *   - Returns 429 after exceeding the limit (req 6+)
 *   - 429 response body follows { success: false, error: { code, message } }
 *   - 429 response carries x-correlation-id (CorrelationIdMiddleware runs before ThrottlerGuard)
 *   - 429 response carries Helmet security headers
 *   - Subsequent requests after 429 remain throttled (not reset automatically)
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../setup/setup';

const PUBLIC_ENDPOINT = '/api/v1/health';

// THROTTLE_LIMIT=5 (set by jest-throttle-setup.ts before any import)
// Send 8 requests: first 5 should be 200, request 6+ should be 429
const WITHIN_LIMIT = 5;
const BREACH_TOTAL = 8;

describe('ThrottlerGuard — real 429 enforcement (e2e)', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  // Responses captured in beforeAll and reused across tests
  const responses: Array<{
    status: number;
    body: unknown;
    headers: Record<string, string>;
  }> = [];

  beforeAll(async () => {
    // createTestApp() flushes Redis → clean counter slate
    const testApp = await createTestApp();
    app = testApp.app;
    httpServer = testApp.httpServer;

    // Send BREACH_TOTAL sequential requests and capture all statuses
    for (let i = 0; i < BREACH_TOTAL; i++) {
      const res = await request(httpServer).get(PUBLIC_ENDPOINT);
      responses.push({
        status: res.status,
        body: res.body,
        headers: res.headers as Record<string, string>,
      });
    }
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // ── Within limit ──────────────────────────────────────────────────────────

  it(`first ${WITHIN_LIMIT} requests return 200 (within THROTTLE_LIMIT=5)`, () => {
    const withinLimit = responses.slice(0, WITHIN_LIMIT);
    for (const res of withinLimit) {
      expect(res.status).toBe(200);
    }
  });

  // ── Limit breach ──────────────────────────────────────────────────────────

  it(`request #${WITHIN_LIMIT + 1} returns 429 (exceeds THROTTLE_LIMIT=5)`, () => {
    const breachResponse = responses[WITHIN_LIMIT]; // index 5 = request #6
    expect(breachResponse.status).toBe(429);
  });

  it('all requests beyond the limit return 429', () => {
    const beyond = responses.slice(WITHIN_LIMIT);
    for (const res of beyond) {
      expect(res.status).toBe(429);
    }
  });

  // ── Response shape ────────────────────────────────────────────────────────

  it('429 body follows { success: false, error: { code, message } }', () => {
    const first429 = responses.find((r) => r.status === 429);
    expect(first429).toBeDefined();

    const body = first429!.body as Record<string, unknown>;
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');

    const error = body.error as Record<string, unknown>;
    expect(error).toHaveProperty('code');
    expect(typeof error.code).toBe('string');
    expect(error).toHaveProperty('message');
    expect(typeof error.message).toBe('string');
  });

  it('429 error code is RATE_LIMIT_EXCEEDED', () => {
    const first429 = responses.find((r) => r.status === 429);
    const body = first429!.body as Record<string, unknown>;
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  // ── Security headers on 429 ───────────────────────────────────────────────

  it('429 carries x-correlation-id (CorrelationIdMiddleware runs before ThrottlerGuard)', () => {
    const first429 = responses.find((r) => r.status === 429);
    const headers = first429!.headers;

    expect(headers['x-correlation-id']).toBeDefined();
    expect(headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('429 carries Helmet security headers (x-content-type-options, no x-powered-by)', () => {
    const first429 = responses.find((r) => r.status === 429);
    const headers = first429!.headers;

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  // ── Persistence ───────────────────────────────────────────────────────────

  it('subsequent requests after 429 remain throttled within the same TTL window', async () => {
    // Send one more request — should still be 429 (TTL window hasn't expired)
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.status).toBe(429);
  });
});
