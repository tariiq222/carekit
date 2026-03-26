import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { InvoiceCreatorService } from '../invoices/invoice-creator.service.js';
import { BookingStatusService } from '../bookings/booking-status.service.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { CancelledBy } from '@prisma/client';

@Injectable()
export class MoyasarWebhookService {
  private readonly logger = new Logger(MoyasarWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoiceCreatorService,
    private readonly config: ConfigService,
    private readonly bookingStatusService: BookingStatusService,
  ) {}

  async handleMoyasarWebhook(
    signature: string,
    rawBody: Buffer,
    dto: MoyasarWebhookDto,
  ) {
    this.verifySignature(signature, rawBody);

    const existing = await this.prisma.processedWebhook.findUnique({
      where: { eventId: dto.id },
    });
    if (existing) return { success: true };

    const payment = await this.prisma.payment.findFirst({
      where: { moyasarPaymentId: dto.id },
    });
    if (!payment) {
      this.logger.warn(`No payment found for Moyasar event ${dto.id}`);
      return { success: true };
    }

    if (dto.status === 'paid') {
      await this.processPaidWebhook(
        payment.id,
        payment.bookingId,
        dto.id,
        dto.amount,
      );
    } else if (dto.status === 'failed') {
      await this.processFailedWebhook(payment.id, dto.id);
    }

    return { success: true };
  }

  private verifySignature(signature: string, rawBody: Buffer): void {
    const secret = this.config.get<string>('MOYASAR_WEBHOOK_SECRET', '');
    if (!secret) {
      this.logger.error('MOYASAR_WEBHOOK_SECRET is not configured');
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Webhook verification not configured',
        error: 'WEBHOOK_CONFIG_ERROR',
      });
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSig !== signature) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid webhook signature',
        error: 'INVALID_SIGNATURE',
      });
    }
  }

  private async processPaidWebhook(
    paymentId: string,
    bookingId: string,
    eventId: string,
    webhookAmount: number,
  ): Promise<void> {
    const updated = await this.prisma.$transaction(async (tx) => {
      // Verify the paid amount matches the stored totalAmount before confirming.
      // Moyasar sends amounts in halalat (smallest currency unit).
      const storedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: { totalAmount: true, status: true },
      });

      if (
        storedPayment &&
        storedPayment.status === 'pending' &&
        storedPayment.totalAmount !== webhookAmount
      ) {
        this.logger.warn(
          `Payment amount mismatch for payment ${paymentId}: ` +
            `expected ${storedPayment.totalAmount} halalat, got ${webhookAmount} halalat from Moyasar`,
        );
        const result = await tx.payment.updateMany({
          where: { id: paymentId, status: 'pending' },
          data: { status: 'failed' },
        });
        await tx.processedWebhook.create({ data: { eventId } });
        return { count: 0, amountMismatch: true, mismatchResult: result };
      }

      const result = await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: { status: 'paid' },
      });
      await tx.processedWebhook.create({ data: { eventId } });
      return { count: result.count, amountMismatch: false };
    });

    if (updated.count === 0 || updated.amountMismatch) return;

    await this.confirmBookingAfterPayment(paymentId, bookingId);
    await this.createInvoiceAfterPayment(paymentId);
  }

  private async processFailedWebhook(
    paymentId: string,
    eventId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: { status: 'failed' },
      });
      await tx.processedWebhook.create({ data: { eventId } });
    });
  }

  private async confirmBookingAfterPayment(
    paymentId: string,
    bookingId: string,
  ): Promise<void> {
    try {
      await this.bookingStatusService.confirm(bookingId);
      this.logger.log(`Auto-confirmed booking ${bookingId} after payment`);
    } catch (err) {
      // Race recovery: if cron expired the booking while payment was processing,
      // revert to confirmed since money was actually paid
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });
      if (booking?.status === 'expired') {
        await this.prisma.booking.update({
          where: { id: bookingId },
          data: {
            status: 'confirmed',
            confirmedAt: new Date(),
            cancelledBy: null,
          },
        });
        this.logger.warn(
          `Recovered expired booking ${bookingId} → confirmed (payment ${paymentId} was paid)`,
        );
      } else {
        this.logger.warn(
          `Auto-confirm skipped for booking of payment ${paymentId}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }
  }

  private async createInvoiceAfterPayment(paymentId: string): Promise<void> {
    try {
      await this.invoicesService.createInvoice({ paymentId });
    } catch (err) {
      if (!(err instanceof ConflictException)) {
        this.logger.error(
          `Invoice creation failed for payment ${paymentId}`,
          err,
        );
      }
    }
  }
}
