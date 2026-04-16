import { GetZatcaConfigHandler } from './get-zatca-config.handler';
import { UpsertZatcaConfigHandler } from './upsert-zatca-config.handler';
import { OnboardZatcaHandler } from './onboard-zatca.handler';
import { BadRequestException } from '@nestjs/common';

const mockConfig = {
  id: 'default',
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
    findUnique: jest.fn().mockResolvedValue(null),
  },
});

describe('GetZatcaConfigHandler', () => {
  it('returns the singleton row, creating it on first call', async () => {
    const prisma = buildPrisma();
    const handler = new GetZatcaConfigHandler(prisma as never);
    const result = await handler.execute();
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default' }),
      update: {},
    });
    expect(result.id).toBe('default');
  });
});

describe('UpsertZatcaConfigHandler', () => {
  it('upserts singleton config with id=default', async () => {
    const prisma = buildPrisma();
    const handler = new UpsertZatcaConfigHandler(prisma as never);
    const dto = { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' };
    const result = await handler.execute(dto);
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default', vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' }),
      update: { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' },
    });
    expect(result.id).toBe('default');
  });
});

describe('OnboardZatcaHandler', () => {
  it('upserts onboarding data with singleton id', async () => {
    const prisma = buildPrisma();
    const handler = new OnboardZatcaHandler(prisma as never);
    const cmd = { vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA' };
    const result = await handler.execute(cmd);
    expect(prisma.zatcaConfig.upsert).toHaveBeenCalledWith({
      where: { id: 'default' },
      create: expect.objectContaining({ id: 'default', vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA', isOnboarded: true }),
      update: expect.objectContaining({ vatRegistrationNumber: '1234567890', sellerName: 'Clinic KSA', isOnboarded: true }),
    });
    expect(result.id).toBe('default');
  });

  it('throws if already onboarded', async () => {
    const prisma = buildPrisma();
    prisma.zatcaConfig.findUnique = jest.fn().mockResolvedValue({ ...mockConfig, isOnboarded: true });
    const handler = new OnboardZatcaHandler(prisma as never);
    await expect(handler.execute({ vatRegistrationNumber: '123', sellerName: 'X' })).rejects.toBeInstanceOf(BadRequestException);
  });
});