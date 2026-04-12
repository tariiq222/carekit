import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ValidateLicenseService } from './validate-license.service';
import { PrismaService } from '../../../infrastructure/database';

const futureDate = new Date(Date.now() + 86400000 * 365);

describe('ValidateLicenseService', () => {
  let service: ValidateLicenseService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;

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

describe('ValidateLicenseService — fallbacks', () => {
  const buildPrisma = (cached: unknown = null) => ({
    licenseCache: {
      findUnique: jest.fn().mockResolvedValue(cached),
      upsert: jest.fn().mockResolvedValue({}),
    },
  });

  const buildConfig = (overrides: Record<string, string | undefined> = {}) => ({
    get: jest.fn().mockImplementation((key: string) => overrides[key]),
    getOrThrow: jest.fn().mockImplementation((key: string) => overrides[key] ?? ''),
  });

  it('returns Basic license when no LICENSE_SERVER_URL configured', async () => {
    const prisma = buildPrisma();
    const config = buildConfig({ LICENSE_SERVER_URL: undefined });
    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Basic');
  });

  it('returns cached license when not stale', async () => {
    const cachedLicense = {
      tenantId: 'tenant-1',
      tier: 'Pro',
      features: ['bookings', 'reports'],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(),
    };
    const prisma = buildPrisma(cachedLicense);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com' });
    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
  });

  it('falls back to stale cache when license server unreachable', async () => {
    const staleCache = {
      tenantId: 'tenant-1',
      tier: 'Enterprise',
      features: ['all'],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(0),
    };
    const prisma = buildPrisma(staleCache);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com', LICENSE_KEY: 'key-1' });

    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Enterprise');
  });

  it('fetches fresh license from server when cache is stale', async () => {
    const staleCache = {
      tenantId: 'tenant-1',
      tier: 'Basic',
      features: [],
      expiresAt: new Date(Date.now() + 86400_000),
      lastCheckedAt: new Date(0),
    };
    const prisma = buildPrisma(staleCache);
    const config = buildConfig({ LICENSE_SERVER_URL: 'https://license.example.com', LICENSE_KEY: 'key-1' });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tier: 'Pro', features: ['bookings'], expiresAt: new Date(Date.now() + 86400_000).toISOString() }),
    });

    const service = new ValidateLicenseService(config as never, prisma as never);
    const result = await service.getActiveLicense('tenant-1');
    expect(result.tier).toBe('Pro');
    expect(prisma.licenseCache.upsert).toHaveBeenCalled();
  });
});
