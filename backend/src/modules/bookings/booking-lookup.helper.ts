import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, Payment, Practitioner } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

/** Statuses that cannot be cancelled by anyone */
export const NON_CANCELLABLE: string[] = ['completed', 'cancelled', 'expired', 'no_show'];

export type BookingWithPayment = Booking & { payment: Payment | null };
export type BookingWithPractitioner = Booking & { practitioner: Practitioner & { userId: string } | null };
export type BookingWithRelations = BookingWithPayment & BookingWithPractitioner;

@Injectable()
export class BookingLookupHelper {
  constructor(private readonly prisma: PrismaService) {}

  async findBookingOrFail(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null } });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }

  async findWithPayment(id: string): Promise<BookingWithPayment> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { payment: true },
    });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
  }

  async findWithRelations(id: string): Promise<BookingWithRelations> {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: { payment: true, practitioner: true },
    });
    if (!booking) {
      throw new NotFoundException({ statusCode: 404, message: 'Booking not found', error: 'NOT_FOUND' });
    }
    return booking;
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
}
