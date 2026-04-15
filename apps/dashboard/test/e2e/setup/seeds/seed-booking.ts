import { apiPost, apiDelete, apiPatch } from './seed-base';

export interface SeededBooking {
  id: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  branchId: string;
  scheduledAt: string;
}

export interface CreateBookingArgs {
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  /** ISO 8601 — defaults to tomorrow at 10:00 AM */
  scheduledAt?: string;
  notes?: string;
  payAtClinic?: boolean;
  couponCode?: string;
}

function tomorrowAt10(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export async function createBooking(args: CreateBookingArgs): Promise<SeededBooking> {
  const body = {
    branchId: args.branchId,
    clientId: args.clientId,
    employeeId: args.employeeId,
    serviceId: args.serviceId,
    scheduledAt: args.scheduledAt ?? tomorrowAt10(),
    payAtClinic: args.payAtClinic ?? true,
    ...(args.notes && { notes: args.notes }),
    ...(args.couponCode && { couponCode: args.couponCode }),
  };
  const data = await apiPost<{ id: string }>('/dashboard/bookings', body);
  return {
    id: data.id,
    clientId: body.clientId,
    employeeId: body.employeeId,
    serviceId: body.serviceId,
    branchId: body.branchId,
    scheduledAt: body.scheduledAt,
  };
}

export async function deleteBooking(id: string): Promise<void> {
  // Cancel first (most bookings can't be hard-deleted directly)
  await apiPatch(`/dashboard/bookings/${id}/cancel`, { reason: 'cleanup' }).catch(() => {});
  await apiDelete(`/dashboard/bookings/${id}`);
}

export async function confirmBooking(id: string): Promise<void> {
  await apiPatch(`/dashboard/bookings/${id}/confirm`, {});
}

export async function checkInBooking(id: string): Promise<void> {
  await apiPatch(`/dashboard/bookings/${id}/check-in`, {});
}

export async function completeBooking(id: string): Promise<void> {
  await apiPatch(`/dashboard/bookings/${id}/complete`, {});
}

export async function cancelBooking(id: string, reason = 'test cancel'): Promise<void> {
  await apiPatch(`/dashboard/bookings/${id}/cancel`, { reason });
}
