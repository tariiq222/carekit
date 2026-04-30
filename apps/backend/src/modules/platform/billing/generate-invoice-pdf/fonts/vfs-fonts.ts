import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// __dirname points to dist/ in compiled mode; resolve fonts from src/ via
// PROJECT_ROOT env (set by NestJS scripts) or fall back to CWD.
const FONTS_SRC = join(
  process.env['PROJECT_ROOT'] ?? process.cwd(),
  'src/modules/platform/billing/generate-invoice-pdf/fonts',
);
const here = require('node:fs').existsSync(join(FONTS_SRC, 'IBMPlexSansArabic-Regular.ttf'))
  ? FONTS_SRC
  : __dirname;

/**
 * Phase 7 — IBM Plex Sans Arabic font files (OFL) embedded as base64 in the
 * pdfmake virtual file system. Read once at module init; pdfmake/pdfkit then
 * subsets each rendered document.
 */
export const vfs: Record<string, string> = {
  'IBMPlexSansArabic-Regular.ttf': readFileSync(
    join(here, 'IBMPlexSansArabic-Regular.ttf'),
  ).toString('base64'),
  'IBMPlexSansArabic-Bold.ttf': readFileSync(
    join(here, 'IBMPlexSansArabic-Bold.ttf'),
  ).toString('base64'),
};

export const fonts = {
  IBMPlex: {
    normal: 'IBMPlexSansArabic-Regular.ttf',
    bold: 'IBMPlexSansArabic-Bold.ttf',
    // IBM Plex Sans Arabic does not ship an italic — fall back to regular /
    // bold so pdfmake does not throw if a node requests italic styling.
    italics: 'IBMPlexSansArabic-Regular.ttf',
    bolditalics: 'IBMPlexSansArabic-Bold.ttf',
  },
};
