import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListFeatureFlagsHandler } from './list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './update-feature-flag.handler';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';

const tenantProvider = {
  provide: TenantContextService,
  useValue: { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('org-A') },
};

const mockFlag = {
  id: 'f1', key: 'multi_branch', enabled: true,
  nameAr: 'فروع متعددة', nameEn: 'Multi Branch',
  descriptionAr: null, descriptionEn: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('ListFeatureFlagsHandler', () => {
  let handler: ListFeatureFlagsHandler;
  let prisma: { featureFlag: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { featureFlag: { findMany: jest.fn().mockResolvedValue([mockFlag]) } };
    const module = await Test.createTestingModule({
      providers: [ListFeatureFlagsHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(ListFeatureFlagsHandler);
  });

  it('returns all flags ordered by key', async () => {
    const result = await handler.execute();
    expect(result).toHaveLength(1);
    expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } });
  });
});

describe('GetFeatureFlagMapHandler', () => {
  let handler: GetFeatureFlagMapHandler;
  let prisma: { featureFlag: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { featureFlag: { findMany: jest.fn().mockResolvedValue([mockFlag]) } };
    const module = await Test.createTestingModule({
      providers: [GetFeatureFlagMapHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(GetFeatureFlagMapHandler);
  });

  it('returns { key: enabled } map', async () => {
    const result = await handler.execute();
    expect(result).toEqual({ multi_branch: true });
  });
});

describe('UpdateFeatureFlagHandler', () => {
  let handler: UpdateFeatureFlagHandler;
  let prisma: { featureFlag: { findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      featureFlag: {
        findFirst: jest.fn().mockResolvedValue(mockFlag),
        update: jest.fn().mockResolvedValue({ ...mockFlag, enabled: false }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [UpdateFeatureFlagHandler, { provide: PrismaService, useValue: prisma }, tenantProvider],
    }).compile();
    handler = module.get(UpdateFeatureFlagHandler);
  });

  it('throws NotFoundException when flag not found', async () => {
    prisma.featureFlag.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ key: 'x', enabled: false })).rejects.toThrow(NotFoundException);
  });

  it('updates flag enabled status scoped to current org', async () => {
    const result = await handler.execute({ key: 'multi_branch', enabled: false });
    expect(result.enabled).toBe(false);
    expect(prisma.featureFlag.findFirst).toHaveBeenCalledWith({
      where: { key: 'multi_branch', organizationId: 'org-A' },
    });
    expect(prisma.featureFlag.update).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: 'org-A', key: 'multi_branch' } },
      data: { enabled: false },
    });
  });
});
