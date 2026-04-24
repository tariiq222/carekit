// ─── CareKit k6 Shared Configuration ──────────────────────────────────────
// Port 5000 is reserved exclusively for CareKit backend (see project_ports.md)

export const BASE_URL = 'http://localhost:5100/api/v1';

// ─── Thresholds ────────────────────────────────────────────────────────────
// Global defaults — individual scenarios may tighten these
export const defaultThresholds = {
  // 95th percentile response time under 500ms
  http_req_duration: ['p(95)<500'],
  // Less than 1% of requests should fail
  http_req_failed: ['rate<0.01'],
};

// ─── Stage Configs ─────────────────────────────────────────────────────────
// smoke: sanity check — 1 VU, 30s
export const smokeStages = [
  { duration: '30s', target: 1 },
];

// load: normal expected traffic — ramp up, sustain, ramp down
export const loadStages = [
  { duration: '30s', target: 10 },  // ramp up
  { duration: '2m',  target: 10 },  // sustain
  { duration: '30s', target: 0  },  // ramp down
];

// stress: above normal — find the breaking point
export const stressStages = [
  { duration: '30s', target: 20 },
  { duration: '1m',  target: 50 },
  { duration: '30s', target: 0  },
];

// spike: sudden burst — simulate viral traffic or DDoS probe
export const spikeStages = [
  { duration: '10s', target: 100 }, // instant spike
  { duration: '30s', target: 100 }, // sustain spike
  { duration: '10s', target: 0   }, // drop off
];

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Returns Authorization headers for authenticated requests.
 * @param {string} token - JWT access token
 * @returns {Object} headers object
 */
export function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Returns JSON content-type headers (unauthenticated).
 */
export function getJsonHeaders() {
  return {
    'Content-Type': 'application/json',
  };
}

/**
 * Builds a full URL from a path segment.
 * @param {string} path - e.g. '/auth/login'
 */
export function url(path) {
  return `${BASE_URL}${path}`;
}
