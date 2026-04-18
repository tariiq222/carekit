import { guestApiRequest } from './guest-client.js';
import type { OtpRequestPayload, OtpVerifyPayload, OtpVerifyResponse } from '@carekit/shared';

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
  return guestApiRequest<void>('/public/otp/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyOtp(payload: OtpVerifyPayload): Promise<OtpVerifyResponse> {
  return guestApiRequest<OtpVerifyResponse>('/public/otp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}