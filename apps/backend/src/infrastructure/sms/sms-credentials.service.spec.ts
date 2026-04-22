import { ConfigService } from '@nestjs/config';
import { SmsCredentialsService } from './sms-credentials.service';

const KEY_32_BYTES_BASE64 = Buffer.alloc(32, 7).toString('base64');

function makeCfg(value: string | undefined): ConfigService {
  return { get: () => value } as unknown as ConfigService;
}

describe('SmsCredentialsService', () => {
  it('round-trips a payload using organizationId as AAD', () => {
    const svc = new SmsCredentialsService(makeCfg(KEY_32_BYTES_BASE64));
    const cipher = svc.encrypt({ apiKey: 'abc', appSid: 'xyz' }, 'org-1');
    expect(typeof cipher).toBe('string');
    expect(cipher.length).toBeGreaterThan(0);
    expect(svc.decrypt(cipher, 'org-1')).toEqual({
      apiKey: 'abc',
      appSid: 'xyz',
    });
  });

  it('fails to decrypt when organizationId AAD differs', () => {
    const svc = new SmsCredentialsService(makeCfg(KEY_32_BYTES_BASE64));
    const cipher = svc.encrypt({ apiKey: 'abc' }, 'org-1');
    expect(() => svc.decrypt(cipher, 'org-2')).toThrow();
  });

  it('throws when key env var is missing', () => {
    expect(() => new SmsCredentialsService(makeCfg(undefined))).toThrow(
      /SMS_PROVIDER_ENCRYPTION_KEY missing/,
    );
  });

  it('throws when key is not 32 bytes after base64 decode', () => {
    const short = Buffer.alloc(16, 0).toString('base64');
    expect(() => new SmsCredentialsService(makeCfg(short))).toThrow(
      /32 bytes/,
    );
  });

  it('produces non-identical ciphertexts for identical payloads (random IV)', () => {
    const svc = new SmsCredentialsService(makeCfg(KEY_32_BYTES_BASE64));
    const a = svc.encrypt({ k: 'v' }, 'org-1');
    const b = svc.encrypt({ k: 'v' }, 'org-1');
    expect(a).not.toEqual(b);
  });
});
