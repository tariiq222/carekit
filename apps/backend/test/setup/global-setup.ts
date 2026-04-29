import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

export default async function globalSetup() {
  process.env.TENANT_ENFORCEMENT ??= 'permissive';
  process.env.DEFAULT_ORGANIZATION_ID ??= DEFAULT_ORG_ID;

  process.env.TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

  const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  await execFileAsync(
    npxBin,
    ['prisma', 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      },
      cwd: path.resolve(__dirname, '../..'),
      shell: process.platform === 'win32',
    },
  );

  // Default Organization row is seeded by migration 20260421112047, but some
  // suites TRUNCATE Organization (or its children with CASCADE) and don't
  // restore it — leaving the next run with a missing FK target. Reassert
  // here on every Jest startup so suites that don't go through createTestApp
  // (e.g. raw-handler e2e specs in finance/) still see a known-good row.
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  try {
    await pool.query(
      `INSERT INTO "Organization" (id, slug, "nameAr", "nameEn", status, "createdAt", "updatedAt")
       VALUES ($1, 'default', 'Default', 'Default', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_ORG_ID],
    );
  } finally {
    await pool.end();
  }
}