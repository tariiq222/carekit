import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListFeatureFlagsHandler } from './list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './get-feature-flag-map.handler';
import { UpdateFeatureFlagHandler } from './update-feature-flag.handler';
import { PrismaService } from '../../../infrastructure/database';

const mockFlag = {
  id: 'f1', tenantId: 't1', key: 'multi_branch', enabled: true,
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

  it('returns flags for tenant', async () => {
    const result = await handler.execute('t1');
    expect(result).toHaveLength(1);
    expect(prisma.featureFlag.findMany).toHaveBeenCalledWith({ where: { tenantId: 't1' }, orderBy: { key: 'asc' } });
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
    const result = await handler.execute('t1');
    expect(result).toEqual({ multi_branch: true });
  });
});

describe('UpdateFeatureFlagHandler', () => {
  let handler: UpdateFeatureFlagHandler;
  let prisma: { featureFlag: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      featureFlag: {
        findUnique: jest.fn().mockResolvedValue(mockFlag),
        update: jest.fn().mockResolvedValue({ ...mockFlag, enabled: false }),
      },
    };
    const module = await Test.createTestingModule({
      providers: [UpdateFeatureFlagHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(UpdateFeatureFlagHandler);
  });

  it('throws NotFoundException when flag not found', async () => {
    prisma.featureFlag.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ tenantId: 't1', key: 'x', enabled: false })).rejects.toThrow(NotFoundException);
  });

  it('updates flag enabled status', async () => {
    const result = await handler.execute({ tenantId: 't1', key: 'multi_branch', enabled: false });
    expect(result.enabled).toBe(false);
  });
});