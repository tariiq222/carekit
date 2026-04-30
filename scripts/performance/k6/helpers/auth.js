// ─── Auth Helper ───────────────────────────────────────────────────────────
// Provides login utility and header builder for authenticated k6 scenarios.

import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from '../config.js';

/**
 * Logs in with email/password and returns the JWT access token.
 * Call this inside setup() so the token is shared across VUs.
 *
 * @param {string} email
 * @param {string} password
 * @returns {string} access token
 */
export function loginAndGetToken(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const ok = check(res, {
    'setup: login status 200': (r) => r.status === 200,
    'setup: has access token': (r) => {
      try {
        const body = JSON.parse(r.body);
        // Deqah wraps responses: { success, data: { accessToken } }
        return !!(body.data && body.data.accessToken);
      } catch {
        return false;
      }
    },
  });

  if (!ok) {
    console.error(`Login failed (${res.status}): ${res.body}`);
    // Return empty string — scenarios will fail gracefully on 401s
    return '';
  }

  return JSON.parse(res.body).data.accessToken;
}

/**
 * Returns Authorization + Content-Type headers for a given JWT.
 *
 * @param {string} token - JWT access token
 * @returns {Object} headers
 */
export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Extracts the accessToken from a login response body string.
 * Utility for inline use inside VU code (not setup).
 *
 * @param {string} body - raw response body
 * @returns {string|null}
 */
export function extractToken(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed.data?.accessToken ?? null;
  } catch {
    return null;
  }
}
