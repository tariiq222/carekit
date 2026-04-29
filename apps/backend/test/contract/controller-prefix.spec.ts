/**
 * Controller-prefix contract test.
 *
 * Regression guard for the route double-prefix bug fixed on
 * `fix/route-double-prefix` (2026-04-29):
 *
 *   main.ts calls `app.setGlobalPrefix('api/v1')`. Prior to the fix, two
 *   controllers also baked `api/v1/...` into their @Controller path,
 *   exposing routes only at `/api/v1/api/v1/mobile/auth/*` and
 *   `/api/v1/api/v1/public/verify-email`. The mobile client's axios
 *   baseURL also ended in `/api/v1`, and four call sites prepended
 *   `/api/v1/...` again — so login / OTP / email-verify happened to
 *   line up by accident. Fixing only one half would have 404'd the
 *   whole flow.
 *
 *   Lock the convention: NO @Controller path may start with 'api/v1'.
 *   The global prefix is the only place that's allowed to set it.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const API_DIR = resolve(__dirname, '../../src/api');

function walkControllers(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkControllers(full, out);
    } else if (full.endsWith('.controller.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('@Controller path convention', () => {
  const files = walkControllers(API_DIR);

  it('finds controllers to scan (sanity)', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.replace(API_DIR + '/', '')]))(
    'no @Controller in %s starts with "api/v1"',
    (relative) => {
      const full = join(API_DIR, relative);
      const source = readFileSync(full, 'utf8');

      // Capture the path argument of @Controller('...') / @Controller("...")
      // Skip array form @Controller(['a', 'b']) — none of our controllers
      // use it today. If/when one does, extend this matcher.
      const matches = source.matchAll(/@Controller\(\s*['"]([^'"]*)['"]/g);

      for (const m of matches) {
        const path = m[1];
        expect(path).not.toMatch(/^\/?api\/v1(\/|$)/);
      }
    },
  );
});
