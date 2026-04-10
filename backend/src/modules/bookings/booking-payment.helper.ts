import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { BookingSettingsService } from './booking-settings.service.js';
import { applyVat } from '../payments/payments.helpers.js';
import { ERR } from '../../common/constants/error-messages.js';

@Injectable()
export class BookingPaymentHelper {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingSettingsService: BookingSettingsService,
  ) {}

  /** Resolve actual patient — only privileged roles can book on behalf of others */
  async resolvePatientId(
    callerUserId: string,
    targetPatientId?: string,
    callerRoles?: Array<{ slug: string }>,
  ): Promise<string> {
    if (!targetPatientId || targetPatientId === callerUserId) return callerUserId;

    const PRIVILEGED_ROLES = ['super_admin', 'receptionist', 'owner'];
    const hasPrivilege = callerRoles?.some((r) => PRIVILEGED_ROLES.includes(r.slug));
    if (!hasPrivilege) {
      throw new ForbiddenException({
        statusCode: 403,
        message: 'Only admins and receptionists can book on behalf of other patients',
        error: 'FORBIDDEN',
      });
    }

    const patient = await this.prisma.user.findFirst({
      where: { id: targetPatientId, isActive: true, deletedAt: null },
    });
    if (!patient) {
      throw new NotFoundException({ statusCode: 404, message: 'Patient not found', error: 'NOT_FOUND' });
    }
    return targetPatientId;
  }

  private static readonly PAY_AT_CLINIC_ROLES = ['owner', 'admin', 'staff'] as const;

  /**
   * Create a payment record for the booking using the resolved price.
   *
   * Deposit logic (CRITICAL fix #3):
   * When the service has depositEnabled=true and depositPercent < 100, the patient
   * pays only the deposit amount upfront. The deposit is applied BEFORE VAT calculation
   * so VAT is proportional to the amount actually charged.
   *
   * depositPercent=100 or depositEnabled=false → full price charged (existing behaviour).
   */
  async createPaymentIfNeeded(
    bookingId: string,
    type: string,
    resolvedPrice: number,
    payAtClinic?: boolean,
    callerRoles?: Array<{ slug: string }>,
    depositEnabled?: boolean,
    depositPercent?: number,
  ): Promise<void> {
    if (payAtClinic === true) {
      const hasPrivilege = callerRoles?.some((r) =>
        (BookingPaymentHelper.PAY_AT_CLINIC_ROLES as readonly string[]).includes(r.slug),
      );
      if (!hasPrivilege) {
        throw new ForbiddenException({ statusCode: 403, message: ERR.booking.payAtClinicForbidden, error: 'FORBIDDEN' });
      }
      // Cash payment — always full price regardless of deposit setting
      const { amount, vatAmount, totalAmount } = applyVat(resolvedPrice);
      await this.prisma.payment.create({
        data: { bookingId, amount, vatAmount, totalAmount, method: 'cash', status: 'paid' },
      });
      return;
    }

    if (type === 'walk_in') {
      const settings = await this.bookingSettingsService.get();
      if (!settings.walkInPaymentRequired) return;
    }
    if (resolvedPrice <= 0) return; // Free service — no payment needed

    // Apply deposit: charge partial amount when service requires a deposit
    const effectivePrice = depositEnabled && depositPercent && depositPercent > 0 && depositPercent < 100
      ? Math.round(resolvedPrice * depositPercent / 100)
      : resolvedPrice;

    const { amount, vatAmount, totalAmount } = applyVat(effectivePrice);
    await this.prisma.payment.create({
      data: { bookingId, amount, vatAmount, totalAmount, method: 'moyasar', status: 'awaiting' },
    });
  }
}
