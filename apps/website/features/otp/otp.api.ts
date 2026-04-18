import { OtpChannel, OtpPurpose } from '@carekit/shared';
import type { OtpRequestPayload, OtpVerifyPayload, OtpVerifyResponse } from '@carekit/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';

export async function requestOtp(payload: OtpRequestPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/public/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Failed to send OTP');
  }
}

export async function verifyOtp(
  identifier: string,
  code: string,
): Promise<OtpVerifyResponse> {
  const payload: OtpVerifyPayload = {
    channel: OtpChannel.EMAIL,
    identifier,
    code,
    purpose: OtpPurpose.GUEST_BOOKING,
  };
  const res = await fetch(`${API_BASE}/public/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Invalid OTP code');
  }
  const json = await res.json();
  return (json.data ?? json) as OtpVerifyResponse;
}