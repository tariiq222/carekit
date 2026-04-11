/**
 * Setup file for ThrottlerGuard E2E tests only.
 *
 * Sets THROTTLE_LIMIT=5 BEFORE any module is imported (setupFiles runs first).
 * This makes the ThrottlerRedisStorage enforce a limit of 5 req/min,
 * so tests can trigger 429 with ~10 requests instead of ~10,001.
 *
 * Used exclusively by test/jest-throttle.json.
 * Never import this in the main jest-e2e.json (it would break all other suites).
 */
import 'dotenv/config';

process.env['THROTTLE_LIMIT'] = '5';
