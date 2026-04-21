import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export default async function globalSetup() {
  process.env.TENANT_ENFORCEMENT ??= 'permissive';
  process.env.DEFAULT_ORGANIZATION_ID ??= '00000000-0000-0000-0000-000000000001';

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
}