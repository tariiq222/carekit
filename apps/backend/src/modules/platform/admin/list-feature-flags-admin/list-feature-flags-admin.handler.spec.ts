import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ListFeatureFlagsAdminHandler } from './list-feature-flags-admin.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('ListFeatureFlagsAdminHandler', () => {
  let handler: ListFeatureFlagsAdminHandler;
  let orgFindUnique: jest.Mock;
  let flagFindMany: jest.Mock;

  beforeEach(async () => {
    orgFindUnique = jest.fn().mockResolvedValue({
      id: 'org-1',
      subscription: { planId: 'plan-pro', plan: { slug: 'PRO' } },
    });
    flagFindMany = jest.fn().mockResolvedValue([]);
    const prismaMock = {
      $allTenants: {
        organization: { findUnique: orgFindUnique },
        featureFlag: { findMany: flagFindMany },
      },
    } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ListFeatureFlagsAdminHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(ListFeatureFlagsAdminHandler);
  });

  it('rejects missing organization', async () => {
    orgFindUnique.mockResolvedValue(null);

    await expect(handler.execute({ organizationId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('lists platform catalog with selected organization override', async () => {
    flagFindMany.mockResolvedValue([
      {
        id: 'platform-waitlist',
        organizationId: null,
        key: 'waitlist',
        enabled: true,
        allowedPlans: ['plan-pro'],
        limitKind: null,
        nameAr: 'قائمة الانتظار',
        nameEn: 'Waitlist',
        descriptionAr: null,
        descriptionEn: null,
        updatedAt: new Date('2026-04-01T00:00:00Z'),
      },
      {
        id: 'org-waitlist',
        organizationId: 'org-1',
        key: 'waitlist',
        enabled: false,
        allowedPlans: ['plan-pro'],
        limitKind: null,
        nameAr: 'قائمة الانتظار',
        nameEn: 'Waitlist',
        descriptionAr: null,
        descriptionEn: null,
        updatedAt: new Date('2026-04-02T00:00:00Z'),
      },
    ]);

    const result = await handler.execute({ organizationId: 'org-1' });

    expect(orgFindUnique).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: {
        id: true,
        subscription: {
          select: { planId: true, plan: { select: { slug: true } } },
        },
      },
    });
    expect(flagFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ organizationId: null }, { organizationId: 'org-1' }] },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        key: 'waitlist',
        planDerivedEnabled: true,
        overrideEnabled: false,
        enabled: false,
        source: 'ORG_OVERRIDE',
        overrideUpdatedAt: new Date('2026-04-02T00:00:00Z'),
      }),
    ]);
  });
});
