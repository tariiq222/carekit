// ─── Bookings Load Test ────────────────────────────────────────────────────
// Tests: GET /bookings, GET /bookings/today, GET /bookings/stats, POST /bookings
// Requires auth: K6_EMAIL, K6_PASSWORD
// Optional: K6_PRACTITIONER_ID, K6_SERVICE_ID, K6_PATIENT_ID

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { loginAndGetToken, authHeaders } from '../helpers/auth.js';
import { BASE_URL, defaultThresholds } from '../config.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────
const listDuration   = new Trend('bookings_list_duration',   true);
const todayDuration  = new Trend('bookings_today_duration',  true);
const statsDuration  = new Trend('bookings_stats_duration',  true);
const createDuration = new Trend('bookings_create_duration', true);

// ─── Options ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '3m',  target: 20 },  // sustain at 20 VU
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    'bookings_list_duration':   ['p(95)<500'],
    'bookings_today_duration':  ['p(95)<500'],
    'bookings_stats_duration':  ['p(95)<600'],
    'bookings_create_duration': ['p(95)<800'],
  },
};

// ─── Setup ────────────────────────────────────────────────────────────────
export function setup() {
  const email    = __ENV.K6_EMAIL    || 'admin@deqah.sa';
  const password = __ENV.K6_PASSWORD || 'Password123!';
  const token    = loginAndGetToken(email, password);

  return {
    token,
    practitionerId: __ENV.K6_PRACTITIONER_ID || '1',
    serviceId:      __ENV.K6_SERVICE_ID      || '1',
    patientId:      __ENV.K6_PATIENT_ID      || '1',
  };
}

// ─── Default (VU) Function ────────────────────────────────────────────────
export default function (data) {
  const { token, practitionerId, serviceId, patientId } = data;
  const headers = authHeaders(token);

  // ── Scenario 1: List bookings (paginated) ─────────────────────────────
  group('GET /bookings', () => {
    const res = http.get(`${BASE_URL}/bookings?page=1&perPage=20`, { headers });

    listDuration.add(res.timings.duration);

    check(res, {
      'bookings list: status not 5xx': (r) => r.status < 500,
      'bookings list: has items (200)': (r) => {
        if (r.status !== 200) return true;
        try { return Array.isArray(JSON.parse(r.body).data?.items); } catch { return false; }
      },
    });
  });

  sleep(1);

  // ── Scenario 2: Today's bookings (practitioner view) ──────────────────
  group('GET /bookings/today', () => {
    const res = http.get(`${BASE_URL}/bookings/today`, { headers });

    todayDuration.add(res.timings.duration);

    check(res, {
      'bookings today: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(1);

  // ── Scenario 3: Booking stats (admin view) ────────────────────────────
  group('GET /bookings/stats', () => {
    const res = http.get(`${BASE_URL}/bookings/stats`, { headers });

    statsDuration.add(res.timings.duration);

    check(res, {
      'bookings stats: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(1);

  // ── Scenario 4: Create booking (realistic payload) ────────────────────
  group('POST /bookings', () => {
    // Use a future date to avoid conflicts with existing bookings
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD

    const payload = JSON.stringify({
      practitionerId,
      serviceId,
      patientId,
      date:      dateStr,
      startTime: '10:00',
      notes:     'k6 load test booking — safe to ignore',
    });

    const res = http.post(`${BASE_URL}/bookings`, payload, { headers });

    createDuration.add(res.timings.duration);

    check(res, {
      // any non-5xx is acceptable: 201=created, 409=conflict, 422=validation, 403=permission, 429=throttle
      'bookings create: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(2); // Extra sleep after write — respect rate limits
}
