import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as net from 'net';
import { Pool } from 'pg';

const execFileAsync = promisify(execFile);

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';
const JEDDAH_ORG_ID = '11111111-1111-4111-8111-111111111111';
const SUPER_ADMIN_USER_ID = 'user-super-admin-e2e';
const JEDDAH_OWNER_USER_ID = 'user-jeddah-owner-e2e';

/**
 * Probes a TCP port with a 2-second timeout.
 * Resolves true if connectable, false otherwise.
 * Uses only Node built-ins (net) — no new npm deps.
 */
function probeTcpPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 2000);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export default async function globalSetup() {
  process.env.TENANT_ENFORCEMENT ??= 'permissive';
  process.env.DEFAULT_ORGANIZATION_ID ??= DEFAULT_ORG_ID;
  process.env.EMAIL_PROVIDER_ENCRYPTION_KEY ??= Buffer.alloc(32, 4).toString('base64');

  process.env.TEST_DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    'postgresql://deqah:deqah_dev_password@127.0.0.1:5999/deqah_test?schema=public';

  // --- Infra probes (warn-only, never throw) ---
  const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
  const redisPort = parseInt(process.env.REDIS_PORT ?? '5380', 10);
  const redisOk = await probeTcpPort(redisHost, redisPort);
  if (!redisOk) {
    console.warn(
      `[e2e] Redis unreachable at ${redisHost}:${redisPort} — OTP suites will fail. Start with: npm run docker:up`,
    );
  }

  const minioHost = process.env.MINIO_ENDPOINT ?? 'localhost';
  const minioPort = parseInt(process.env.MINIO_PORT ?? '9000', 10);
  const minioOk = await probeTcpPort(minioHost, minioPort);
  if (!minioOk) {
    console.warn(
      `[e2e] MinIO unreachable at ${minioHost}:${minioPort} — upload suites will fail. Start with: npm run docker:up`,
    );
  }

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

    // Backfill Memberships for any non-CLIENT staff users that were created by
    // test suites after the SaaS-01 migration ran. Mirrors the logic in
    // 20260421112140_saas01_backfill_memberships/migration.sql.
    // Idempotent — ON CONFLICT DO NOTHING on (userId, organizationId) unique.
    await pool.query(
      `INSERT INTO "Membership" (id, "userId", "organizationId", role, "isActive", "acceptedAt", "createdAt", "updatedAt")
       SELECT
         gen_random_uuid(),
         u.id,
         $1,
         CASE u.role::text
           WHEN 'SUPER_ADMIN'  THEN 'OWNER'::"MembershipRole"
           WHEN 'ADMIN'        THEN 'ADMIN'::"MembershipRole"
           WHEN 'RECEPTIONIST' THEN 'RECEPTIONIST'::"MembershipRole"
           WHEN 'ACCOUNTANT'   THEN 'ACCOUNTANT'::"MembershipRole"
           WHEN 'EMPLOYEE'     THEN 'EMPLOYEE'::"MembershipRole"
           ELSE 'RECEPTIONIST'::"MembershipRole"
         END,
         TRUE,
         u."createdAt",
         NOW(),
         NOW()
       FROM "User" u
       WHERE u.role::text <> 'CLIENT'
         AND NOT EXISTS (
           SELECT 1 FROM "Membership" m
           WHERE m."userId" = u.id AND m."organizationId" = $1
         )`,
      [DEFAULT_ORG_ID],
    );

    // ── Jeddah org fixtures (required by feature-gate-uses-jwt-org.e2e-spec.ts) ──
    // Jeddah org on BASIC plan: used to verify FeatureGuard reads JWT org, not CLS fallback.
    // coupons is false on BASIC — the test expects 403 on GET /dashboard/finance/coupons.
    await pool.query(
      `INSERT INTO "Organization" (id, slug, "nameAr", "nameEn", status, "createdAt", "updatedAt")
       VALUES ($1, 'jeddah-test', 'منظمة جدة للاختبار', 'Jeddah Test Org', 'ACTIVE', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [JEDDAH_ORG_ID],
    );

    // Super-admin user required by Case 2 (impersonation shadow JWT).
    await pool.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "isSuperAdmin", "isActive", "createdAt", "updatedAt")
       VALUES ($1, 'super-admin-e2e@deqah.test', 'Super Admin E2E', '$2b$10$dummy_hash_super_admin', 'ADMIN', TRUE, TRUE, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [SUPER_ADMIN_USER_ID],
    );

    // Jeddah owner user.
    await pool.query(
      `INSERT INTO "User" (id, email, name, "passwordHash", role, "isSuperAdmin", "isActive", "createdAt", "updatedAt")
       VALUES ($1, 'jeddah-owner-e2e@deqah.test', 'Jeddah Owner E2E', '$2b$10$dummy_hash_jeddah_owner', 'ADMIN', FALSE, TRUE, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [JEDDAH_OWNER_USER_ID],
    );

    // OWNER membership for Jeddah owner in Jeddah org.
    await pool.query(
      `INSERT INTO "Membership" (id, "userId", "organizationId", role, "isActive", "acceptedAt", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'OWNER'::"MembershipRole", TRUE, NOW(), NOW(), NOW())
       ON CONFLICT ("userId", "organizationId") DO NOTHING`,
      [JEDDAH_OWNER_USER_ID, JEDDAH_ORG_ID],
    );

    // Resolve the BASIC plan's actual UUID at runtime (the seed migration
    // uses a deterministic but non-standard ID format; query by slug to be safe).
    const basicPlanRow = await pool.query(
      `SELECT id FROM "Plan" WHERE slug = 'BASIC' LIMIT 1`,
    );
    if (basicPlanRow.rows.length > 0) {
      const basicPlanId = basicPlanRow.rows[0].id as string;
      // BASIC plan subscription for Jeddah org (active, so FeatureGuard enforces BASIC limits).
      // ON CONFLICT on organizationId: only one active subscription per org.
      await pool.query(
        `INSERT INTO "Subscription" (id, "organizationId", "planId", status, "billingCycle", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, $2,
           'ACTIVE'::"SubscriptionStatus",
           'MONTHLY'::"BillingCycle",
           NOW(), NOW() + INTERVAL '30 days',
           NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM "Subscription" WHERE "organizationId" = $1
         )`,
        [JEDDAH_ORG_ID, basicPlanId],
      );
    } else {
      console.warn('[e2e] BASIC plan not found — feature-gate-uses-jwt-org tests will fail. Run migrations first.');
    }
  } finally {
    await pool.end();
  }
}