import { BookingType } from '@prisma/client';

export interface CreateBookingDto {
  tenantId: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: Date;
  /** Optional — resolves price/duration from this specific ServiceDurationOption */
  durationOptionId?: string | null;
  currency?: string;
  bookingType?: BookingType;
  notes?: string;
  expiresAt?: Date;
  groupSessionId?: string;
}
