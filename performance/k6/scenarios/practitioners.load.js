// ─── Practitioners Load Test ───────────────────────────────────────────────
// Tests public endpoints — no auth required.
// Scenarios: GET /practitioners, /practitioners/:id/slots, /practitioners/:id/ratings
// ENV: K6_PRACTITIONER_ID (default: 1)

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { BASE_URL, defaultThresholds } from '../config.js';

// ─── Custom Metrics ────────────────────────────────────────────────────────
const listDuration    = new Trend('practitioners_list_duration',    true);
const slotsDuration   = new Trend('practitioners_slots_duration',   true);
const ratingsDuration = new Trend('practitioners_ratings_duration', true);

// ─── Options ──────────────────────────────────────────────────────────────
// Higher VU count since these are public endpoints (no DB auth overhead)
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // ramp up
    { duration: '2m',  target: 50 },  // sustain at 50 VU
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    'practitioners_list_duration':    ['p(95)<400'],
    'practitioners_slots_duration':   ['p(95)<400'],
    'practitioners_ratings_duration': ['p(95)<400'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─── Default (VU) Function ────────────────────────────────────────────────
export default function () {
  const practitionerId = __ENV.K6_PRACTITIONER_ID || '1';

  // Build a query date (today + 3 days to ensure future slots exist)
  const queryDate = new Date();
  queryDate.setDate(queryDate.getDate() + 3);
  const dateStr = queryDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // ── Scenario 1: List practitioners (public, paginated) ─────────────────
  group('GET /practitioners', () => {
    const res = http.get(
      `${BASE_URL}/practitioners?page=1&perPage=20`,
      { headers: JSON_HEADERS },
    );

    listDuration.add(res.timings.duration);

    check(res, {
      'practitioners list: status not 5xx': (r) => r.status < 500,
      'practitioners list: has items (200)': (r) => {
        if (r.status !== 200) return true;
        try { return Array.isArray(JSON.parse(r.body).data?.items); } catch { return false; }
      },
      'practitioners list: p95 < 400ms': (r) => r.timings.duration < 400,
    });
  });

  sleep(1);

  // ── Scenario 2: Availability slots for a specific practitioner ─────────
  group('GET /practitioners/:id/slots', () => {
    const res = http.get(
      `${BASE_URL}/practitioners/${practitionerId}/slots?date=${dateStr}`,
      { headers: JSON_HEADERS },
    );

    slotsDuration.add(res.timings.duration);

    check(res, {
      'slots: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(1);

  // ── Scenario 3: Ratings for a specific practitioner ────────────────────
  group('GET /practitioners/:id/ratings', () => {
    const res = http.get(
      `${BASE_URL}/practitioners/${practitionerId}/ratings?page=1&perPage=10`,
      { headers: JSON_HEADERS },
    );

    ratingsDuration.add(res.timings.duration);

    check(res, {
      'ratings: status not 5xx': (r) => r.status < 500,
    });
  });

  sleep(1);
}
