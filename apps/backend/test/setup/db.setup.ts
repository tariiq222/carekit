import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5999/carekit_test?schema=public';

const pool = new Pool({ connectionString: TEST_DB_URL });

export const testPrisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

export async function cleanTables(tables: string[]): Promise<void> {
  const tableList = tables.map((t) => `"${t}"`).join(', ');
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

export async function closePrisma(): Promise<void> {
  await testPrisma.$disconnect();
  await pool.end();
}