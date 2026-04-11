import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidateLicenseService } from './validate-license.service';
import { PrismaService } from '../../../infrastructure/database';

const futureDate = new Date(Date.now() + 86400000 * 365);

describe('ValidateLicenseService', () => {
  let service: ValidateLicenseService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ValidateLicenseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string) =>
              k === 'LICENSE_SERVER_URL' ? '' : k === 'LICENSE_KEY' ? 'test-key' : null,
            ),
          },
        },
        {
          provide: PrismaService,
          useValue: { licenseCache: { findUnique: jest.fn(), upsert: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get(ValidateLicenseService);
    prisma = module.get(PrismaService);
  });

  it('returns valid license from cache when not expired', async () => {
    prisma.licenseCache.findUnique.mockResolvedValue({
      tenantId: 'tenant-1',
      tier: 'Pro',
      features: ['BOOKINGS', 'AI_CHATBOT'],
      expiresAt: futureDate,
      lastCheckedAt: new Date(),
      licenseKey: 'key',
      id: 'lc-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
    expect(result.features).toContain('AI_CHATBOT');
  });

  it('falls back to Basic tier when no cache and no license server', async () => {
    prisma.licenseCache.findUnique.mockResolvedValue(null);
    prisma.licenseCache.upsert.mockResolvedValue({} as never);

    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Basic');
    expect(result.features).toContain('BOOKINGS');
  });
});
