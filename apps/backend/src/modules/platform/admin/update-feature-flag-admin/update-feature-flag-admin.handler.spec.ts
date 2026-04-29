import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SuperAdminActionType } from '@prisma/client';
import { UpdateFeatureFlagAdminHandler } from './update-feature-flag-admin.handler';
import { PrismaService } from '../../../../infrastructure/database';

describe('UpdateFeatureFlagAdminHandler', () => {
  let handler: UpdateFeatureFlagAdminHandler;
  let orgFindUnique: jest.Mock;
  let flagFindFirst: jest.Mock;
  let flagUpsert: jest.Mock;
  let auditCreate: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(async () => {
    orgFindUnique = jest.fn().mockResolvedValue({ id: 'org-1' });
    flagFindFirst = jest.fn().mockResolvedValue({
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
    });
    flagUpsert = jest.fn().mockResolvedValue({
      id: 'org-waitlist',
      organizationId: 'org-1',
      key: 'waitlist',
      enabled: false,
    });
    auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });

    const allTenants = {
      organization: { findUnique: orgFindUnique },
      featureFlag: { findFirst: flagFindFirst, upsert: flagUpsert },
      superAdminActionLog: { create: auditCreate },
    };
    transaction = jest.fn((callback) => callback(allTenants));
    const prismaMock = { $allTenants: { ...allTenants, $transaction: transaction } } as unknown as PrismaService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateFeatureFlagAdminHandler,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    handler = moduleRef.get(UpdateFeatureFlagAdminHandler);
  });

  it('rejects missing organization', async () => {
    orgFindUnique.mockResolvedValue(null);

    await expect(baseExecute()).rejects.toThrow(NotFoundException);
  });

  it('rejects missing platform catalog flag', async () => {
    flagFindFirst.mockResolvedValue(null);

    await expect(baseExecute()).rejects.toThrow(NotFoundException);
  });

  it('upserts an organization override and writes audit log', async () => {
    const result = await baseExecute();

    expect(result.enabled).toBe(false);
    expect(flagFindFirst).toHaveBeenCalledWith({
      where: { key: 'waitlist', organizationId: null },
      select: {
        id: true,
        organizationId: true,
        key: true,
        enabled: true,
        allowedPlans: true,
        limitKind: true,
        nameAr: true,
        nameEn: true,
        descriptionAr: true,
        descriptionEn: true,
      },
    });
    expect(flagUpsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: 'org-1', key: 'waitlist' } },
      create: expect.objectContaining({
        organizationId: 'org-1',
        key: 'waitlist',
        enabled: false,
        nameAr: 'قائمة الانتظار',
        nameEn: 'Waitlist',
      }),
      update: { enabled: false },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        superAdminUserId: 'admin-1',
        actionType: SuperAdminActionType.FEATURE_FLAG_UPDATE,
        organizationId: 'org-1',
        reason: 'Disable waitlist for compliance review',
      }),
    });
    expect(transaction).toHaveBeenCalled();
  });

  function baseExecute() {
    return handler.execute({
      organizationId: 'org-1',
      key: 'waitlist',
      enabled: false,
      superAdminUserId: 'admin-1',
      reason: 'Disable waitlist for compliance review',
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
    });
  }
});
