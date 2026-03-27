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
 *   ❌ X-Powered-By: must be ABSENT (framework fingerprinting)
 *   ❌ Server: must not reveal exact version
 *
 * NOTE: If these tests fail it means Helmet (or equivalent) is not configured.
 * Add `app.use(helmet())` in main.ts and install `helmet` package to fix.
 */

import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import {
  createTestApp,
  closeTestApp,
} from '../setup/setup.js';

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
});
