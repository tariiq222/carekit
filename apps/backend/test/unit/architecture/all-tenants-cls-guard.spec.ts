/**
 * Architecture guard: every file outside src/modules/platform/admin/ that
 * calls prisma.$allTenants must also reference SUPER_ADMIN_CONTEXT_CLS_KEY
 * in the same file — either to set it (cls.set) or via import.
 *
 * Static heuristic. Catches the common omission. Does NOT verify ordering
 * at runtime — for that, rely on e2e tests.
 *
 * To exempt a file (only-called-from-already-wrapped-callers), add the
 * relative path from `src/` to ALLOWLIST with a comment explaining why.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../src');
const MODULES_DIR = path.join(SRC_ROOT, 'modules');
const ADMIN_MODULE = path.join(MODULES_DIR, 'platform', 'admin');

const ALLOWLIST: string[] = [
  // downgrade-safety.service.ts — AMBIGUOUS in 2026-05-04 audit matrix.
  // Called only from DowngradePlanHandler (admin HTTP path, fenced by
  // SuperAdminContextInterceptor) and ProcessScheduledPlanChangesCron
  // (wrapped at commit c37d22ef). Both callers establish CLS context
  // before reaching this service, so the bare $allTenants here is safe.
  'modules/platform/billing/downgrade-safety/downgrade-safety.service.ts',
];

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('Architecture guard: $allTenants requires SUPER_ADMIN_CONTEXT_CLS_KEY', () => {
  it('every non-admin file calling $allTenants references the CLS key', () => {
    const files = collectTsFiles(MODULES_DIR);
    const violations: string[] = [];

    for (const file of files) {
      if (file.startsWith(ADMIN_MODULE + path.sep) || file === ADMIN_MODULE) continue;

      const content = fs.readFileSync(file, 'utf-8');
      if (!content.includes('$allTenants.')) continue;

      const relPath = path.relative(SRC_ROOT, file);
      if (ALLOWLIST.some((allowed) => relPath === allowed)) continue;

      if (!content.includes('SUPER_ADMIN_CONTEXT_CLS_KEY')) {
        violations.push(relPath);
      }
    }

    if (violations.length > 0) {
      const msg = [
        '',
        'The following files call prisma.$allTenants without referencing SUPER_ADMIN_CONTEXT_CLS_KEY.',
        'Either:',
        '  (a) Wrap the $allTenants call in cls.run(() => { cls.set(SUPER_ADMIN_CONTEXT_CLS_KEY, true); ... })',
        '  (b) Add the file to ALLOWLIST with a comment explaining the safe caller chain.',
        '',
        ...violations.map((v) => `  - src/${v}`),
        '',
      ].join('\n');
      throw new Error(msg);
    }

    expect(violations).toEqual([]);
  });
});
