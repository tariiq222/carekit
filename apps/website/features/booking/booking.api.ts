import type { AvailableSlot, GuestBookingPayload, GuestBookingResponse } from '@carekit/shared';
import type { PublicEmployee } from '@carekit/api-client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5100';

export interface PublicBranch {
  id: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  addressAr: string | null;
}

/**
 * Fetches active branches from GET /public/branches.
 * NOTE: This endpoint does not yet exist in the backend (backend gap — needs a
 * PublicBranchesController under src/api/public/).
 * Returns [] on any non-OK response so the wizard can fall back gracefully.
 */
export async function getPublicBranches(): Promise<PublicBranch[]> {
  try {
    const res = await fetch(`${API_BASE}/public/branches`, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? json) as PublicBranch[];
  } catch {
    return [];
  }
}

export async function getPublicAvailability(
  employeeId: string,
  date: string,
  serviceId?: string,
): Promise<AvailableSlot[]> {
  const params = new URLSearchParams({ date });
  if (serviceId) params.set('serviceId', serviceId);
  const res = await fetch(
    `${API_BASE}/public/employees/${employeeId}/availability?${params}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`Failed to fetch availability: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as AvailableSlot[];
}

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  const res = await fetch(`${API_BASE}/public/employees`, {
    next: { revalidate: 60, tags: ['public-employees'] },
  });
  if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as PublicEmployee[];
}

export async function createGuestBooking(
  payload: GuestBookingPayload,
  sessionToken: string,
): Promise<GuestBookingResponse> {
  const res = await fetch(`${API_BASE}/public/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Booking failed');
  }
  const json = await res.json();
  return (json.data ?? json) as GuestBookingResponse;
}

export async function initGuestPayment(
  bookingId: string,
  sessionToken: string,
): Promise<{ paymentId: string; redirectUrl: string }> {
  const res = await fetch(`${API_BASE}/public/payments/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Payment init failed');
  }
  const json = await res.json();
  return (json.data ?? json) as { paymentId: string; redirectUrl: string };
}