/**
 * HTTP Security Headers E2E Tests
 *
 * Verifies that every API response carries the required security headers
 * and that unsafe headers are absent.
 *
 * Headers under test:
 *   ✅ X-Content-Type-Options: nosniff
 *   ✅ X-Frame-Options: DENY or SAMEORIGIN
 *   ✅ X-XSS-Protection: 0 (modern recommendation — disable legacy XSS filter)
 *   ✅ Referrer-Policy: strict-origin-when-cross-origin (or stricter)
 *   ✅ Content-Security-Policy: present and non-empty
 *   ✅ Strict-Transport-Security: present (HSTS)
 *   ✅ Permissions-Policy: present
 *   ✅ X-Correlation-ID: present on ALL responses (CorrelationIdMiddleware)
 *   ❌ X-Powered-By: must be ABSENT (framework fingerprinting)
 *   ❌ Server: must not reveal exact version
 *
 * Also covers:
 *   ✅ ThrottlerGuard — 429 response on sustained rapid requests
 *
 * NOTE: If helmet tests fail → add `app.use(helmet())` in main.ts.
 * NOTE: If x-correlation-id tests fail → check CorrelationIdMiddleware registration.
 */

import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../setup/setup.js';

describe('HTTP Security Headers', () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    httpServer = testApp.httpServer;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  // -------------------------------------------------------------------------
  // Helper: pick a stable public endpoint (health check)
  // -------------------------------------------------------------------------
  const PUBLIC_ENDPOINT = '/api/v1/health';

  // -------------------------------------------------------------------------
  // Must-have headers
  // -------------------------------------------------------------------------

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to DENY or SAMEORIGIN', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const value = res.headers['x-frame-options'];
    expect(value).toBeDefined();
    expect(['DENY', 'SAMEORIGIN']).toContain(value?.toUpperCase());
  });

  it('sets X-XSS-Protection: 0 (disables legacy browser XSS filter)', async () => {
    // Modern security recommendation is to disable the legacy XSS filter (0)
    // because it can be exploited. Rely on CSP instead.
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.headers['x-xss-protection']).toBe('0');
  });

  it('sets Referrer-Policy header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const value = res.headers['referrer-policy'];
    expect(value).toBeDefined();
    // Accept any privacy-preserving value
    const acceptable = [
      'no-referrer',
      'strict-origin',
      'strict-origin-when-cross-origin',
      'same-origin',
    ];
    expect(acceptable.some((v) => value?.includes(v))).toBe(true);
  });

  it('sets Content-Security-Policy header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp?.length).toBeGreaterThan(0);
  });

  it('sets Strict-Transport-Security (HSTS) header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const hsts = res.headers['strict-transport-security'];
    expect(hsts).toBeDefined();
    // Must include max-age directive
    expect(hsts).toMatch(/max-age=\d+/);
  });

  it('sets Permissions-Policy header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.headers['permissions-policy']).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Must-NOT-have headers (fingerprinting prevention)
  // -------------------------------------------------------------------------

  it('does NOT expose X-Powered-By header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('does NOT expose exact server version in Server header', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const server = res.headers['server'];
    // If present, must not include version numbers
    if (server) {
      expect(server).not.toMatch(/\d+\.\d+/);
    }
  });

  // -------------------------------------------------------------------------
  // Headers present on error responses too
  // -------------------------------------------------------------------------

  it('security headers are present on 404 responses', async () => {
    const res = await request(httpServer).get('/api/v1/nonexistent-route-xyz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('security headers are present on 401 responses', async () => {
    // Accessing a protected endpoint without token
    const res = await request(httpServer).get('/api/v1/users');
    expect([401, 403]).toContain(res.status);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('security headers are present on 400 validation error responses', async () => {
    const res = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  // -------------------------------------------------------------------------
  // CORS headers
  // -------------------------------------------------------------------------

  it('does not return wildcard Access-Control-Allow-Origin on credentialed requests', async () => {
    const res = await request(httpServer)
      .get(PUBLIC_ENDPOINT)
      .set('Origin', 'https://evil.example.com')
      .set('Cookie', 'token=abc123');

    const acao = res.headers['access-control-allow-origin'];
    // Must not be wildcard when cookies are present
    expect(acao).not.toBe('*');
  });

  // -------------------------------------------------------------------------
  // X-Correlation-ID (CorrelationIdMiddleware)
  // -------------------------------------------------------------------------

  it('x-correlation-id header is present on 200 responses', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    expect(res.headers['x-correlation-id']).toBeDefined();
    expect(typeof res.headers['x-correlation-id']).toBe('string');
    expect(res.headers['x-correlation-id'].length).toBeGreaterThan(0);
  });

  it('x-correlation-id is a valid UUID when client does not send one', async () => {
    const res = await request(httpServer).get(PUBLIC_ENDPOINT);
    const id = res.headers['x-correlation-id'];
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('x-correlation-id echoes back the client-provided value', async () => {
    const clientId = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff';
    const res = await request(httpServer)
      .get(PUBLIC_ENDPOINT)
      .set('x-correlation-id', clientId);
    expect(res.headers['x-correlation-id']).toBe(clientId);
  });

  it('x-correlation-id is present on 401 responses', async () => {
    const res = await request(httpServer).get('/api/v1/users');
    expect([401, 403]).toContain(res.status);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('x-correlation-id is present on 404 responses', async () => {
    const res = await request(httpServer).get('/api/v1/nonexistent-route-xyz');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('correlationId appears in error response body on 4xx', async () => {
    const clientId = 'test1234-1234-1234-1234-test12345678';
    const res = await request(httpServer)
      .get('/api/v1/nonexistent-route-xyz')
      .set('x-correlation-id', clientId);
    const error = res.body.error as Record<string, unknown>;
    expect(error.correlationId).toBe(clientId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ThrottlerGuard — moved to throttler.e2e-spec.ts (see that file)
// Kept here as a smoke-test only: verifies ThrottlerModule is registered
// ─────────────────────────────────────────────────────────────────────────────

describe('ThrottlerGuard — smoke test (e2e)', () => {
  it('ThrottlerModule is loaded: normal request gets 200 not 500', async () => {
    // Uses the already-bootstrapped app from the outer describe block
    // Just verifies the ThrottlerModule did not crash on startup
    const testApp = await createTestApp();
    const res = await request(testApp.httpServer).get('/api/v1/health');
    await closeTestApp(testApp.app);
    // 200 = ThrottlerModule up | 429 = already throttled from other suites (also fine)
    expect([200, 429]).toContain(res.status);
  });
});
