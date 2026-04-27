import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { MoyasarCredentialsService } from './moyasar-credentials.service';

const cfgWith = (key: string | undefined): ConfigService =>
  ({
    get: (name: string) => (name === 'MOYASAR_TENANT_ENCRYPTION_KEY' ? key : undefined),
  }) as ConfigService;

describe('MoyasarCredentialsService', () => {
  const validKey = randomBytes(32).toString('base64');

  it('roundtrips a payload bound to organizationId', () => {
    const svc = new MoyasarCredentialsService(cfgWith(validKey));
    const enc = svc.encrypt({ secretKey: 'sk_test_abc' }, 'org-1');
    const dec = svc.decrypt<{ secretKey: string }>(enc, 'org-1');
    expect(dec.secretKey).toBe('sk_test_abc');
  });

  it('rejects ciphertext bound to a different organizationId (AAD mismatch)', () => {
    const svc = new MoyasarCredentialsService(cfgWith(validKey));
    const enc = svc.encrypt({ secretKey: 'sk_test_abc' }, 'org-1');
    expect(() => svc.decrypt(enc, 'org-2')).toThrow();
  });

  it('throws when the encryption key env is missing', () => {
    expect(() => new MoyasarCredentialsService(cfgWith(undefined))).toThrow(
      /MOYASAR_TENANT_ENCRYPTION_KEY/,
    );
  });

  it('throws when the encryption key is the wrong length', () => {
    const shortKey = randomBytes(16).toString('base64');
    expect(() => new MoyasarCredentialsService(cfgWith(shortKey))).toThrow(/32 bytes/);
  });

  it('produces different ciphertexts for the same plaintext (non-deterministic IV)', () => {
    const svc = new MoyasarCredentialsService(cfgWith(validKey));
    const a = svc.encrypt({ secretKey: 'sk_test_x' }, 'org-1');
    const b = svc.encrypt({ secretKey: 'sk_test_x' }, 'org-1');
    expect(a).not.toBe(b);
  });
});
