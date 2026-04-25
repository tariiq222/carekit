import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class ZoomCredentialsService {
  private readonly key: Buffer;

  constructor(private readonly cfg: ConfigService) {
    const raw = cfg.get<string>('ZOOM_PROVIDER_ENCRYPTION_KEY');
    if (!raw) {
      throw new InternalServerErrorException(
        'ZOOM_PROVIDER_ENCRYPTION_KEY missing',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'ZOOM_PROVIDER_ENCRYPTION_KEY must decode to 32 bytes',
      );
    }
    this.key = key;
  }

  encrypt(payload: Record<string, unknown>, organizationId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
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
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < 28) {
      throw new Error('Invalid ciphertext length');
    }
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAAD(Buffer.from(organizationId, 'utf8'));
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf8')) as T;
  }
}
