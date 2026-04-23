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
const CLIENT_EMAIL    = process.env.SEED_CLIENT_EMAIL    ?? 'client@carekit-test.com';
const CLIENT_PASSWORD = process.env.SEED_CLIENT_PASSWORD ?? 'Client@1234';
const EMPLOYEE_EMAIL    = process.env.SEED_EMPLOYEE_EMAIL    ?? 'employee@carekit-test.com';
const EMPLOYEE_PASSWORD = process.env.SEED_EMPLOYEE_PASSWORD ?? 'Employee@1234';
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

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

  // 5. Demo client for the mobile app (POST /public/auth/login).
  const clientPasswordHash = await bcrypt.hash(CLIENT_PASSWORD, 10);
  await prisma.client.upsert({
    where: { client_org_phone: { organizationId: DEFAULT_ORG_ID, phone: '+966500000001' } },
    create: {
      organizationId: DEFAULT_ORG_ID,
      name: 'سارة محمد',
      firstName: 'سارة',
      lastName: 'محمد',
      email: CLIENT_EMAIL,
      phone: '+966500000001',
      emailVerified: new Date(),
      source: 'ONLINE',
      accountType: 'FULL',
      claimedAt: new Date(),
      passwordHash: clientPasswordHash,
      isActive: true,
    },
    update: {
      passwordHash: clientPasswordHash,
      email: CLIENT_EMAIL,
      accountType: 'FULL',
      isActive: true,
    },
  });

  // 6. Demo employee — User (role=EMPLOYEE) + linked Employee record.
  const employeePasswordHash = await bcrypt.hash(EMPLOYEE_PASSWORD, 10);
  const employeeUser = await prisma.user.upsert({
    where: { email: EMPLOYEE_EMAIL },
    create: {
      email: EMPLOYEE_EMAIL,
      passwordHash: employeePasswordHash,
      name: 'فيصل أحمد',
      role: 'EMPLOYEE',
      isActive: true,
    },
    update: {
      passwordHash: employeePasswordHash,
      role: 'EMPLOYEE',
      isActive: true,
    },
  });
  await prisma.employee.upsert({
    where: { id: 'demo-employee-1' },
    create: {
      id: 'demo-employee-1',
      organizationId: DEFAULT_ORG_ID,
      userId: employeeUser.id,
      name: 'فيصل أحمد',
      nameAr: 'فيصل أحمد',
      email: EMPLOYEE_EMAIL,
      phone: '+966500000002',
      employmentType: 'FULL_TIME',
      onboardingStatus: 'COMPLETED',
      isActive: true,
    },
    update: {
      userId: employeeUser.id,
      isActive: true,
    },
  });

  await prisma.$disconnect();

  console.log('─────────────────────────────────────────────');
  console.log(`✔  Admin  : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`✔  Super admin: ${SUPER_ADMIN_EMAIL}`);
  console.log(`✔  Client : ${CLIENT_EMAIL} / ${CLIENT_PASSWORD}`);
  console.log(`✔  Employee: ${EMPLOYEE_EMAIL} / ${EMPLOYEE_PASSWORD}`);
  console.log(`✔  Branding singleton ready`);
  console.log(`✔  OrganizationSettings singleton ready`);
  console.log(`✔  Main branch created`);
  console.log('─────────────────────────────────────────────');
}

main().catch((e) => { console.error(e); process.exit(1); });
