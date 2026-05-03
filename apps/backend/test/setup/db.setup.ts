import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import Redis from 'ioredis';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://deqah:deqah_dev_password@127.0.0.1:5999/deqah_test?schema=public';

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

/**
 * Flush all Redis keys so throttler rate-limit counters and org-suspension
 * caches don't bleed between test suites.
 *
 * Used by OTP / mobile-auth test suites that would otherwise hit 429 when
 * the NestJS throttler accumulates request counts across sequential test runs.
 */
export async function flushTestRedis(): Promise<void> {
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT ?? '5380', 10);
  const redis = new Redis({ host, port, lazyConnect: false, enableReadyCheck: true });
  try {
    await redis.flushdb();
  } finally {
    await redis.quit();
  }
}