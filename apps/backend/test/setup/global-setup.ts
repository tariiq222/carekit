import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export default async function globalSetup() {
  process.env.TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

  await execFileAsync(
    'npx',
    ['prisma', 'migrate', 'deploy'],
    {
      env: {
        ...process.env,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
      },
      cwd: path.resolve(__dirname, '../..'),
    },
  );
}