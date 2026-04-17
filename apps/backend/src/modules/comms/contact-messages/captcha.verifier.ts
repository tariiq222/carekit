import { Injectable, Logger } from '@nestjs/common';

export const CAPTCHA_VERIFIER = Symbol('CAPTCHA_VERIFIER');

export interface CaptchaVerifier {
  verify(token: string | undefined | null): Promise<boolean>;
}

@Injectable()
export class NoopCaptchaVerifier implements CaptchaVerifier {
  async verify(_token: string | undefined | null): Promise<boolean> {
    return true;
  }
}

@Injectable()
export class HCaptchaVerifier implements CaptchaVerifier {
  private readonly logger = new Logger(HCaptchaVerifier.name);

  async verify(token: string | undefined | null): Promise<boolean> {
    if (!token) return false;
    const secret = process.env.HCAPTCHA_SECRET;
    if (!secret) {
      this.logger.warn('HCAPTCHA_SECRET not configured; rejecting token.');
      return false;
    }
    try {
      const res = await fetch('https://api.hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }).toString(),
      });
      const json = (await res.json()) as { success?: boolean };
      return json.success === true;
    } catch (err) {
      this.logger.warn(`hCaptcha verify failed: ${(err as Error).message}`);
      return false;
    }
  }
}

export function createCaptchaVerifier(): CaptchaVerifier {
  const provider = process.env.CAPTCHA_PROVIDER ?? 'noop';
  return provider === 'hcaptcha' ? new HCaptchaVerifier() : new NoopCaptchaVerifier();
}
