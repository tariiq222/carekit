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

  /** Fix 3: Create awaiting payment record based on booking type */
  async createPaymentIfNeeded(
    bookingId: string, type: string,
    ps: { priceClinic?: number | null; pricePhone?: number | null; priceVideo?: number | null },
    practitioner: { priceClinic?: number | null; pricePhone?: number | null; priceVideo?: number | null },
    service: { price: number },
  ): Promise<void> {
    if (type === 'walk_in') {
      const settings = await this.bookingSettingsService.get();
      if (!settings.walkInPaymentRequired) return;
    }
    const priceField = type === 'clinic_visit' || type === 'walk_in' ? 'priceClinic' as const
      : type === 'phone_consultation' ? 'pricePhone' as const : 'priceVideo' as const;
    const basePrice = ps[priceField] ?? practitioner[priceField] ?? service.price ?? 0;
    const vatAmount = Math.round(basePrice * VAT_RATE_DEFAULT / 100);
    await this.prisma.payment.create({
      data: { bookingId, amount: basePrice, vatAmount, totalAmount: basePrice + vatAmount, method: 'moyasar', status: 'awaiting' },
    });
  }
}
