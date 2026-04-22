import { GetZatcaConfigHandler } from './get-zatca-config.handler';
import { UpsertZatcaConfigHandler } from './upsert-zatca-config.handler';
import { OnboardZatcaHandler } from './onboard-zatca.handler';
import { BadRequestException } from '@nestjs/common';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

const mockConfig = {
  organizationId: DEFAULT_ORG,
  vatRegistrationNumber: null,
  sellerName: null,
  environment: 'sandbox',
  isOnboarded: false,
  onboardedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const buildPrisma = () => ({
  zatcaConfig: {
    upsert: jest.fn().mockResolvedValue(mockConfig),
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

const buildTenant = (organizationId = DEFAULT_ORG) =>
  ({
    requireOrganizationId: jest.fn().mockReturnValue(organizationId),
    requireOrganizationIdOrDefault: jest.fn().mockReturnValue(organizationId),
  }) as never;

describe('GetZatcaConfigHandler', () => {
  it('returns the singleton row, creating it on first call', async () => {
    const prisma = buildPrisma();
    const handler = new GetZatcaConfigHandler(prisma as never, buildTenant());
    const result = await handler.execute();
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG }),
      update: {},
    });
    expect(result.organizationId).toBe(DEFAULT_ORG);
  });
});

describe('UpsertZatcaConfigHandler', () => {
  it('upserts singleton config scoped by organizationId', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertZatcaConfigHandler(prisma as never, buildTenant());
    const dto = { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' };
    const result = await handler.execute(dto);
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG, vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' }),
      update: { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' },
    });
    expect(result.organizationId).toBe(DEFAULT_ORG);
  });
});

describe('OnboardZatcaHandler', () => {
  it('upserts onboarding data scoped by organizationId', async () => {
    const prisma = buildPrisma();
    const handler = new OnboardZatcaHandler(prisma as never, buildTenant());
    const cmd = { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' };
    const result = await handler.execute(cmd);
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { organizationId: DEFAULT_ORG },
      create: expect.objectContaining({ organizationId: DEFAULT_ORG, vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA', isOnboarded: true }),
      update: expect.objectContaining({ vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA', isOnboarded: true }),
    });
    expect(result.organizationId).toBe(DEFAULT_ORG);
  });

  it('throws if already onboarded', async () => {
    const prisma = buildPrisma();
    prisma.zatcaConfig.findFirst = jest.fn().mockResolvedValue({ ...mockConfig, isOnboarded: true });
    const handler = new OnboardZatcaHandler(prisma as never, buildTenant());
    await expect(handler.execute({ vatRegistrationNumber: '123', sellerName: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
