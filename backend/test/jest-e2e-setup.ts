/**
 * Setup file for E2E tests — runs before each test file.
 * Sets env vars needed before NestJS app bootstrap.
 */
import 'dotenv/config';

// Ensure throttle limit is high enough for test suites
// (multiple suites running back-to-back share the same Redis)
process.env['THROTTLE_LIMIT'] = '10000';
