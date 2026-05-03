import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../..');

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? flattenKeys(v as Record<string, unknown>, key) : [key];
  });
}

function loadTranslation(filePath: string): Record<string, unknown> | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

function assertParity(arPath: string, enPath: string, label: string): void {
  const ar = loadTranslation(arPath);
  const en = loadTranslation(enPath);

  if (!ar || !en) {
    throw new Error(`[${label}] translation file missing — ar: ${!!ar}, en: ${!!en}`);
  }

  const arKeys = new Set(flattenKeys(ar));
  const enKeys = new Set(flattenKeys(en));

  const missingInEn = [...arKeys].filter((k) => !enKeys.has(k));
  const missingInAr = [...enKeys].filter((k) => !arKeys.has(k));

  const errors: string[] = [];
  if (missingInEn.length > 0) {
    errors.push(`Keys in AR missing from EN (${missingInEn.length}):\n  ${missingInEn.join('\n  ')}`);
  }
  if (missingInAr.length > 0) {
    errors.push(`Keys in EN missing from AR (${missingInAr.length}):\n  ${missingInAr.join('\n  ')}`);
  }

  if (errors.length > 0) {
    throw new Error(`[${label}] i18n parity failure:\n${errors.join('\n\n')}`);
  }
}

describe('i18n key parity — AR and EN translation files must be in sync', () => {
  it('admin messages: AR and EN have identical key sets', () => {
    const arPath = path.join(REPO_ROOT, 'apps/admin/messages/ar.json');
    const enPath = path.join(REPO_ROOT, 'apps/admin/messages/en.json');
    assertParity(arPath, enPath, 'apps/admin');
  });

  it('mobile i18n: AR and EN have identical key sets', () => {
    const arPath = path.join(REPO_ROOT, 'apps/mobile/i18n/ar.json');
    const enPath = path.join(REPO_ROOT, 'apps/mobile/i18n/en.json');

    if (!fs.existsSync(arPath) || !fs.existsSync(enPath)) {
      console.warn('[i18n-parity] mobile i18n files not found — skipping');
      return;
    }

    assertParity(arPath, enPath, 'apps/mobile');
  });
});
