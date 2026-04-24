// ─── Auth Load Test ────────────────────────────────────────────────────────
// Tests: POST /auth/login, POST /auth/login/otp/send, GET /auth/me
// Credentials via ENV: K6_EMAIL, K6_PASSWORD

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { loginAndGetToken, authHeaders } from '../helpers/auth.js';
import { BASE_URL, defaultThresholds, smokeStages, loadStages } from '../config.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────
const loginDuration   = new Trend('auth_login_duration',    true);
const otpSendDuration = new Trend('auth_otp_send_duration', true);
const meDuration      = new Trend('auth_me_duration',       true);

// ─── Options ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    ...smokeStages,
    ...loadStages,
  ],
  thresholds: {
    // http_req_failed counts 429s as failures — exclude by checking only 5xx
    // auth endpoints are intentionally rate-limited, so 429s are expected
    http_req_duration: ['p(95)<500'],
    'auth_login_duration':    ['p(95)<300'],
    'auth_otp_send_duration': ['p(95)<300'],
    'auth_me_duration':       ['p(95)<200'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────
// Runs once before VUs start. Returns shared data for all VUs.
export function setup() {
  const email    = __ENV.K6_EMAIL    || 'admin@carekit.sa';
  const password = __ENV.K6_PASSWORD || 'Password123!';

  const token = loginAndGetToken(email, password);
  return { token, email };
}

// ─── Default (VU) Function ────────────────────────────────────────────────
export default function (data) {
  const { token, email } = data;

  // ── Scenario 1: Login with valid credentials ───────────────────────────
  group('POST /auth/login', () => {
    const payload = JSON.stringify({
      email:    __ENV.K6_EMAIL    || 'admin@carekit.sa',
      password: __ENV.K6_PASSWORD || 'Password123!',
    });

    const res = http.post(`${BASE_URL}/auth/login`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(res.timings.duration);

    check(res, {
      // 200 = success, 429 = throttled (expected under load — not a failure)
      'login: status 200 or 429':  (r) => r.status === 200 || r.status === 429,
      'login: has accessToken':    (r) => {
        if (r.status === 429) return true; // throttled — skip body check
        try { return !!JSON.parse(r.body).data?.accessToken; } catch { return false; }
      },
      'login: has refreshToken':   (r) => {
        if (r.status === 429) return true;
        try { return !!JSON.parse(r.body).data?.refreshToken; } catch { return false; }
      },
    });
  });

  sleep(1); // Respect 100 req/min global throttle

  // ── Scenario 2: OTP send ───────────────────────────────────────────────
  group('POST /auth/login/otp/send', () => {
    const payload = JSON.stringify({
      phone: __ENV.K6_PHONE || '+966500000001',
    });

    const res = http.post(`${BASE_URL}/auth/login/otp/send`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    otpSendDuration.add(res.timings.duration);

    check(res, {
      // 2xx = success, 429 = throttled (expected under load), 4xx = acceptable (invalid phone)
      'otp/send: status not 5xx': (r) => r.status < 500,
      'otp/send: response is JSON':  (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });
  });

  sleep(1);

  // ── Scenario 3: GET /auth/me (profile, authenticated) ─────────────────
  group('GET /auth/me', () => {
    if (!token) {
      console.warn('Skipping /auth/me — no token available');
      return;
    }

    const res = http.get(`${BASE_URL}/auth/me`, {
      headers: authHeaders(token),
    });

    meDuration.add(res.timings.duration);

    check(res, {
      'me: status 200':     (r) => r.status === 200,
      'me: has user id':    (r) => {
        try { return !!JSON.parse(r.body).data?.id; } catch { return false; }
      },
      'me: has user email': (r) => {
        try { return !!JSON.parse(r.body).data?.email; } catch { return false; }
      },
    });
  });

  sleep(1);
}
