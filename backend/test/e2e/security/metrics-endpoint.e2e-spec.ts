/**
 * Metrics Endpoint E2E Tests
 *
 * Verifies MetricsAuthGuard behavior on GET /api/v1/metrics:
 *   - No token configured → 401 METRICS_NOT_CONFIGURED
 *   - Wrong token → 401 METRICS_UNAUTHORIZED
 *   - Correct token → 200 Prometheus text format
 *   - Endpoint is @Public() (no JWT required) — MetricsAuthGuard is the only gatekeeper
 *
 * Note: Each group bootstraps its own app instance because METRICS_TOKEN is
 * read at module initialisation via ConfigService, so it must be set before createTestApp().
 */

import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { createTestApp, closeTestApp } from '../setup/setup';

const METRICS_PATH = '/api/v1/metrics';

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: No METRICS_TOKEN configured (or wrong token)
// ─────────────────────────────────────────────────────────────────────────────

describe('Metrics Endpoint — no/wrong auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env['METRICS_TOKEN'];
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('returns 401 without Authorization header', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('returns 401 with wrong Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', 'Bearer completely-wrong-token');
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });

  it('response body follows standard error shape', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: expect.stringMatching(/^METRICS_(NOT_CONFIGURED|UNAUTHORIZED)$/),
        message: expect.any(String),
      },
    });
  });

  it('error code is METRICS_NOT_CONFIGURED when env var not set', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.body.error.code).toBe('METRICS_NOT_CONFIGURED');
  });

  it('helmet is active — x-powered-by header is absent', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('x-content-type-options is present on 401 response', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Valid METRICS_TOKEN — successful access
// ─────────────────────────────────────────────────────────────────────────────

describe('Metrics Endpoint — valid auth (e2e)', () => {
  let app: INestApplication;
  const VALID_TOKEN = 'e2e-metrics-secret-token';

  beforeAll(async () => {
    process.env['METRICS_TOKEN'] = VALID_TOKEN;
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await closeTestApp(app);
    delete process.env['METRICS_TOKEN'];
  });

  it('returns 200 with correct Bearer token', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.status).toBe(HttpStatus.OK);
  });

  it('Content-Type is text/plain', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.headers['content-type']).toContain('text/plain');
  });

  it('response body contains # HELP http_requests_total', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.text).toContain('# HELP http_requests_total');
  });

  it('response body contains http_request_duration_seconds', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(res.text).toContain('http_request_duration_seconds');
  });

  it('response body is a non-empty Prometheus text string', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', `Bearer ${VALID_TOKEN}`);
    expect(typeof res.text).toBe('string');
    expect(res.text.length).toBeGreaterThan(50);
  });

  it('wrong token is rejected even when METRICS_TOKEN is configured', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', 'Bearer wrong-token-still');
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.body.error.code).toBe('METRICS_UNAUTHORIZED');
  });

  it('token without Bearer prefix is rejected', async () => {
    const res = await request(app.getHttpServer())
      .get(METRICS_PATH)
      .set('Authorization', VALID_TOKEN); // missing "Bearer "
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: @Public() — JwtAuthGuard is bypassed, MetricsAuthGuard is the only gatekeeper
// ─────────────────────────────────────────────────────────────────────────────

describe('Metrics Endpoint — @Public() access pattern (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    delete process.env['METRICS_TOKEN'];
    app = (await createTestApp()).app;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('returns 401 (not 403) — MetricsAuthGuard blocks, not PermissionsGuard', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(res.status).not.toBe(HttpStatus.FORBIDDEN);
  });

  it('error code is METRICS_NOT_CONFIGURED (MetricsAuthGuard), not AUTH_TOKEN_INVALID (JwtAuthGuard)', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.body.error.code).toBe('METRICS_NOT_CONFIGURED');
    expect(res.body.error.code).not.toBe('AUTH_TOKEN_INVALID');
  });

  it('x-correlation-id is present even on blocked requests', async () => {
    const res = await request(app.getHttpServer()).get(METRICS_PATH);
    expect(res.headers['x-correlation-id']).toBeDefined();
  });
});
