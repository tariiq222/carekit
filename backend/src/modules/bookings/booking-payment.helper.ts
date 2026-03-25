import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { VAT_RATE_DEFAULT } from '../../config/constants/index.js';

@Injectable()
export class BookingPaymentHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  /** Fix 7: Resolve actual patient — admin can book on behalf */
  async resolvePatientId(callerUserId: string, targetPatientId?: string): Promise<string> {
    if (!targetPatientId || targetPatientId === callerUserId) return callerUserId;
    const patient = await this.prisma.user.findFirst({
      where: { id: targetPatientId, isActive: true, deletedAt: null },
    });
    if (!patient) {
      throw new NotFoundException({ statusCode: 404, message: 'Patient not found', error: 'NOT_FOUND' });
    }
    return targetPatientId;
  }

  /** Create awaiting payment record using the resolved price from PriceResolver */
  async createPaymentIfNeeded(
    bookingId: string,
    type: string,
    resolvedPrice: number,
  ): Promise<void> {
    if (type === 'walk_in') {
      const settings = await this.bookingSettingsService.get();
      if (!settings.walkInPaymentRequired) return;
    }
    if (resolvedPrice <= 0) return; // Free service — no payment needed
    const vatAmount = Math.round(resolvedPrice * VAT_RATE_DEFAULT / 100);
    await this.prisma.payment.create({
      data: { bookingId, amount: resolvedPrice, vatAmount, totalAmount: resolvedPrice + vatAmount, method: 'moyasar', status: 'awaiting' },
    });
  }
}
