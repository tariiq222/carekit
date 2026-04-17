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

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 1. Admin user (email is globally @unique now)
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
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

  // 2. Branding singleton
  await prisma.brandingConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      organizationNameAr: 'منظمتي',
      organizationNameEn: 'My Organization',
      colorPrimary: '#354FD8',
      colorAccent:  '#82CC17',
    },
    update: {},
  });

  // 3. Organization settings singleton
  await prisma.organizationSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });

  // 4. Main branch
  await prisma.branch.upsert({
    where: { id: 'main-branch' },
    create: {
      id:       'main-branch',
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
  console.log(`✔  Branding singleton ready`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
