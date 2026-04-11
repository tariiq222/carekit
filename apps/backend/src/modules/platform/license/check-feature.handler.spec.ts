import { Test } from '@nestjs/testing';
import { CheckFeatureHandler } from './check-feature.handler';
import { ValidateLicenseService } from './validate-license.service';

describe('CheckFeatureHandler', () => {
  let handler: CheckFeatureHandler;
  let licenseService: jest.Mocked<ValidateLicenseService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CheckFeatureHandler,
        { provide: ValidateLicenseService, useValue: { getActiveLicense: jest.fn() } },
      ],
    }).compile();
    handler = module.get(CheckFeatureHandler);
    licenseService = module.get(ValidateLicenseService);
  });

  it('returns true when feature is in license', async () => {
    licenseService.getActiveLicense.mockResolvedValue({
      tier: 'Pro',
      features: ['BOOKINGS', 'AI_CHATBOT'],
      expiresAt: new Date(Date.now() + 86400000),
    });
    const result = await handler.execute({ tenantId: 'tenant-1', feature: 'AI_CHATBOT' });
    expect(result).toBe(true);
  });

  it('returns false when feature not in license', async () => {
    licenseService.getActiveLicense.mockResolvedValue({
      tier: 'Basic',
      features: ['BOOKINGS'],
      expiresAt: new Date(Date.now() + 86400000),
    });
    const result = await handler.execute({ tenantId: 'tenant-1', feature: 'AI_CHATBOT' });
    expect(result).toBe(false);
  });
});
