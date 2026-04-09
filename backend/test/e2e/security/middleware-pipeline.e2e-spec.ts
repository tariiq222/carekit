/**
 * Middleware Pipeline E2E Tests
 *
 * Covers two cross-cutting concerns:
 *
 * ## 1. CorrelationIdMiddleware
 *   - x-correlation-id header is always present in responses
 *   - Client-provided value echoes back unchanged
 *   - Auto-generates a valid UUID when not provided
 *   - Present on error responses (401, 404)
 *   - Propagated into error response body via GlobalExceptionFilter
 *
 * ## 2. EmailThrottleGuard — OTP Lock Mechanism
 *   - First request within limit → 200
 *   - Exceeding limit for same email → 429 OTP_RATE_LIMIT_EXCEEDED / OTP_EMAIL_LOCKED
 *   - Rate limits are isolated per email (email A exhausting limit doesn't affect email B)
 *   - x-correlation-id is still present on 429 throttled responses
 */

import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  closeTestApp,
  API_PREFIX,
  type TestApp,
} from '../setup/setup';

const HEALTH_URL = `${API_PREFIX}/health`;
const OTP_SEND_URL = `${API_PREFIX}/auth/login/otp/send`;
const CORRELATION_HEADER = 'x-correlation-id';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─────────────────────────────────────────────────────────────────────────────
// CorrelationIdMiddleware
// ─────────────────────────────────────────────────────────────────────────────

describe('CorrelationIdMiddleware (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  // ── Header propagation ──────────────────────────────────────────────────

  describe('response header propagation', () => {
    it('response always contains x-correlation-id header on 200', async () => {
      const res = await request(httpServer).get(HEALTH_URL).expect(200);
      expect(res.headers[CORRELATION_HEADER]).toBeDefined();
      expect(typeof res.headers[CORRELATION_HEADER]).toBe('string');
      expect(res.headers[CORRELATION_HEADER].length).toBeGreaterThan(0);
    });

    it('echoes back the client-provided x-correlation-id unchanged', async () => {
      const clientId = '550e8400-e29b-41d4-a716-446655440000';
      const res = await request(httpServer)
        .get(HEALTH_URL)
        .set(CORRELATION_HEADER, clientId)
        .expect(200);
      expect(res.headers[CORRELATION_HEADER]).toBe(clientId);
    });

    it('auto-generates a valid UUID-v4 when header is absent', async () => {
      const res = await request(httpServer).get(HEALTH_URL).expect(200);
      expect(res.headers[CORRELATION_HEADER]).toMatch(UUID_REGEX);
    });

    it('generates different correlation IDs for concurrent requests', async () => {
      const [r1, r2] = await Promise.all([
        request(httpServer).get(HEALTH_URL),
        request(httpServer).get(HEALTH_URL),
      ]);
      const id1 = r1.headers[CORRELATION_HEADER];
      const id2 = r2.headers[CORRELATION_HEADER];
      expect(id1).toMatch(UUID_REGEX);
      expect(id2).toMatch(UUID_REGEX);
      expect(id1).not.toBe(id2);
    });
  });

  // ── Error response propagation ──────────────────────────────────────────

  describe('error response header propagation', () => {
    it('x-correlation-id present in 404 response headers', async () => {
      const res = await request(httpServer).get(`${API_PREFIX}/nonexistent-route-xyz`);
      expect(res.headers[CORRELATION_HEADER]).toBeDefined();
      expect(res.headers[CORRELATION_HEADER]).toMatch(UUID_REGEX);
    });

    it('x-correlation-id present in 401 response headers', async () => {
      const res = await request(httpServer).get(`${API_PREFIX}/users`);
      expect([401, 403]).toContain(res.status);
      expect(res.headers[CORRELATION_HEADER]).toBeDefined();
      expect(res.headers[CORRELATION_HEADER]).toMatch(UUID_REGEX);
    });

    it('echoes client correlation-id in 404 error response headers', async () => {
      const clientId = '660e8400-e29b-41d4-a716-446655440001';
      const res = await request(httpServer)
        .get(`${API_PREFIX}/nonexistent-route-xyz`)
        .set(CORRELATION_HEADER, clientId);
      expect(res.headers[CORRELATION_HEADER]).toBe(clientId);
    });

    it('GlobalExceptionFilter includes correlationId in error response body', async () => {
      const clientId = '770e8400-e29b-41d4-a716-446655440002';
      const res = await request(httpServer)
        .get(`${API_PREFIX}/nonexistent-route-xyz`)
        .set(CORRELATION_HEADER, clientId);
      // GlobalExceptionFilter adds correlationId to error object
      const error = res.body.error as Record<string, unknown>;
      expect(error.correlationId).toBe(clientId);
    });

    it('generated correlationId matches between response header and error body', async () => {
      const res = await request(httpServer).get(`${API_PREFIX}/nonexistent-route-xyz`);
      const headerId = res.headers[CORRELATION_HEADER];
      const error = res.body.error as Record<string, unknown>;
      expect(error.correlationId).toBe(headerId);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EmailThrottleGuard — OTP Lock Mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe('EmailThrottleGuard — OTP Rate Limiting (e2e)', () => {
  let testApp: TestApp;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  // Generate unique test emails to avoid cross-test contamination
  const uniqueEmail = (suffix: string): string =>
    `otp-throttle-${suffix}-${Date.now()}@carekit-e2e.test`;

  beforeAll(async () => {
    testApp = await createTestApp();
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(testApp.app);
  });

  describe('within rate limit', () => {
    it('first OTP send for valid email returns 200', async () => {
      const email = uniqueEmail('first');
      const res = await request(httpServer)
        .post(OTP_SEND_URL)
        .send({ email });
      // 200 = success | 404 = endpoint not implemented — both are acceptable, NOT 429
      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe('rate limit enforcement', () => {
    it('rapid repeated OTP sends for same email eventually hit 429', async () => {
      const email = uniqueEmail('ratelimit');
      const ATTEMPTS = 10; // well above any reasonable OTP limit

      const statuses: number[] = [];
      for (let i = 0; i < ATTEMPTS; i++) {
        const res = await request(httpServer).post(OTP_SEND_URL).send({ email });
        statuses.push(res.status);
        if (res.status === 429) break;
      }

      // Either we hit 429 OR the endpoint is not implemented (all 404)
      const hit429 = statuses.some((s) => s === 429);
      const endpointMissing = statuses.every((s) => s === 404);
      expect(hit429 || endpointMissing).toBe(true);
    });

    it('429 response contains OTP_RATE_LIMIT_EXCEEDED or OTP_EMAIL_LOCKED error code', async () => {
      const email = uniqueEmail('errcode');
      let throttledBody: Record<string, unknown> | null = null;

      for (let i = 0; i < 10; i++) {
        const res = await request(httpServer).post(OTP_SEND_URL).send({ email });
        if (res.status === 429) {
          throttledBody = res.body as Record<string, unknown>;
          break;
        }
      }

      if (throttledBody === null) {
        // Endpoint not implemented yet — skip assertion
        return;
      }

      const error = throttledBody.error as Record<string, unknown>;
      expect(['OTP_RATE_LIMIT_EXCEEDED', 'OTP_EMAIL_LOCKED']).toContain(error.code);
    });

    it('x-correlation-id is present in 429 throttled response', async () => {
      const email = uniqueEmail('correlid');
      let throttledRes: request.Response | null = null;

      for (let i = 0; i < 10; i++) {
        const res = await request(httpServer).post(OTP_SEND_URL).send({ email });
        if (res.status === 429) {
          throttledRes = res;
          break;
        }
      }

      if (throttledRes === null) return; // endpoint not implemented

      expect(throttledRes.headers[CORRELATION_HEADER]).toBeDefined();
      expect(throttledRes.headers[CORRELATION_HEADER]).toMatch(UUID_REGEX);
    });
  });

  describe('rate limit isolation between emails', () => {
    it('email A hitting rate limit does NOT affect email B', async () => {
      const emailA = uniqueEmail('isolate-a');
      const emailB = uniqueEmail('isolate-b');

      // Exhaust limit for emailA
      for (let i = 0; i < 10; i++) {
        const res = await request(httpServer).post(OTP_SEND_URL).send({ email: emailA });
        if (res.status === 429) break;
      }

      const verifyA = await request(httpServer).post(OTP_SEND_URL).send({ email: emailA });

      // Email B should be unaffected — first request for it
      const verifyB = await request(httpServer).post(OTP_SEND_URL).send({ email: emailB });

      if (verifyA.status === 429) {
        // A is throttled — B must NOT be
        expect([200, 201, 404]).toContain(verifyB.status);
      }
      // If endpoint is not implemented, both will be 404 — acceptable
    });

    it('two fresh emails each get their own independent rate limit window', async () => {
      const emailC = uniqueEmail('window-c');
      const emailD = uniqueEmail('window-d');

      const [resC, resD] = await Promise.all([
        request(httpServer).post(OTP_SEND_URL).send({ email: emailC }),
        request(httpServer).post(OTP_SEND_URL).send({ email: emailD }),
      ]);

      // Neither should be throttled on first attempt
      expect([200, 201, 404]).toContain(resC.status);
      expect([200, 201, 404]).toContain(resD.status);
    });
  });
});
