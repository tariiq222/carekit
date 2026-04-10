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
import { GroupsPaymentService } from '../groups/groups-payment.service.js';
import { MoyasarWebhookDto } from './dto/moyasar-webhook.dto.js';
import { CancelledBy, Prisma } from '@prisma/client';

@Injectable()
export class MoyasarWebhookService {
  private readonly logger = new Logger(MoyasarWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoiceCreatorService,
    private readonly config: ConfigService,
    private readonly bookingStatusService: BookingStatusService,
    private readonly groupsPaymentService: GroupsPaymentService,
  ) {}

  async handleMoyasarWebhook(
    signature: string,
    rawBody: Buffer,
    dto: MoyasarWebhookDto,
  ) {
    this.verifySignature(signature, rawBody);

    const payment = await this.prisma.payment.findFirst({
      where: { moyasarPaymentId: dto.id },
    });
    if (!payment) {
      // Try group payment if no booking payment found
      const groupPayment = await this.prisma.groupPayment.findFirst({
        where: { moyasarPaymentId: dto.id },
      });

      if (groupPayment) {
        if (dto.status === 'paid') {
          await this.processGroupPaymentSuccess(groupPayment.id, groupPayment.enrollmentId, dto.id, dto.amount);
        } else if (dto.status === 'failed') {
          await this.processGroupPaymentFailed(groupPayment.id, dto.id);
        }
        return { success: true };
      }

      this.logger.warn(`No payment found for Moyasar event ${dto.id}`);
      return { success: true };
    }

    if (dto.status === 'paid') {
      await this.processPaidWebhook(
        payment.id,
        payment.bookingId,
        dto.id,
        dto.amount,
        dto.status,
      );
    } else if (dto.status === 'failed') {
      await this.processFailedWebhook(payment.id, dto.id, dto.status);
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

    // Validate signature is a 64-char hex string before Buffer.from to avoid throwing
    if (!/^[0-9a-f]{64}$/i.test(signature)) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Invalid webhook signature',
        error: 'INVALID_SIGNATURE',
      });
    }

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    // timingSafeEqual prevents timing side-channel attacks
    if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
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
    status: string,
  ): Promise<void> {
    let updated: { count: number; amountMismatch: boolean };
    try {
      updated = await this.prisma.$transaction(async (tx) => {
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
          await tx.processedWebhook.create({ data: { eventId: `${eventId}_${status}` } });
          return { count: 0, amountMismatch: true, mismatchResult: result };
        }

        const result = await tx.payment.updateMany({
          where: { id: paymentId, status: 'pending' },
          data: { status: 'paid' },
        });
        await tx.processedWebhook.create({ data: { eventId: `${eventId}_${status}` } });
        return { count: result.count, amountMismatch: false };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return; // Already processed — idempotent
      }
      throw err;
    }

    if (updated.count === 0 || updated.amountMismatch) return;

    await this.confirmBookingAfterPayment(paymentId, bookingId);
    await this.createInvoiceAfterPayment(paymentId);
  }

  private async processFailedWebhook(
    paymentId: string,
    eventId: string,
    status: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { id: paymentId, status: 'pending' },
          data: { status: 'failed' },
        });
        await tx.processedWebhook.create({ data: { eventId: `${eventId}_${status}` } });
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return; // Already processed — idempotent
      }
      throw err;
    }
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
      // revert to confirmed since money was actually paid.
      const recovered = await this.bookingStatusService.recoverExpiredBooking(bookingId);
      if (recovered) {
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

  private async processGroupPaymentSuccess(
    groupPaymentId: string,
    enrollmentId: string,
    eventId: string,
    webhookAmount: number,
  ): Promise<void> {
    let updated: { count: number; amountMismatch: boolean };

    updated = await this.prisma.$transaction(async (tx) => {
      // Idempotency
      const existing = await tx.processedWebhook.findUnique({ where: { eventId } });
      if (existing) return { count: 0, amountMismatch: false };

      // Verify the paid amount matches the stored totalAmount before confirming.
      const storedGroupPayment = await tx.groupPayment.findUnique({
        where: { id: groupPaymentId },
        select: { totalAmount: true, status: true },
      });

      if (
        storedGroupPayment &&
        storedGroupPayment.status === 'pending' &&
        storedGroupPayment.totalAmount !== webhookAmount
      ) {
        this.logger.warn(
          `Group payment amount mismatch for groupPayment ${groupPaymentId}: ` +
            `expected ${storedGroupPayment.totalAmount} halalat, got ${webhookAmount} halalat from Moyasar`,
        );
        await tx.groupPayment.updateMany({
          where: { id: groupPaymentId, status: 'pending' },
          data: { status: 'failed' },
        });
        await tx.processedWebhook.create({ data: { eventId } });
        return { count: 0, amountMismatch: true };
      }

      const result = await tx.groupPayment.updateMany({
        where: { id: groupPaymentId, status: 'pending' },
        data: { status: 'paid', paidAt: new Date() },
      });

      await tx.processedWebhook.create({ data: { eventId, processedAt: new Date() } }).catch((e: unknown) => {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      });

      return { count: result.count, amountMismatch: false };
    });

    if (updated.count === 0 || updated.amountMismatch) return;

    await this.groupsPaymentService.confirmEnrollmentAfterPayment(enrollmentId);
  }

  private async processGroupPaymentFailed(groupPaymentId: string, eventId: string): Promise<void> {
    await this.prisma.groupPayment.updateMany({
      where: { id: groupPaymentId, status: 'pending' },
      data: { status: 'failed' },
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code !== 'P2002') throw e;
    });

    await this.prisma.processedWebhook.create({
      data: { eventId, processedAt: new Date() },
    }).catch((e: unknown) => {
      if ((e as { code?: string }).code !== 'P2002') throw e;
    });
  }
}
