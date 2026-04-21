import type {
  ClientAuthResponse,
  ClientLoginPayload,
  ClientRegisterPayload,
  ClientProfile,
  ClientBookingListResponse,
} from '@carekit/shared';

import { getApiBase } from '@/lib/api-base';

export async function clientLoginApi(
  payload: ClientLoginPayload,
): Promise<ClientAuthResponse> {
  const res = await fetch(`${getApiBase()}/public/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Login failed' }));
    throw new Error((err as { message?: string }).message ?? 'Login failed');
  }
  const json = await res.json();
  return (json.data ?? json) as ClientAuthResponse;
}

export async function clientRegisterApi(
  payload: ClientRegisterPayload,
): Promise<ClientAuthResponse> {
  const res = await fetch(`${getApiBase()}/public/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.otpSessionToken}`,
    },
    credentials: 'include',
    body: JSON.stringify({ password: payload.password, name: payload.name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Registration failed' }));
    throw new Error((err as { message?: string }).message ?? 'Registration failed');
  }
  const json = await res.json();
  return (json.data ?? json) as ClientAuthResponse;
}

export async function getMeApi(): Promise<ClientProfile> {
  const res = await fetch(`${getApiBase()}/public/me`, {
    credentials: 'include',
  });
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch profile' }));
    throw new Error((err as { message?: string }).message ?? 'Failed to fetch profile');
  }
  const json = await res.json();
  return (json.data ?? json) as ClientProfile;
}

export async function getMyBookingsApi(
  page = 1,
  pageSize = 10,
): Promise<ClientBookingListResponse> {
  const res = await fetch(
    `${getApiBase()}/public/me/bookings?page=${page}&pageSize=${pageSize}`,
    { credentials: 'include' },
  );
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch bookings' }));
    throw new Error((err as { message?: string }).message ?? 'Failed to fetch bookings');
  }
  const json = await res.json();
  return (json.data ?? json) as ClientBookingListResponse;
}

export async function cancelMyBookingApi(
  bookingId: string,
  reason?: string,
): Promise<{ status: string; requiresApproval: boolean }> {
  const res = await fetch(`${getApiBase()}/public/me/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Cancel failed' }));
    throw new Error((err as { message?: string }).message ?? 'Cancel failed');
  }
  const json = await res.json();
  return (json.data ?? json) as { status: string; requiresApproval: boolean };
}

export async function rescheduleMyBookingApi(
  bookingId: string,
  newScheduledAt: string,
  newDurationMins?: number,
): Promise<{ booking: unknown }> {
  const res = await fetch(`${getApiBase()}/public/me/bookings/${bookingId}/reschedule`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ newScheduledAt, newDurationMins }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Reschedule failed' }));
    throw new Error((err as { message?: string }).message ?? 'Reschedule failed');
  }
  const json = await res.json();
  return (json.data ?? json) as { booking: unknown };
}

export async function clientLogoutApi(): Promise<void> {
  await fetch(`${getApiBase()}/public/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function clientResetPasswordApi(payload: {
  sessionToken: string;
  newPassword: string;
}): Promise<void> {
  const res = await fetch(`${getApiBase()}/public/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Password reset failed' }));
    throw new Error((err as { message?: string }).message ?? 'Password reset failed');
  }
}
