import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, Payment, Practitioner } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

/** Statuses that cannot be cancelled by anyone (including admin) */
export const NON_CANCELLABLE: string[] = [
  'in_progress',
  'completed',
  'cancelled',
  'expired',
  'no_show',
];

/** Statuses from which admin can directly cancel */
export const ADMIN_CANCELLABLE_STATUSES: string[] = [
  'pending',
  'confirmed',
  'checked_in',
  'pending_cancellation',
];

export type BookingWithPayment = Booking & { payment: Payment | null };
export type BookingWithPractitioner = Booking & {
  practitioner: (Practitioner & { userId: string }) | null;
};
export type BookingWithRelations = BookingWithPayment & BookingWithPractitioner;

type BookingIncludeOptions =
  | { payment: true; practitioner?: never }
  | { practitioner: true; payment?: never }
  | { payment: true; practitioner: true }
  | Record<string, never>;

@Injectable()
export class BookingLookupHelper {
  constructor(private readonly prisma: PrismaService) {}

  /** M2: Unified lookup — include is optional. Replaces findBookingOrFail, findWithPayment, findWithRelations. */
  async findOrFail(id: string): Promise<Booking>;
  async findOrFail(
    id: string,
    include: { payment: true },
  ): Promise<BookingWithPayment>;
  async findOrFail(
    id: string,
    include: { practitioner: true },
  ): Promise<BookingWithPractitioner>;
  async findOrFail(
    id: string,
    include: { payment: true; practitioner: true },
  ): Promise<BookingWithRelations>;
  async findOrFail(
    id: string,
    include?: BookingIncludeOptions,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      ...(include && Object.keys(include).length > 0 ? { include } : {}),
    });
    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Booking not found',
        error: 'NOT_FOUND',
      });
    }
    return booking;
  }

  /** @deprecated Use findOrFail(id) */
  async findBookingOrFail(id: string): Promise<Booking> {
    return this.findOrFail(id);
  }

  /** @deprecated Use findOrFail(id, { payment: true }) */
  async findWithPayment(id: string): Promise<BookingWithPayment> {
    return this.findOrFail(id, { payment: true });
  }

  /** @deprecated Use findOrFail(id, { payment: true, practitioner: true }) */
  async findWithRelations(id: string): Promise<BookingWithRelations> {
    return this.findOrFail(id, { payment: true, practitioner: true });
  }

  assertCancellable(booking: Booking): void {
    if (NON_CANCELLABLE.includes(booking.status)) {
      throw new ConflictException({
        statusCode: 409,
        message: `Cannot cancel booking with status '${booking.status}'`,
        error: 'CONFLICT',
      });
    }
  }

  /** M3: Centralized patient ownership check */
  assertPatientOwnership(
    booking: { patientId: string | null },
    patientId: string,
  ): void {
    if (booking.patientId !== patientId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only perform this action on your own bookings',
        error: 'FORBIDDEN',
      });
    }
  }

  /** M3: Centralized practitioner ownership check */
  assertPractitionerOwnership(
    booking: { practitioner?: { userId: string } | null },
    practitionerUserId: string,
  ): void {
    if (booking.practitioner?.userId !== practitionerUserId) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'You can only perform this action on your own bookings',
        error: 'FORBIDDEN',
      });
    }
  }
}
