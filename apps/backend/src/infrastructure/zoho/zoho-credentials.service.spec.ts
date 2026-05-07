import { ConfigService } from '@nestjs/config';
import { ZohoCredentialsService } from './zoho-credentials.service';

/**
 * Tenant-isolation contract for Zoho credentials.
 *
 * The encryption envelope binds organizationId as AAD (Additional Authenticated
 * Data) — this means a ciphertext produced for org A cannot be decrypted with
 * org B's id, even though both tenants share the same master key. If this
 * property breaks, two tenants on the same Deqah deployment could potentially
 * read each other's Zoho refresh tokens.
 */
describe('ZohoCredentialsService — per-tenant AAD isolation', () => {
  const KEY_B64 = Buffer.alloc(32, 0x42).toString('base64');
  const TENANT_A = 'org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const TENANT_B = 'org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  function makeService(key = KEY_B64): ZohoCredentialsService {
    const cfg = { get: (k: string) => (k === 'ZOHO_PROVIDER_ENCRYPTION_KEY' ? key : undefined) };
    return new ZohoCredentialsService(cfg as ConfigService);
  }

  it('throws on encrypt without ZOHO_PROVIDER_ENCRYPTION_KEY', () => {
    const svc = makeService('');
    expect(() => svc.encrypt({ foo: 'bar' }, TENANT_A)).toThrow('ZOHO_PROVIDER_ENCRYPTION_KEY missing');
  });

  it('throws on encrypt when the key does not decode to 32 bytes', () => {
    const shortKey = Buffer.alloc(16, 1).toString('base64');
    const svc = makeService(shortKey);
    expect(() => svc.encrypt({ foo: 'bar' }, TENANT_A)).toThrow('must decode to 32 bytes');
  });

  it('round-trips a payload bound to a single tenant id', () => {
    const svc = makeService();
    const payload = { refreshToken: 'rt_abc', zohoOrganizationId: '60035000123456' };
    const blob = svc.encrypt(payload, TENANT_A);
    const decoded = svc.decrypt<typeof payload>(blob, TENANT_A);
    expect(decoded).toEqual(payload);
  });

  it('REJECTS decryption when the AAD (organizationId) differs', () => {
    const svc = makeService();
    const payload = { refreshToken: 'tenant-A-secret-refresh-token' };
    const blob = svc.encrypt(payload, TENANT_A);
    // Tenant B should never be able to read Tenant A's blob.
    expect(() => svc.decrypt(blob, TENANT_B)).toThrow();
  });

  it('produces distinct ciphertexts for the same payload+key when called twice', () => {
    // IV is randomBytes(12) per call, so identical inputs yield different
    // outputs — this confirms there is no nonce reuse.
    const svc = makeService();
    const payload = { refreshToken: 'rt_abc' };
    const a = svc.encrypt(payload, TENANT_A);
    const b = svc.encrypt(payload, TENANT_A);
    expect(a).not.toEqual(b);
  });

  it('produces distinct ciphertexts for the same payload across two tenants', () => {
    const svc = makeService();
    const payload = { refreshToken: 'rt_abc' };
    const a = svc.encrypt(payload, TENANT_A);
    const b = svc.encrypt(payload, TENANT_B);
    expect(a).not.toEqual(b);
  });

  it('rejects truncated / tampered ciphertexts', () => {
    const svc = makeService();
    const payload = { refreshToken: 'rt_abc' };
    const blob = svc.encrypt(payload, TENANT_A);
    const tampered = Buffer.from(blob, 'base64');
    // Flip one byte in the auth tag (offset 12..28). GCM must reject.
    tampered[15] ^= 0x01;
    expect(() => svc.decrypt(tampered.toString('base64'), TENANT_A)).toThrow();
  });

  it('rejects blobs shorter than IV+tag', () => {
    const svc = makeService();
    const tooShort = Buffer.alloc(20, 0).toString('base64');
    expect(() => svc.decrypt(tooShort, TENANT_A)).toThrow('Invalid ciphertext length');
  });

  it('REJECTS decryption when a different master key is used (key separation)', () => {
    const aliceSvc = makeService(Buffer.alloc(32, 0x11).toString('base64'));
    const bobSvc = makeService(Buffer.alloc(32, 0x22).toString('base64'));
    const blob = aliceSvc.encrypt({ refreshToken: 'rt' }, TENANT_A);
    expect(() => bobSvc.decrypt(blob, TENANT_A)).toThrow();
  });
});
