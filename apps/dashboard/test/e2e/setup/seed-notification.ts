/**
 * Notification seed helpers for Playwright — writes directly to Postgres via pg,
 * no test-only endpoint and no production route changes.
 * Requires DATABASE_URL (or TEST_DATABASE_URL) in the environment.
 */
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';

const DATABASE_URL =
  process.env['DATABASE_URL'] ??
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://carekit:carekit_dev_password@127.0.0.1:5432/carekit_dev?schema=public';
const TENANT_ID =
  process.env['NEXT_PUBLIC_TENANT_ID'] ?? 'b46accb4-dd8a-4f34-a2fd-1bac26119e1c';
const ADMIN_EMAIL = process.env['TEST_ADMIN_EMAIL'] ?? 'admin@carekit-test.com';

let pool: Pool | null = null;
let cachedUserId: string | null = null;

function getPool(): Pool {
  if (!pool) pool = new Pool({ connectionString: DATABASE_URL });
  return pool;
}

async function resolveAdminUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const { rows } = await getPool().query<{ id: string }>(
    'SELECT id FROM "User" WHERE "tenantId" = $1 AND email = $2 LIMIT 1',
    [TENANT_ID, ADMIN_EMAIL],
  );
  if (rows.length === 0) {
    throw new Error(
      `Admin user not found for tenant ${TENANT_ID} email ${ADMIN_EMAIL}. ` +
        `Ensure the dashboard dev DB is seeded before running Playwright.`,
    );
  }
  cachedUserId = rows[0].id;
  return cachedUserId;
}

export interface SeededNotification {
  id: string;
  title: string;
}

export async function seedNotification(
  overrides: Partial<{ title: string; body: string }> = {},
): Promise<SeededNotification> {
  const userId = await resolveAdminUserId();
  const id = randomUUID();
  const title = overrides.title ?? `E2E notification ${Date.now()}`;
  const body = overrides.body ?? 'E2E body';
  await getPool().query(
    `INSERT INTO "Notification"
       (id, "tenantId", "recipientId", "recipientType", type, title, body, "isRead", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'EMPLOYEE'::"RecipientType", 'BOOKING_REMINDER'::"NotificationType", $4, $5, false, now(), now())`,
    [id, TENANT_ID, userId, title, body],
  );
  return { id, title };
}

export async function clearNotifications(): Promise<void> {
  const userId = await resolveAdminUserId();
  await getPool().query(
    'DELETE FROM "Notification" WHERE "tenantId" = $1 AND "recipientId" = $2',
    [TENANT_ID, userId],
  );
}

export async function closeSeedPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
