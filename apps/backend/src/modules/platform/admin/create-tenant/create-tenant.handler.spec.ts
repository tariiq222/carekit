import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateTenantHandler } from './create-tenant.handler';

describe('CreateTenantHandler', () => {
  const tx = {
    organization: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
    vertical: { findFirst: jest.fn() },
    plan: { findUnique: jest.fn() },
    membership: { create: jest.fn() },
    brandingConfig: { create: jest.fn() },
    organizationSettings: { create: jest.fn() },
    department: { create: jest.fn() },
    serviceCategory: { create: jest.fn() },
    subscription: { create: jest.fn() },
    superAdminActionLog: { create: jest.fn() },
  };

  const prisma = {
    $allTenants: {
      $transaction: jest.fn(async (fn: (arg: typeof tx) => unknown) => fn(tx)),
    },
  };

  const handler = new CreateTenantHandler(prisma as never);

  const cmd = {
    slug: 'riyadh-clinic',
    nameAr: 'عيادة الرياض',
    nameEn: 'Riyadh Clinic',
    ownerUserId: 'owner-1',
    verticalSlug: 'clinic',
    planId: 'plan-1',
    billingCycle: 'MONTHLY' as const,
    trialDays: 10,
    superAdminUserId: 'sa-1',
    reason: 'Create tenant for onboarding',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tx.organization.findUnique.mockResolvedValue(null);
    tx.organization.create.mockResolvedValue({
      id: 'org-1',
      slug: cmd.slug,
      nameAr: cmd.nameAr,
      nameEn: cmd.nameEn,
      status: 'TRIALING',
      verticalId: 'vertical-1',
      trialEndsAt: new Date('2026-05-09T00:00:00.000Z'),
    });
    tx.user.findUnique.mockResolvedValue({ id: 'owner-1', isActive: true });
    tx.vertical.findFirst.mockResolvedValue({
      id: 'vertical-1',
      slug: 'clinic',
      seedDepartments: [{ nameAr: 'الطب العام', nameEn: 'General', sortOrder: 1 }],
      seedServiceCategories: [{ nameAr: 'كشف', nameEn: 'Consultation', sortOrder: 1 }],
    });
    tx.plan.findUnique.mockResolvedValue({ id: 'plan-1', slug: 'STARTER', isActive: true });
    tx.subscription.create.mockResolvedValue({ id: 'sub-1' });
  });

  it('rejects duplicate slug', async () => {
    tx.organization.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('rejects missing owner user', async () => {
    tx.user.findUnique.mockResolvedValue(null);

    await expect(handler.execute(cmd)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.organization.create).not.toHaveBeenCalled();
  });

  it('creates organization and owner membership', async () => {
    await handler.execute(cmd);

    expect(tx.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: cmd.slug,
        nameAr: cmd.nameAr,
        nameEn: cmd.nameEn,
        status: 'TRIALING',
        verticalId: 'vertical-1',
      }),
      select: expect.any(Object),
    });
    expect(tx.membership.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'owner-1',
        role: 'OWNER',
        isActive: true,
      }),
    });
  });

  it('creates default branding and organization settings', async () => {
    await handler.execute(cmd);

    expect(tx.brandingConfig.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        organizationNameAr: cmd.nameAr,
        organizationNameEn: cmd.nameEn,
      },
    });
    expect(tx.organizationSettings.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        companyNameAr: cmd.nameAr,
        companyNameEn: cmd.nameEn,
      },
    });
  });

  it('seeds vertical departments and categories when verticalSlug is provided', async () => {
    await handler.execute(cmd);

    expect(tx.department.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-1', nameAr: 'الطب العام' }),
    });
    expect(tx.serviceCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: 'org-1', nameAr: 'كشف' }),
    });
  });

  it('creates subscription when planId is provided', async () => {
    await handler.execute(cmd);

    expect(tx.subscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        planId: 'plan-1',
        status: 'TRIALING',
        billingCycle: 'MONTHLY',
      }),
      select: { id: true },
    });
  });

  it('writes super-admin audit log with action metadata', async () => {
    await handler.execute(cmd);

    expect(tx.superAdminActionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        superAdminUserId: 'sa-1',
        actionType: 'TENANT_CREATE',
        organizationId: 'org-1',
        reason: cmd.reason,
        metadata: expect.objectContaining({
          slug: cmd.slug,
          ownerUserId: 'owner-1',
          verticalSlug: 'clinic',
          planId: 'plan-1',
          subscriptionId: 'sub-1',
        }),
      }),
    });
  });
});
