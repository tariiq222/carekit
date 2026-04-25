/**
 * Dev seed — creates an ADMIN user + singleton configs + main branch.
 * Run:  npm run prisma:seed
 * Safe to re-run: uses upsert everywhere.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const ADMIN_EMAIL    = process.env.SEED_EMAIL    ?? 'admin@carekit-test.com';
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? 'Admin@1234';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 0. Cleanup isolation test artifacts (Bug #24)
  await prisma.user.deleteMany({
    where: {
      OR: [
        { email: { contains: '@t.test' } },
        { email: { startsWith: 'iso-' } },
      ],
    },
  });

  // 1. Admin user (email is globally @unique now)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const adminUser = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      name: 'Admin',
      role: 'ADMIN',
      isActive: true,
    },
    update: {},
  });

  // 1.1 Admin membership to the default org — login requires an active
  //     Membership since SaaS-05b. @@unique([userId]) lets us upsert on userId.
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: adminUser.id, organizationId: DEFAULT_ORG_ID } },
    create: {
      userId: adminUser.id,
      organizationId: DEFAULT_ORG_ID,
      role: 'OWNER',
      isActive: true,
      acceptedAt: new Date(),
    },
    update: {
      role: 'OWNER',
      isActive: true,
    },
  });

  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to seed the initial super-admin user');
  }

  const superAdminPasswordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash: superAdminPasswordHash,
      name: 'Platform Admin',
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      isActive: true,
    },
    update: {
      passwordHash: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      isActive: true,
    },
  });

  // 1.5 Default org — clear any leftover suspension state from SaaS-05b tests.
  //     `updateMany` is a no-op if the row is missing, safe for fresh DBs.
  await prisma.organization.updateMany({
    where: { id: DEFAULT_ORG_ID, suspendedAt: { not: null } },
    data: { suspendedAt: null, suspendedReason: null, status: 'ACTIVE' },
  });

  // 2. Branding singleton (org-unique per SaaS-02c)
  await prisma.brandingConfig.upsert({
    where: { organizationId: DEFAULT_ORG_ID },
    create: {
      organizationId: DEFAULT_ORG_ID,
      organizationNameAr: 'منظمتي',
      organizationNameEn: 'My Organization',
      colorPrimary: '#354FD8',
      colorAccent:  '#82CC17',
    },
    update: {},
  });

  // 3. Organization settings singleton (org-unique per SaaS-02c)
  await prisma.organizationSettings.upsert({
    where: { organizationId: DEFAULT_ORG_ID },
    create: { organizationId: DEFAULT_ORG_ID },
    update: {},
  });

  // 4. Main branch
  await prisma.branch.upsert({
    where: { id: 'main-branch' },
    create: {
      id:       'main-branch',
      organizationId: DEFAULT_ORG_ID,
      nameAr:   'الفرع الرئيسي',
      nameEn:   'Main Branch',
      isActive: true,
      isMain:   true,
      timezone: 'Asia/Riyadh',
      country:  'SA',
    },
    update: {},
  });

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  Admin  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`✔  Super admin: ${SUPER_ADMIN_EMAIL}`);
  console.log(`✔  Branding singleton ready`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
