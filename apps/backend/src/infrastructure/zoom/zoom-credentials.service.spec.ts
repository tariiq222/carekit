import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ZoomCredentialsService } from './zoom-credentials.service';
import { InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';

describe('ZoomCredentialsService', () => {
  let service: ZoomCredentialsService;
  const mockKey = randomBytes(32).toString('base64');
  const organizationId = 'org-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZoomCredentialsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ZOOM_PROVIDER_ENCRYPTION_KEY') return mockKey;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ZoomCredentialsService>(ZoomCredentialsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt payload', () => {
    const payload = { clientId: 'abc', clientSecret: '123' };
    const encrypted = service.encrypt(payload, organizationId);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');

    const decrypted = service.decrypt<{ clientId: string; clientSecret: string }>(
      encrypted,
      organizationId,
    );
    expect(decrypted).toEqual(payload);
  });

  it('should throw if organizationId (AAD) mismatch', () => {
    const payload = { clientId: 'abc' };
    const encrypted = service.encrypt(payload, organizationId);
    
    expect(() => {
      service.decrypt(encrypted, 'wrong-org');
    }).toThrow();
  });

  it('should throw if key is missing during initialization', async () => {
    const moduleBuilder = Test.createTestingModule({
      providers: [
        ZoomCredentialsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => null),
          },
        },
      ],
    });

    await expect(moduleBuilder.compile()).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
