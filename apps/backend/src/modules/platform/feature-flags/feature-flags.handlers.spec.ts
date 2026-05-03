import { Test } from '@nestjs/testing';
import { ListFeatureFlagsHandler } from './list-feature-flags.handler';
import { GetFeatureFlagMapHandler } from './get-feature-flag-map.handler';
import { PrismaService } from '../../../infrastructure/database';

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
