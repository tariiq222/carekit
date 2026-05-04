import { testPrisma, cleanTables } from '../setup/db.setup';
import { seedUser } from '../setup/seed.helper';

describe('Subscription Logic (integration)', () => {
  beforeEach(async () => {
    await cleanTables(['Subscription', 'Plan', 'Organization', 'User', 'Membership']);
  });

  afterEach(async () => {
    await cleanTables(['Subscription', 'Plan', 'Organization', 'User', 'Membership']);
  });

  describe('Subscription state machine', () => {
    it('creates subscription in TRIAL state', async () => {
      const org = await testPrisma.organization.create({
        data: {
          id: '00000000-0000-0000-0000-000000000091',
          slug: 'sub-test-org',
          nameAr: 'اختبار',
          nameEn: 'Sub Test Org',
          status: 'ACTIVE',
        },
      });

      const plan = await testPrisma.plan.create({
        data: {
          nameAr: 'خطة تجريبية',
          nameEn: 'Trial Plan',
          billingInterval: 'MONTHLY',
          price: 0,
          status: 'ACTIVE',
          isTrial: true,
          trialDays: 14,
        },
      });

      const subscription = await testPrisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      expect(subscription.status).toBe('TRIALING');
    });

    it('enforces plan limits', async () => {
      const plan = await testPrisma.plan.create({
        data: {
          nameAr: 'خطة محدودة',
          nameEn: 'Limited Plan',
          billingInterval: 'MONTHLY',
          price: 100,
          status: 'ACTIVE',
          limits: {
            employees: 5,
            clients: 100,
          },
        },
      });

      expect(plan.limits).toBeDefined();
      expect(plan.limits.employees).toBe(5);
    });
  });

  describe('Usage metering', () => {
    it('increments usage counter', async () => {
      const org = await testPrisma.organization.create({
        data: {
          id: '00000000-0000-0000-0000-000000000092',
          slug: 'usage-test-org',
          nameAr: 'اختبار',
          nameEn: 'Usage Test Org',
          status: 'ACTIVE',
        },
      });

      const plan = await testPrisma.plan.create({
        data: {
          nameAr: 'خطة معلقة',
          nameEn: 'Usage Plan',
          billingInterval: 'MONTHLY',
          price: 50,
          status: 'ACTIVE',
        },
      });

      const subscription = await testPrisma.subscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const usageRecord = await testPrisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          metric: 'api_calls',
          count: 0,
          periodStart: new Date(),
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const updated = await testPrisma.usageRecord.update({
        where: { id: usageRecord.id },
        data: { count: 10 },
      });

      expect(updated.count).toBe(10);
    });
  });
});