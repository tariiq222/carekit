import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Per-tenant envelope encryption for Zoho integration credentials.
 *
 * Mirrors {@link ZoomCredentialsService} byte-for-byte (AES-256-GCM, AAD =
 * organizationId, IV(12) ‖ tag(16) ‖ ciphertext, base64 transport). Each
 * provider has its own key so a leak of one provider's encrypted blobs is
 * useless for the others.
 *
 * The encrypted blob is the JSON-serialised {@link ZohoIntegrationConfig}.
 */
@Injectable()
export class ZohoCredentialsService {
  private _key?: Buffer;

  constructor(private readonly cfg: ConfigService) {}

  private getKey(): Buffer {
    if (this._key) return this._key;
    const raw = this.cfg.get<string>('ZOHO_PROVIDER_ENCRYPTION_KEY');
    if (!raw) {
      throw new InternalServerErrorException('ZOHO_PROVIDER_ENCRYPTION_KEY missing');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'ZOHO_PROVIDER_ENCRYPTION_KEY must decode to 32 bytes',
      );
    }
    this._key = key;
    return this._key;
  }

  encrypt(payload: Record<string, unknown>, organizationId: string): string {
    const key = this.getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(organizationId, 'utf8'));
    const plain = Buffer.from(JSON.stringify(payload), 'utf8');
    const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ct]).toString('base64');
  }

  decrypt<T extends Record<string, unknown>>(
    ciphertext: string,
    organizationId: string,
  ): T {
    const key = this.getKey();
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < 28) {
      throw new Error('Invalid ciphertext length');
    }
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(organizationId, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }
}
