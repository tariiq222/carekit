import { createHmac } from 'crypto';
import { ZohoWebhookVerifier } from './zoho-webhook.verifier';

/**
 * Webhook signature verification is the only thing standing between an
 * unauthenticated POST and a status-mirror update on the right tenant's row.
 * These tests pin the contract: the per-tenant secret must be required, the
 * comparison must be constant-time, and a Tenant A signature must NOT verify
 * against Tenant B's secret.
 */
describe('ZohoWebhookVerifier', () => {
  const verifier = new ZohoWebhookVerifier();
  const SECRET_A = 'a'.repeat(64); // 32 bytes hex
  const SECRET_B = 'b'.repeat(64);
  const BODY = JSON.stringify({ event_type: 'invoice.paid', data: { invoice_id: 'inv_1' } });

  function sign(secret: string, body: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  it('accepts a correctly signed payload', () => {
    const sig = sign(SECRET_A, BODY);
    expect(verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: sig })).toBe(true);
  });

  it('REJECTS a Tenant A signature presented with Tenant B secret', () => {
    const sig = sign(SECRET_A, BODY);
    expect(verifier.verify({ secret: SECRET_B, rawBody: BODY, signature: sig })).toBe(false);
  });

  it('REJECTS when the body has been tampered with', () => {
    const sig = sign(SECRET_A, BODY);
    const tampered = BODY.replace('inv_1', 'inv_2');
    expect(verifier.verify({ secret: SECRET_A, rawBody: tampered, signature: sig })).toBe(false);
  });

  it('treats hex casing case-insensitively', () => {
    const sig = sign(SECRET_A, BODY).toUpperCase();
    expect(verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: sig })).toBe(true);
  });

  it('rejects when secret is empty (unconfigured tenant)', () => {
    const sig = sign(SECRET_A, BODY);
    expect(verifier.verify({ secret: '', rawBody: BODY, signature: sig })).toBe(false);
  });

  it('rejects when signature header is missing', () => {
    expect(verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: undefined })).toBe(false);
    expect(verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: '' })).toBe(false);
  });

  it('rejects signatures of wrong length without throwing', () => {
    expect(() =>
      verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: 'abcd' }),
    ).not.toThrow();
    expect(verifier.verify({ secret: SECRET_A, rawBody: BODY, signature: 'abcd' })).toBe(false);
  });
});
