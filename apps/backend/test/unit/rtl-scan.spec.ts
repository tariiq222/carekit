import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

// Matches directional Tailwind classes only when preceded by a quote or whitespace
// (i.e., part of a className string), not when used as data values like "pr-1" IDs.
const DIRECTIONAL_PATTERN = /(?:["'\s`])(pl|pr|ml|mr|border-l|border-r|rounded-l|rounded-r|text-left|text-right|float-left|float-right)-/;

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'out', '.turbo', 'test']);

function collectFiles(dir: string, extensions: string[]): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;

      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

interface Violation {
  file: string;
  line: number;
  text: string;
}

function scanForDirectionalClasses(files: string[]): Violation[] {
  const violations: Violation[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('// rtl-ok')) continue;

      const match = DIRECTIONAL_PATTERN.exec(line);
      if (match) {
        violations.push({
          file,
          line: i + 1,
          text: line.trim(),
        });
      }
    }
  }

  return violations;
}

function formatViolations(violations: Violation[], appRoot: string): string {
  return violations
    .map((v) => `${path.relative(appRoot, v.file)}:${v.line}: ${v.text}`)
    .join('\n');
}

describe('RTL layout — no hardcoded directional Tailwind classes', () => {
  it('dashboard components use logical properties only', () => {
    const dashboardDir = path.join(REPO_ROOT, 'apps/dashboard');

    if (!fs.existsSync(dashboardDir)) {
      console.warn('[rtl-scan] apps/dashboard not found — skipping');
      return;
    }

    const files = collectFiles(dashboardDir, ['.tsx', '.ts']);
    const violations = scanForDirectionalClasses(files);

    if (violations.length > 0) {
      throw new Error(
        `[rtl-scan] dashboard has ${violations.length} directional class violation(s).\n` +
          `Use logical properties (ps-, pe-, ms-, me-, border-s, border-e, rounded-s, rounded-e, text-start, text-end) instead.\n\n` +
          formatViolations(violations, dashboardDir),
      );
    }
  });

  it('mobile components use logical properties only', () => {
    const mobileDir = path.join(REPO_ROOT, 'apps/mobile');

    if (!fs.existsSync(mobileDir)) {
      console.warn('[rtl-scan] apps/mobile not found — skipping');
      return;
    }

    const files = collectFiles(mobileDir, ['.tsx', '.ts']);
    const violations = scanForDirectionalClasses(files);

    if (violations.length > 0) {
      throw new Error(
        `[rtl-scan] mobile has ${violations.length} directional class violation(s).\n` +
          `Use logical properties instead.\n\n` +
          formatViolations(violations, mobileDir),
      );
    }
  });
});
