import { InternalServerErrorException } from '@nestjs/common';
import { EmailCredentialsService } from './email-credentials.service';

const VALID_KEY = Buffer.from('abcdefghijklmnopqrstuvwxyz123456').toString('base64');

describe('EmailCredentialsService', () => {
  const mockConfig = {
    get: jest.fn(),
  };

  const createService = (key?: string) => {
    mockConfig.get.mockReturnValue(key ?? VALID_KEY);
    return new EmailCredentialsService(mockConfig as never);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws when EMAIL_PROVIDER_ENCRYPTION_KEY is missing', () => {
      mockConfig.get.mockReturnValue(undefined);
      expect(() => new EmailCredentialsService(mockConfig as never)).toThrow(
        InternalServerErrorException,
      );
      expect(() => new EmailCredentialsService(mockConfig as never)).toThrow(
        'EMAIL_PROVIDER_ENCRYPTION_KEY missing',
      );
    });

    it('throws when key is not valid base64', () => {
      mockConfig.get.mockReturnValue('not-valid-base64!!!');
      expect(() => new EmailCredentialsService(mockConfig as never)).toThrow(
        InternalServerErrorException,
      );
    });

    it('throws when decoded key is not 32 bytes', () => {
      mockConfig.get.mockReturnValue(Buffer.from('short').toString('base64'));
      expect(() => new EmailCredentialsService(mockConfig as never)).toThrow(
        InternalServerErrorException,
      );
      expect(() => new EmailCredentialsService(mockConfig as never)).toThrow(
        'EMAIL_PROVIDER_ENCRYPTION_KEY must decode to 32 bytes',
      );
    });
  });

  describe('encrypt and decrypt', () => {
    it('round-trips a simple payload', () => {
      const svc = createService();
      const original = { apiKey: 'secret123' };
      const orgId = 'org-1';

      const ciphertext = svc.encrypt(original, orgId);
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext).not.toBe(JSON.stringify(original));

      const decrypted = svc.decrypt(ciphertext, orgId);
      expect(decrypted).toEqual(original);
    });

    it('produces different ciphertext for different organizations', () => {
      const svc = createService();
      const original = { apiKey: 'secret123' };

      const ct1 = svc.encrypt(original, 'org-1');
      const ct2 = svc.encrypt(original, 'org-2');

      expect(ct1).not.toBe(ct2);
    });

    it('produces different ciphertext for same org (due to random IV)', () => {
      const svc = createService();
      const original = { apiKey: 'secret123' };

      const ct1 = svc.encrypt(original, 'org-1');
      const ct2 = svc.encrypt(original, 'org-1');

      expect(ct1).not.toBe(ct2);

      expect(svc.decrypt(ct1, 'org-1')).toEqual(original);
      expect(svc.decrypt(ct2, 'org-1')).toEqual(original);
    });

    it('decrypt fails with wrong organizationId', () => {
      const svc = createService();
      const original = { apiKey: 'secret123' };

      const ciphertext = svc.encrypt(original, 'org-1');

      expect(() => svc.decrypt(ciphertext, 'org-2')).toThrow();
    });

    it('decrypt fails with tampered ciphertext', () => {
      const svc = createService();
      const original = { apiKey: 'secret123' };

      const ciphertext = svc.encrypt(original, 'org-1');
      const tampered = ciphertext.slice(0, -4) + 'XXXX';

      expect(() => svc.decrypt(tampered, 'org-1')).toThrow();
    });

    it('handles empty object', () => {
      const svc = createService();
      const original = {};
      const orgId = 'org-1';

      const ciphertext = svc.encrypt(original, orgId);
      const decrypted = svc.decrypt(ciphertext, orgId);

      expect(decrypted).toEqual(original);
    });

    it('handles complex nested payload', () => {
      const svc = createService();
      const original = {
        user: 'john',
        roles: ['admin', 'user'],
        config: { timeout: 5000, retries: 3 },
      };
      const orgId = 'org-1';

      const ciphertext = svc.encrypt(original, orgId);
      const decrypted = svc.decrypt(ciphertext, orgId);

      expect(decrypted).toEqual(original);
    });

    it('handles unicode characters in payload', () => {
      const svc = createService();
      const original = { name: '日本語テスト', description: '🎉🎊🎈' };
      const orgId = 'org-1';

      const ciphertext = svc.encrypt(original, orgId);
      const decrypted = svc.decrypt(ciphertext, orgId);

      expect(decrypted).toEqual(original);
    });

    it('handles long string values', () => {
      const svc = createService();
      const original = { data: 'x'.repeat(10000) };
      const orgId = 'org-1';

      const ciphertext = svc.encrypt(original, orgId);
      const decrypted = svc.decrypt(ciphertext, orgId);

      expect(decrypted).toEqual(original);
    });
  });
});
