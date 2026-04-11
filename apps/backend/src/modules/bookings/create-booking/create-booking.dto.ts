import { BookingType } from '@prisma/client';

export interface CreateBookingDto {
  tenantId: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  scheduledAt: Date;
  durationMins: number;
  price: number;
  currency?: string;
  bookingType?: BookingType;
  notes?: string;
  expiresAt?: Date;
  groupSessionId?: string;
}
