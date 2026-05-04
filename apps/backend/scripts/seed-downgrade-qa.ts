/**
 * QA seed — sets up a fresh org for manual downgrade-flow testing.
 * Run:  npm run seed:qa-downgrade
 * Safe to re-run: uses upsert / findFirst+create everywhere.
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const QA_ORG_ID = 'aaaa1111-0000-0000-0000-000000000001';

const PRO_LIMITS = {
  recurring_bookings: true,
  waitlist: true,
  group_sessions: false,
  ai_chatbot: false,
  email_templates: true,
  coupons: true,
  advanced_reports: false,
  intake_forms: false,
  custom_roles: false,
  activity_log: false,
  maxBranches: 5,
  maxEmployees: 20,
  maxServices: 50,
  maxBookingsPerMonth: 1000,
};

const BASIC_LIMITS = {
  ...PRO_LIMITS,
  coupons: false,
  maxEmployees: 5,
  maxBranches: 1,
};

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  await prisma.$connect();

  // 1. Upsert PRO plan
  const proPlan = await prisma.plan.upsert({
    where: { slug: 'QA_PRO' },
    create: {
      slug: 'QA_PRO',
      nameAr: 'احترافي QA',
      nameEn: 'QA Pro',
      priceMonthly: 900,
      priceAnnual: 9000,
      currency: 'SAR',
      isActive: true,
      limits: PRO_LIMITS,
    },
    update: {
      nameAr: 'احترافي QA',
      nameEn: 'QA Pro',
      priceMonthly: 900,
      priceAnnual: 9000,
      isActive: true,
      limits: PRO_LIMITS,
    },
  });
  console.log(`✔  PRO plan: ${proPlan.id}`);

  // 2. Upsert BASIC plan
  const basicPlan = await prisma.plan.upsert({
    where: { slug: 'QA_BASIC' },
    create: {
      slug: 'QA_BASIC',
      nameAr: 'أساسي QA',
      nameEn: 'QA Basic',
      priceMonthly: 300,
      priceAnnual: 3000,
      currency: 'SAR',
      isActive: true,
      limits: BASIC_LIMITS,
    },
    update: {
      nameAr: 'أساسي QA',
      nameEn: 'QA Basic',
      priceMonthly: 300,
      priceAnnual: 3000,
      isActive: true,
      limits: BASIC_LIMITS,
    },
  });
  console.log(`✔  BASIC plan: ${basicPlan.id}`);

  // 3. Get first vertical
  const vertical = await prisma.vertical.findFirst({ where: { isActive: true } });
  if (!vertical) throw new Error('No active Vertical found — run the main seed first.');
  console.log(`✔  Vertical: ${vertical.slug} (${vertical.id})`);

  // 4. Upsert org
  const org = await prisma.organization.upsert({
    where: { id: QA_ORG_ID },
    create: {
      id: QA_ORG_ID,
      nameAr: 'منظمة اختبار التخفيض',
      nameEn: 'Downgrade QA Org',
      slug: 'downgrade-qa',
      status: 'ACTIVE',
      verticalId: vertical.id,
    },
    update: {
      nameAr: 'منظمة اختبار التخفيض',
      nameEn: 'Downgrade QA Org',
      status: 'ACTIVE',
      verticalId: vertical.id,
    },
  });
  console.log(`✔  Org: ${org.id}`);

  // 5. Upsert owner user
  const passwordHash = await bcrypt.hash('Owner@1234', 10);
  const ownerUser = await prisma.user.upsert({
    where: { email: 'qa-owner@deqah.test' },
    create: {
      email: 'qa-owner@deqah.test',
      passwordHash,
      name: 'QA Owner',
      role: 'ADMIN',
      isActive: true,
    },
    update: {
      passwordHash,
      name: 'QA Owner',
      isActive: true,
    },
  });
  console.log(`✔  Owner user: ${ownerUser.id}`);

  // 6. Upsert OWNER membership
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: ownerUser.id, organizationId: QA_ORG_ID } },
    create: {
      userId: ownerUser.id,
      organizationId: QA_ORG_ID,
      role: 'OWNER',
      isActive: true,
      acceptedAt: new Date(),
    },
    update: {
      role: 'OWNER',
      isActive: true,
    },
  });
  console.log(`✔  OWNER membership created`);

  // 7. Upsert active subscription → PRO plan
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.upsert({
    where: { organizationId: QA_ORG_ID },
    create: {
      organizationId: QA_ORG_ID,
      planId: proPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      planId: proPlan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
  console.log(`✔  Subscription (ACTIVE → QA_PRO)`);

  // 8. Upsert main branch (Branch has no slug field — use isMain as identifier)
  let branch = await prisma.branch.findFirst({
    where: { organizationId: QA_ORG_ID, isMain: true },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        organizationId: QA_ORG_ID,
        nameAr: 'الفرع الرئيسي',
        nameEn: 'Main Branch',
        isMain: true,
        isActive: true,
      },
    });
  }
  console.log(`✔  Main branch: ${branch.id}`);

  // 9. Create 12 active employees (idempotent via org+email unique)
  for (let i = 1; i <= 12; i++) {
    const empEmail = `qa-emp-${i}@deqah.test`;
    const existing = await prisma.employee.findFirst({
      where: { organizationId: QA_ORG_ID, email: empEmail },
    });
    if (!existing) {
      await prisma.employee.create({
        data: {
          organizationId: QA_ORG_ID,
          name: `QA Emp ${i}`,
          nameAr: `موظف QA ${i}`,
          nameEn: `QA Emp ${i}`,
          phone: `050100000${String(i).padStart(2, '0')}`,
          email: empEmail,
          specialty: 'General',
          isActive: true,
        },
      });
    }
  }
  console.log(`✔  12 employees created/verified`);

  // 10. Upsert 3 coupons
  const coupons = [
    { code: 'QA10PCT', discountType: 'PERCENTAGE' as const, discountValue: 10 },
    { code: 'QA20SAR', discountType: 'FIXED' as const, discountValue: 20 },
    { code: 'QA50PCT', discountType: 'PERCENTAGE' as const, discountValue: 50 },
  ];

  for (const c of coupons) {
    await prisma.coupon.upsert({
      where: { organizationId_code: { organizationId: QA_ORG_ID, code: c.code } },
      create: {
        organizationId: QA_ORG_ID,
        code: c.code,
        discountType: c.discountType,
        discountValue: c.discountValue,
        isActive: true,
      },
      update: {
        discountType: c.discountType,
        discountValue: c.discountValue,
        isActive: true,
      },
    });
  }
  console.log(`✔  3 coupons upserted`);

  await prisma.$disconnect();

  console.log('');
  console.log('=== QA SEED COMPLETE ===');
  console.log('Login URL:    http://localhost:5103');
  console.log('Email:        qa-owner@deqah.test');
  console.log('Password:     Owner@1234');
  console.log('Org:          منظمة اختبار التخفيض');
  console.log('Current plan: QA Pro (PRO)');
  console.log('Target plan:  QA Basic (downgrade target — will trigger violations)');
  console.log('Employees:    12 active (BASIC allows 5 → 7 must be deactivated)');
  console.log('Coupons:      3 active (BASIC has coupons:false → must be deactivated)');
  console.log('Branches:     1 main (BASIC allows 1 → OK)');
}

main().catch((e) => { console.error(e); process.exit(1); });
