import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class MoyasarSubscriptionClient {
  constructor(private readonly config: ConfigService) {}

  async chargeWithToken(params: {
    token: string;
    amount: number; // minor units (halalas)
    currency: string;
    idempotencyKey: string;
    description: string;
    callbackUrl: string;
  }): Promise<{ id: string; status: string }> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetch('https://api.moyasar.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
        'Idempotency-Key': params.idempotencyKey,
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        source: { type: 'token', token: params.token },
        callback_url: params.callbackUrl,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Moyasar charge failed: ${response.status} ${text}`);
    }
    return response.json() as Promise<{ id: string; status: string }>;
  }

  /**
   * Refund a previously paid Moyasar payment. Amount in halalas (1 SAR = 100).
   * Idempotency-Key prevents double-refunds on network retry.
   * Throws on non-2xx — handler must catch and surface to the admin caller.
   */
  async refundPayment(params: {
    paymentId: string;
    amountHalalas: number;
    idempotencyKey: string;
  }): Promise<{ id: string; amount: number; status: string }> {
    const secretKey = this.config.getOrThrow<string>('MOYASAR_PLATFORM_SECRET_KEY');
    const response = await fetch(
      `https://api.moyasar.com/v1/payments/${params.paymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(secretKey + ':').toString('base64'),
          'Idempotency-Key': params.idempotencyKey,
        },
        body: JSON.stringify({ amount: params.amountHalalas }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Moyasar refund failed: ${response.status} ${text}`);
    }
    return response.json() as Promise<{ id: string; amount: number; status: string }>;
  }

  /**
   * Verifies the HMAC-SHA256 signature from Moyasar webhook requests.
   * Matches the approach used by MoyasarWebhookHandler: HMAC-SHA256 over
   * rawBody with the webhook secret, compared using timingSafeEqual.
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.getOrThrow<string>('MOYASAR_PLATFORM_WEBHOOK_SECRET');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return timingSafeEqual(expectedBuf, signatureBuf);
  }
}
