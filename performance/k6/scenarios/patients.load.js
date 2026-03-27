// ─── Patients Load Test ────────────────────────────────────────────────────
// Tests: GET /patients, GET /patients/:id, GET /patients/:id/stats
// Requires auth: K6_EMAIL, K6_PASSWORD
// Optional: K6_PATIENT_ID (default: 1)

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { loginAndGetToken, authHeaders } from '../helpers/auth.js';
import { BASE_URL, defaultThresholds } from '../config.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────
const listDuration   = new Trend('patients_list_duration',   true);
const detailDuration = new Trend('patients_detail_duration', true);
const statsDuration  = new Trend('patients_stats_duration',  true);

// ─── Options ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 8  },  // ramp up
    { duration: '2m',  target: 15 },  // sustain at 15 VU
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    'patients_list_duration':   ['p(95)<500'],
    'patients_detail_duration': ['p(95)<400'],
    'patients_stats_duration':  ['p(95)<500'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────
export function setup() {
  const email    = __ENV.K6_EMAIL    || 'admin@carekit.sa';
  const password = __ENV.K6_PASSWORD || 'Password123!';
  const token    = loginAndGetToken(email, password);

  // Fetch a real patient UUID from the API (falls back to ENV if provided)
  let patientId = __ENV.K6_PATIENT_ID || null;
  if (!patientId && token) {
    const res = http.get(`${BASE_URL}/patients?perPage=1`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    try {
      const body = JSON.parse(res.body);
      patientId = body.data?.items?.[0]?.id || null;
    } catch { /* ignore */ }
  }

  return { token, patientId };
}

// ─── Default (VU) Function ────────────────────────────────────────────────
export default function (data) {
  const { token, patientId } = data;
  const headers = authHeaders(token);

  // ── Scenario 1: List patients with pagination and search ───────────────
  group('GET /patients', () => {
    // Rotate through common search terms to simulate realistic usage
    const searchTerms = ['أحمد', 'محمد', 'سارة', 'فاطمة', ''];
    const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    const query = term
      ? `?page=1&perPage=20&search=${encodeURIComponent(term)}`
      : '?page=1&perPage=20';

    const res = http.get(`${BASE_URL}/patients${query}`, { headers });

    listDuration.add(res.timings.duration);

    check(res, {
      // 200 = data returned, 429 = throttled (acceptable under load)
      'patients list: status 200 or 429': (r) => r.status === 200 || r.status === 429,
      'patients list: has items': (r) => {
        if (r.status !== 200) return true;
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data?.items);
        } catch { return false; }
      },
    });
  });

  sleep(1);

  // ── Scenario 2: Get individual patient record ──────────────────────────
  group('GET /patients/:id', () => {
    const res = http.get(`${BASE_URL}/patients/${patientId}`, { headers });

    detailDuration.add(res.timings.duration);

    check(res, {
      'patient detail: status not 5xx': (r) => r.status < 500,
      'patient detail: has id (200)': (r) => {
        if (r.status !== 200) return true;
        try { return !!JSON.parse(r.body).data?.id; } catch { return false; }
      },
    });
  });

  sleep(1);

  // ── Scenario 3: Patient statistics (booking history summary) ──────────
  group('GET /patients/:id/stats', () => {
    const res = http.get(`${BASE_URL}/patients/${patientId}/stats`, { headers });

    statsDuration.add(res.timings.duration);

    check(res, {
      'patient stats: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(1);
}
