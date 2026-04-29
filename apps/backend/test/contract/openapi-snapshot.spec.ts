/**
 * OpenAPI snapshot test.
 *
 * Fetches the live spec from the running backend and compares it to the
 * committed openapi.json snapshot. Fails when the spec has drifted —
 * prompting the developer to run `npm run openapi:sync`.
 *
 * Skipped automatically when the backend is not reachable (CI without
 * a running server, unit-test runs). Set OPENAPI_SNAPSHOT_TEST=1 to force.
 *
 * Run (requires backend running on :5100):
 *   OPENAPI_SNAPSHOT_TEST=1 npx jest test/openapi-snapshot.spec.ts
 */
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const SNAPSHOT_PATH = resolve(__dirname, '../../openapi.json');
const API_BASE = process.env.API_URL ?? 'http://localhost:5100';
const SPEC_URL = `${API_BASE}/api/docs-json`;
const FORCE = process.env.OPENAPI_SNAPSHOT_TEST === '1';

describe('OpenAPI snapshot', () => {
  it('openapi.json matches the live Swagger document (run npm run openapi:sync to update)', async () => {
    if (!existsSync(SNAPSHOT_PATH)) {
      console.warn('⚠  openapi.json not found — run `npm run openapi:export` first.');
      return;
    }

    // Check if backend is reachable — skip gracefully if not
    let liveSpec: unknown;
    try {
      const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`${res.status}`);
      liveSpec = await res.json();
    } catch {
      if (!FORCE) {
        console.warn(`⚠  Backend not reachable at ${API_BASE} — skipping snapshot check.`);
        return;
      }
      throw new Error(`Backend must be running on ${API_BASE} (set OPENAPI_SNAPSHOT_TEST=1 forces this check)`);
    }

    const committed = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8')) as unknown;
    expect(liveSpec).toEqual(committed);
  }, 15_000);
});
